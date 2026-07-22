// Shared auth helpers for Edge Functions.
// Validates the caller's JWT and resolves their empresa_id from profiles.
// NEVER trust empresa_id (or user_id) supplied in the request body.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AuthContext {
  userId: string;
  empresaId: string | null;
  role: string | null;
  supabase: SupabaseClient; // service-role client for downstream queries
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Validates the Authorization: Bearer <jwt> header and resolves the caller's
 * empresa_id from `profiles`. Throws AuthError on missing/invalid tokens.
 */
export async function requireUserContext(req: Request): Promise<AuthContext> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_KEY;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Unauthorized: missing bearer token", 401);
  }
  const token = authHeader.replace("Bearer ", "");

  // Verify the JWT using anon key (validates signature + expiration).
  const verifier = createClient(SUPABASE_URL, ANON_KEY);
  const { data: userData, error: userErr } = await verifier.auth.getUser(token);
  if (userErr || !userData?.user) {
    throw new AuthError("Unauthorized: invalid or expired token", 401);
  }
  const userId = userData.user.id;

  // Service-role client for elevated reads.
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("empresa_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileErr) {
    throw new AuthError("Failed to load user profile", 500);
  }

  return {
    userId,
    empresaId: profile?.empresa_id ?? null,
    role: profile?.role ?? null,
    supabase,
  };
}

/**
 * Ensures the caller has a valid (unexpired) MFA session in `mfa_sessions`.
 * Skips the check when MFA_ENFORCED env var is set to '0' or 'false'
 * (allows disabling for internal service-role invocations only).
 */
export async function requireValidMfa(ctx: AuthContext): Promise<void> {
  const flag = (Deno.env.get('MFA_ENFORCED') || '1').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return;

  const { data, error } = await ctx.supabase
    .from('mfa_sessions')
    .select('id, expires_at')
    .eq('user_id', ctx.userId)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AuthError('Failed to verify MFA session', 500);
  }
  if (!data) {
    throw new AuthError('MFA verification required', 403);
  }
}

export function authErrorResponse(err: unknown, corsHeaders: Record<string, string>) {
  const status = err instanceof AuthError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unknown error";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
