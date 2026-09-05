import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@6.26.0";
import { authCorsHeaders } from "../_shared/cors.ts";
import { EMAIL_FROM, emailDocument, escapeHtml, htmlToText } from "../_shared/email.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Para onde vai o contacto do site.
//
// Estava escrito no codigo — um Gmail pessoal, num repositorio publico. Duas
// consequencias: o endereco fica exposto a quem clonar, e o canal comercial da
// empresa depende de uma conta pessoal, que ninguem mais consegue mudar sem
// alterar codigo e voltar a publicar a funcao.
//
// Passa a vir do ambiente. Defina o segredo no projeto:
//
//   supabase secrets set CONTACT_FORM_RECIPIENT="comercial@akuris.com.br"
//
// Aceita varios enderecos separados por virgula.
const DESTINO_PADRAO = "contato@akuris.com.br";

function destinatarios(): string[] {
  const bruto = Deno.env.get("CONTACT_FORM_RECIPIENT")?.trim();
  const lista = (bruto || DESTINO_PADRAO)
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (!bruto) {
    // Sem o segredo definido o contacto vai para o endereco do dominio. Se
    // esse alias nao existir, a mensagem fica gravada na base na mesma — o
    // registo nao se perde — mas ninguem e avisado. Daí o aviso no log.
    console.warn("CONTACT_FORM_RECIPIENT nao definido; a usar", DESTINO_PADRAO);
  }
  return lista;
}

interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  role?: string;
  companySize?: string;
  message?: string;
}

// Tetos de tamanho. A tabela nao tinha nenhum e aceitava mensagem de qualquer
// dimensao vinda de quem nao esta autenticado.
const LIMITES = { name: 120, email: 254, company: 160, phone: 40, role: 120, companySize: 80, message: 1000 };

/** SHA-256 em hexadecimal — e o formato que `consume_contact_form_attempt` exige. */
async function sha256Hex(valor: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(valor));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Devolve a primeira falha de validacao, ou null se estiver tudo bem. */
function validar(d: ContactFormData): string | null {
  const nome = (d?.name ?? "").trim();
  const email = (d?.email ?? "").trim();
  const empresa = (d?.company ?? "").trim();
  const tamanho = (d?.companySize ?? "").trim();
  if (!nome || !email || !empresa || !tamanho) return "Nome, e-mail, empresa e porte são obrigatórios";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "E-mail invalido";
  for (const [campo, max] of Object.entries(LIMITES)) {
    const v = (d as unknown as Record<string, string | undefined>)[campo];
    if (v && v.length > max) return `Campo ${campo} excede ${max} caracteres`;
  }
  return null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: authCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...authCorsHeaders(req) },
    });
  }

  try {
    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > 32 * 1024) {
      return new Response(JSON.stringify({ success: false, error: 'Payload muito grande' }), {
        status: 413,
        headers: { "Content-Type": "application/json", ...authCorsHeaders(req) },
      });
    }
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 32 * 1024) {
      return new Response(JSON.stringify({ success: false, error: 'Payload muito grande' }), {
        status: 413,
        headers: { "Content-Type": "application/json", ...authCorsHeaders(req) },
      });
    }
    const contactData: ContactFormData = JSON.parse(raw || '{}');

    const problema = validar(contactData);
    if (problema) {
      return new Response(JSON.stringify({ success: false, error: problema }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...authCorsHeaders(req) },
      });
    }

    // Chave de servico, nao a anon: a insercao deixa de depender de uma politica
    // aberta a `anon`, que era escrita anonima sem tecto nenhum na base.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // O limite ja existia na base — `consume_contact_form_attempt`, com bloqueio
    // de advisory e limpeza das linhas velhas — e nunca tinha sido chamado. O
    // que havia aqui era nada: qualquer um podia disparar o formulario em ciclo.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "desconhecido";
    const { data: podeSeguir, error: limiteError } = await supabase.rpc(
      "consume_contact_form_attempt",
      { p_fingerprint_hash: await sha256Hex(ip) },
    );
    if (limiteError) {
      console.error("Falha ao consultar limite do formulario:", limiteError);
      throw new Error("Failed to check rate limit");
    }
    if (podeSeguir !== true) {
      return new Response(
        JSON.stringify({ success: false, error: "Muitas tentativas. Tente novamente mais tarde." }),
        { status: 429, headers: { "Content-Type": "application/json", ...authCorsHeaders(req) } },
      );
    }

    // `select().single()` para termos o id: a marcacao de processado usava
    // `.eq(email).eq(name)`, que casa com qualquer envio anterior da mesma
    // pessoa — e corria com a chave anon, cuja politica de UPDATE exige
    // super admin, por isso falhava sempre e em silencio.
    const { data: submissao, error: dbError } = await supabase
      .from("contact_form_submissions")
      .insert({
        name: contactData.name.trim(),
        email: contactData.email.trim(),
        company: contactData.company?.trim() || null,
        phone: contactData.phone?.trim() || null,
        role: contactData.role?.trim() || null,
        company_size: contactData.companySize?.trim() || null,
        message: contactData.message?.trim() || null,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to save contact form data");
    }

    const emailBody = `
      <p style="margin:0 0 18px;color:#566276">Uma nova solicitação de demonstração foi registrada no site.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
        <tr><td style="padding:10px 0;color:#687589;width:34%">Nome</td><td style="padding:10px 0;font-weight:600">${escapeHtml(contactData.name)}</td></tr>
        <tr><td style="padding:10px 0;color:#687589">E-mail</td><td style="padding:10px 0"><a href="mailto:${escapeHtml(contactData.email)}" style="color:#5f43db">${escapeHtml(contactData.email)}</a></td></tr>
        <tr><td style="padding:10px 0;color:#687589">Empresa</td><td style="padding:10px 0">${escapeHtml(contactData.company)}</td></tr>
        <tr><td style="padding:10px 0;color:#687589">Porte</td><td style="padding:10px 0">${escapeHtml(contactData.companySize)}</td></tr>
        ${contactData.role ? `<tr><td style="padding:10px 0;color:#687589">Cargo</td><td style="padding:10px 0">${escapeHtml(contactData.role)}</td></tr>` : ""}
      </table>
      ${contactData.message ? `<div style="margin-top:22px;padding-top:20px;border-top:1px solid #e7ebf0"><p style="margin:0 0 8px;color:#687589;font-size:13px">Desafio informado</p><p style="margin:0;white-space:pre-line">${escapeHtml(contactData.message)}</p></div>` : ""}`;
    const emailHtml = emailDocument("Nova solicitação de demonstração", emailBody, { eyebrow: "Contato comercial" });
    const emailResponse = await resend.emails.send({
      from: EMAIL_FROM,
      to: destinatarios(),
      replyTo: contactData.email.trim(),
      subject: `[Novo contato] ${contactData.company?.trim()} — ${contactData.name.trim()}`,
      html: emailHtml,
      text: htmlToText(emailHtml),
    });

    console.log("Contact email sent successfully:", emailResponse);

    const { error: marcarError } = await supabase
      .from("contact_form_submissions")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", submissao.id);

    if (marcarError) {
      // Nao desfaz o envio — o e-mail ja saiu. Mas tem de aparecer no registo:
      // durante meses todas as submissoes ficaram "pendentes" por causa disto.
      console.error("Falha ao marcar submissao como processada:", marcarError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Mensagem enviada com sucesso!" 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...authCorsHeaders(req) },
      }
    );

  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Erro interno do servidor" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...authCorsHeaders(req) },
      }
    );
  }
};

serve(handler);
