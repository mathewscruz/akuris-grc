import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1]), parseInt(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a >= 224) return true;
  }
  return false;
}

function validateUrl(rawUrl: string | undefined): { ok: true; url: string } | { ok: false; error: string } {
  if (!rawUrl) return { ok: false, error: 'URL não informada' };
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return { ok: false, error: 'URL inválida' }; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, error: 'Apenas URLs HTTP/HTTPS' };
  if (isPrivateOrLocalHost(parsed.hostname)) return { ok: false, error: 'URLs internas/privadas não são permitidas' };
  return { ok: true, url: parsed.toString() };
}

// Only forward a small allowlist of headers supplied by the caller (webhook auth patterns).
const ALLOWED_HEADER_PREFIXES = ['x-', 'authorization'];
function sanitizeHeaders(input: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  for (const [k, v] of Object.entries(input)) {
    const lk = k.toLowerCase();
    if (typeof v !== 'string' || v.length > 1024) continue;
    if (ALLOWED_HEADER_PREFIXES.some(p => lk.startsWith(p))) {
      out[k] = v;
    }
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AUTH ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const verifier = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { tipo, webhook_url, email, api_token, instance_url, project_key, headers } = await req.json();

    // Validate outbound URL against SSRF for all non-Jira cases; Jira uses instance_url.
    const urlToCheck = tipo === 'jira' ? instance_url : webhook_url;
    const check = validateUrl(urlToCheck);
    if (!check.ok) {
      return new Response(JSON.stringify({ success: false, error: check.error }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const safeHeaders = sanitizeHeaders(headers);


    let success = false;
    let errorMessage = '';

    switch (tipo) {
      case 'slack': {
        // Enviar mensagem de teste para Slack
        const slackPayload = {
          text: "🔗 *GovernAII - Teste de Conexão*",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "✅ *Conexão com GovernAII estabelecida com sucesso!*\n\nVocê receberá notificações neste canal."
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `📅 Teste realizado em ${new Date().toLocaleString('pt-BR')}`
                }
              ]
            }
          ]
        };

        const slackResponse = await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload)
        });

        success = slackResponse.ok;
        if (!success) {
          errorMessage = `Slack retornou status ${slackResponse.status}`;
        }
        break;
      }

      case 'teams': {
        // Enviar Adaptive Card para Teams
        const teamsPayload = {
          "@type": "MessageCard",
          "@context": "http://schema.org/extensions",
          "themeColor": "0D9488",
          "summary": "GovernAII - Teste de Conexão",
          "sections": [{
            "activityTitle": "✅ Conexão com GovernAII estabelecida!",
            "activitySubtitle": new Date().toLocaleString('pt-BR'),
            "activityImage": "https://akuris.com.br/akuris-logo.png",
            "facts": [{
              "name": "Status",
              "value": "Conectado com sucesso"
            }],
            "markdown": true
          }]
        };

        const teamsResponse = await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(teamsPayload)
        });

        success = teamsResponse.ok;
        if (!success) {
          errorMessage = `Teams retornou status ${teamsResponse.status}`;
        }
        break;
      }

      case 'webhook': {
        // Enviar payload de teste para webhook genérico
        const testPayload = {
          evento: "teste_conexao",
          timestamp: new Date().toISOString(),
          mensagem: "Teste de conexão do GovernAII",
          dados: {
            fonte: "GovernAII",
            tipo: "teste"
          }
        };

        const webhookHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(headers || {})
        };

        const webhookResponse = await fetch(webhook_url, {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify(testPayload)
        });

        // Aceita 2xx e alguns 3xx como sucesso
        success = webhookResponse.status >= 200 && webhookResponse.status < 400;
        if (!success) {
          errorMessage = `Webhook retornou status ${webhookResponse.status}`;
        }
        break;
      }

      case 'jira': {
        // Testar autenticação com Jira
        const auth = btoa(`${email}:${api_token}`);
        
        // Primeiro testar autenticação buscando o usuário atual
        const jiraResponse = await fetch(`${instance_url}/rest/api/3/myself`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        });

        if (!jiraResponse.ok) {
          success = false;
          errorMessage = `Falha na autenticação: ${jiraResponse.status}`;
          break;
        }

        // Se tiver project_key, verificar se o projeto existe
        if (project_key) {
          const projectResponse = await fetch(`${instance_url}/rest/api/3/project/${project_key}`, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            }
          });

          if (!projectResponse.ok) {
            success = false;
            errorMessage = `Projeto ${project_key} não encontrado`;
            break;
          }
        }

        success = true;
        break;
      }

      default:
        errorMessage = `Tipo de integração não suportado: ${tipo}`;
    }

    console.log(`Connection test result: ${success ? 'SUCCESS' : 'FAILED'} - ${errorMessage}`);

    return new Response(
      JSON.stringify({ success, error: errorMessage || null }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error testing connection:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error instanceof Error ? error.message : String(error)) || 'Erro ao testar conexão' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }
});
