import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    const contactData: ContactFormData = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { error: dbError } = await supabase
      .from("contact_form_submissions")
      .insert({
        name: contactData.name,
        email: contactData.email,
        company: contactData.company,
        phone: contactData.phone,
        message: contactData.message,
      });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to save contact form data");
    }

    const emailResponse = await resend.emails.send({
      from: "Akuris <noreply@akuris.com.br>",
      to: ["henrique.mathews@gmail.com"],
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

    await supabase
      .from("contact_form_submissions")
      .update({ 
        status: "processed", 
        processed_at: new Date().toISOString() 
      })
      .eq("email", contactData.email)
      .eq("name", contactData.name)
      .order("created_at", { ascending: false })
      .limit(1);

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
