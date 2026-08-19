import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message: string;
}

// Tetos de tamanho. A tabela nao tinha nenhum e aceitava mensagem de qualquer
// dimensao vinda de quem nao esta autenticado.
const LIMITES = { name: 120, email: 254, company: 160, phone: 40, message: 4000 };

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
  const mensagem = (d?.message ?? "").trim();
  if (!nome || !email || !mensagem) return "Nome, e-mail e mensagem sao obrigatorios";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "E-mail invalido";
  for (const [campo, max] of Object.entries(LIMITES)) {
    const v = (d as Record<string, string | undefined>)[campo];
    if (v && v.length > max) return `Campo ${campo} excede ${max} caracteres`;
  }
  return null;
}

function escapeHtml(s: string | undefined | null): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const contactData: ContactFormData = await req.json().catch(() => ({}));

    const problema = validar(contactData);
    if (problema) {
      return new Response(JSON.stringify({ success: false, error: problema }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
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
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
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
        message: contactData.message.trim(),
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to save contact form data");
    }

    const emailResponse = await resend.emails.send({
      from: "Akuris <noreply@akuris.com.br>",
      to: destinatarios(),
      subject: `Novo contato pelo site - ${contactData.name}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f7fa; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
            <div style="background-color: #0a1628; padding: 32px; text-align: center;">
              <img src="https://akuris-grc.lovable.app/akuris-logo-email.png" alt="Akuris" width="200" height="60" style="display: block; margin: 0 auto;" />
            </div>
            <div style="height: 3px; background: linear-gradient(90deg, #7552ff, #5a3fd6, #7552ff);"></div>
            
            <div style="padding: 32px;">
              <div style="background-color: #f0eeff; padding: 20px; border-radius: 8px; border-left: 4px solid #7552ff; margin-bottom: 24px;">
                <p style="margin: 0 0 8px;"><strong>Nome:</strong> ${escapeHtml(contactData.name)}</p>
                <p style="margin: 0 0 8px;"><strong>E-mail:</strong> ${escapeHtml(contactData.email)}</p>
                ${contactData.company ? `<p style="margin: 0 0 8px;"><strong>Empresa:</strong> ${escapeHtml(contactData.company)}</p>` : ''}
                ${contactData.phone ? `<p style="margin: 0;"><strong>Telefone:</strong> ${escapeHtml(contactData.phone)}</p>` : ''}
              </div>
              
              <h3 style="color: #0a1628; margin: 0 0 12px;">Mensagem:</h3>
              <div style="background-color: #ffffff; border-left: 4px solid #7552ff; padding: 15px; margin: 0 0 24px; border-radius: 4px; background-color: #f8fafc;">
                ${escapeHtml(contactData.message).replace(/\n/g, '<br>')}
              </div>
            </div>
            
            <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="color: #8898aa; font-size: 12px; margin: 0;">
                Este e-mail foi enviado automaticamente pelo formulário de contato do site Akuris.
              </p>
              <p style="color: #8898aa; font-size: 12px; margin: 8px 0 0;">
                © ${new Date().getFullYear()} Akuris. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </div>
      `,
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
        headers: { "Content-Type": "application/json", ...corsHeaders },
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
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
