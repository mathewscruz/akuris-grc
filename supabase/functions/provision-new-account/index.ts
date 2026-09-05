import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PROVISION] ${step}${detailsStr}`);
};

// Provisionamento interno. A interface pública de cadastro foi removida do
// produto; manter esta função anônima permitia criar uma empresa/admin usando
// o e-mail de outra pessoa já marcado como confirmado.

/** SHA-256 em hexadecimal — formato exigido pelo limitador da base. */
async function sha256Hex(valor: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(valor));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo nao permitido" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!serviceRole || bearer !== serviceRole) {
    return new Response(JSON.stringify({ error: "Nao autorizado" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                   req.headers.get("x-real-ip") || "unknown";

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const { data: podeSeguir, error: limiteError } = await supabaseAdmin.rpc(
    "consume_public_registration_attempt",
    { p_fingerprint_hash: await sha256Hex(clientIp) },
  );
  if (limiteError) {
    // Fail-closed: sem conseguir contar, nao se cria conta.
    logStep("Falha ao consultar limite de registo", { erro: String(limiteError.message ?? limiteError) });
    return new Response(JSON.stringify({ error: "Servico indisponivel. Tente novamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 503,
    });
  }
  if (podeSeguir !== true) {
    logStep("Rate limited", { ip: clientIp });
    return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente em alguns minutos." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 429,
    });
  }

  try {
    const { nome, email, senha, empresa_nome, cnpj } = await req.json();
    logStep("Request received", { email, empresa_nome });

    if (!nome || !email || !senha || !empresa_nome) {
      throw new Error("Campos obrigatórios: nome, email, senha, empresa_nome");
    }

    // A politica de senha do produto, imposta tambem aqui. O GoTrue so garante
    // 6 caracteres sem classes, e este caminho nao validava nada do lado do
    // servidor: o que o cliente enviasse virava senha da conta nova.
    // Espelha `src/lib/politica-senha.ts`; se uma mudar, a outra tem de mudar.
    const senhaFraca =
      typeof senha !== "string" ||
      senha.length < 8 ||
      !/[A-Z]/.test(senha) ||
      !/[a-z]/.test(senha) ||
      !/[0-9]/.test(senha);
    if (senhaFraca) {
      throw new Error(
        "A senha precisa de pelo menos 8 caracteres, com maiúscula, minúscula e número",
      );
    }

    // Validate CNPJ uniqueness when provided
    const cnpjClean = cnpj ? String(cnpj).replace(/\D/g, "") : null;
    if (cnpjClean) {
      const { data: existing } = await supabaseAdmin
        .from("empresas")
        .select("id")
        .eq("cnpj", cnpjClean)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Já existe uma empresa cadastrada com este CNPJ." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        });
      }
    }

    // 1. Create auth user
    logStep("Creating auth user");
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, empresa_nome },
    });
    if (authError || !authData.user) {
      throw new Error(authError?.message || "Erro ao criar usuário");
    }
    const userId = authData.user.id;
    logStep("User created", { userId });

    // 2. Resolve default plan (compliance_start) — trials always start on this plan
    const { data: defaultPlan } = await supabaseAdmin
      .from("planos")
      .select("id")
      .eq("codigo", "compliance_start")
      .eq("ativo", true)
      .maybeSingle();

    // 3. Resolve unique slug
    const baseSlug = slugify(empresa_nome) || `empresa-${userId.slice(0, 8)}`;
    let slug = baseSlug;
    for (let i = 0; i < 5; i++) {
      const { data: collision } = await supabaseAdmin
        .from("empresas")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!collision) break;
      slug = `${baseSlug}-${crypto.randomUUID().replaceAll('-', '').slice(0, 6)}`;
    }

    // 4. Create empresa in trial mode
    logStep("Creating empresa", { slug });
    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .insert({
        nome: empresa_nome,
        cnpj: cnpjClean,
        slug,
        ativo: true,
        status_licenca: "trial",
        data_inicio_trial: new Date().toISOString(),
        plano_id: defaultPlan?.id || null,
        contato: email,
      })
      .select()
      .single();

    if (empresaError) {
      logStep("Empresa creation failed", empresaError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Erro ao criar empresa: ${empresaError.message}`);
    }

    // 5. Create profile (admin role of own company)
    logStep("Creating profile");
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: userId,
        nome,
        email,
        role: "admin",
        empresa_id: empresa.id,
      });

    if (profileError) {
      logStep("Profile creation failed", profileError);
      await supabaseAdmin.from("empresas").delete().eq("id", empresa.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Erro ao criar perfil: ${profileError.message}`);
    }

    // 6. RBAC role
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "admin" },
      { onConflict: "user_id,role" }
    );

    // 7. Default module permissions
    try {
      await supabaseAdmin.rpc("apply_default_permissions_for_user", { user_id_param: userId });
    } catch (e) {
      logStep("apply_default_permissions_for_user failed (non-fatal)", e);
    }

    logStep("Provisioning complete", { empresaId: empresa.id, userId });

    return new Response(
      JSON.stringify({
        success: true,
        empresa_id: empresa.id,
        user_id: userId,
        message: "Conta criada com sucesso. Você está em período de teste de 14 dias.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    logStep("Error", { message: error.message });
    return new Response(JSON.stringify({ error: error.message || "Erro ao criar conta" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
