import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { temCreditoIA, semCreditoIA } from '../_shared/creditos.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `Você é um redator sênior da Akuris, plataforma brasileira de Governança, Risco e Compliance (GRC).

Gere o CONTEÚDO PRINCIPAL de um e-mail informativo/marketing em HTML simples e responsivo.

REGRAS OBRIGATÓRIAS:
- NUNCA inclua: <html>, <head>, <body>, header com logo, rodapé, assinatura. Apenas o miolo.
- Use APENAS estas tags: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <br>.
- Não use estilos inline complexos. Pode usar style="color:#7552ff" em links e style="margin:0 0 16px" em parágrafos se necessário.
- Tom: profissional, consultivo, direto, em português do Brasil. Sem saudações genéricas no início ("Olá", "Prezado") — vá direto ao tema.
- Estrutura recomendada: <h2> com título do tema, parágrafo introdutório, <h3> com subtemas, listas com diferenciais.
- Sempre que falar de um módulo, destaque: o que ele resolve, principais funcionalidades, e o diferencial competitivo da Akuris.
- Termine com um parágrafo de chamada para ação convidando a explorar a plataforma.
- Tamanho: entre 250 e 500 palavras.

RETORNE APENAS O HTML, SEM MARKDOWN, SEM EXPLICAÇÕES.`;

async function isSuperAdmin(token: string): Promise<{ ok: boolean; userId?: string }> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return { ok: false };
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  return { ok: data?.role === "super_admin", userId: user.id };
}

function sanitizeHtml(html: string): string {
  // Strip script/style tags and event handlers
  let out = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/\son\w+="[^"]*"/gi, "");
  out = out.replace(/\son\w+='[^']*'/gi, "");
  out = out.replace(/javascript:/gi, "");
  // Remove markdown code fences if model included them
  out = out.replace(/^```html\s*/i, "").replace(/```\s*$/i, "");
  return out.trim();
}

async function generateText(prompt: string): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (r.status === 429) throw { httpStatus: 429, message: "Limite de requisições atingido. Tente novamente em alguns instantes." };
  if (r.status === 402) throw { httpStatus: 402, message: "Créditos da IA esgotados. Adicione créditos no workspace." };
  if (!r.ok) throw new Error(`AI gateway error ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const content = data.choices?.[0]?.message?.content || "";
  return sanitizeHtml(content);
}

async function generateImage(theme: string): Promise<string | null> {
  const imagePrompt = `Ilustração editorial moderna e corporativa sobre: ${theme}. Estilo: flat design profissional, cores predominantes navy escuro (#0a1628) e roxo (#7552ff), sem texto na imagem, formato widescreen, alta qualidade, visual elegante para topo de e-mail marketing de uma plataforma de Governança Risco e Compliance.`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: imagePrompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!r.ok) {
    console.error("Erro gerar imagem:", r.status, await r.text());
    return null;
  }
  const data = await r.json();
  const dataUrl: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl?.startsWith("data:")) return null;

  // Upload para o storage
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ext = mime.split("/")[1] || "png";
  const path = `ai/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { error } = await supabase.storage.from("email-assets").upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) {
    console.error("Erro upload:", error);
    return null;
  }
  const { data: pub } = supabase.storage.from("email-assets").getPublicUrl(path);
  return pub.publicUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const auth = await isSuperAdmin(token);
    if (!auth.ok) return new Response(JSON.stringify({ error: "Apenas super admins" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt || "").trim();
    const includeImage = Boolean(body.includeImage);
    const includeSubject = Boolean(body.includeSubject);
    const empresaId: string | null = body.empresa_id || null;
    if (!prompt || prompt.length < 5) {
      return new Response(JSON.stringify({ error: "Descreva melhor o conteúdo do e-mail" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Consome 1 crédito de IA (somente quando há empresa associada — chamadas internas do super-admin sem empresa pulam o débito)
    if (empresaId && auth.userId) {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
      // Sem franquia, nem se chama o modelo: a chamada custa no instante
      // em que sai. Ver `_shared/creditos.ts`.
      if (!(await temCreditoIA(supabase, empresaId))) return semCreditoIA(corsHeaders);

      const { data: creditOk, error: creditErr } = await supabase.rpc('consume_ai_credit', {
        p_empresa_id: empresaId,
        p_user_id: auth.userId,
        p_funcionalidade: 'generate_email_content',
        p_descricao: 'Geração de conteúdo de campanha por IA',
      });
      if (creditErr || creditOk === false) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Entre em contato com o administrador da sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const html = await generateText(prompt);

    let subject: string | null = null;
    if (includeSubject) {
      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Você cria assuntos curtos (até 70 caracteres) e atrativos para e-mails corporativos da Akuris (plataforma GRC). Retorne APENAS o assunto, sem aspas, sem prefixos." },
              { role: "user", content: `Tema: ${prompt}` },
            ],
          }),
        });
        if (r.ok) {
          const d = await r.json();
          subject = String(d.choices?.[0]?.message?.content || "").trim().replace(/^"|"$/g, "").slice(0, 100);
        }
      } catch (e) { console.error("subject error", e); }
    }

    let imageUrl: string | null = null;
    if (includeImage) {
      imageUrl = await generateImage(prompt);
    }

    return new Response(JSON.stringify({ html, imageUrl, subject }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const status = e?.httpStatus || 500;
    const msg = e?.message || (e instanceof Error ? e.message : String(e));
    console.error("generate-email-content error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
