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

export function authErrorResponse(err: unknown, corsHeaders: Record<string, string>) {
  const status = err instanceof AuthError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unknown error";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
