import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validarUrlExterno } from '../_shared/ssrf.ts';
import { requireUserContext, requireValidMfa, authErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    const ctx = await requireUserContext(req);
    await requireValidMfa(ctx);
    if (!['admin', 'super_admin'].includes(ctx.role || '')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > 32 * 1024) {
      return new Response(JSON.stringify({ success: false, error: 'Payload muito grande' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 32 * 1024) {
      return new Response(JSON.stringify({ success: false, error: 'Payload muito grande' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Payload inválido');

    const { data: withinLimit, error: rateError } = await ctx.supabase.rpc('consume_security_rate_limit', {
      p_scope: 'test-integration-connection',
      p_fingerprint_hash: await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ctx.userId))
        .then((digest) => Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')),
      p_max_requests: 20,
      p_window_seconds: 600,
    });
    if (rateError || withinLimit !== true) {
      return new Response(JSON.stringify({ success: false, error: rateError ? 'Serviço indisponível' : 'Muitas tentativas' }), {
        status: rateError ? 503 : 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tipo, webhook_url, email, api_token, instance_url, project_key, headers, utilizador, senha, tabela } = parsed;
    if (!['slack', 'teams', 'webhook', 'jira', 'servicenow'].includes(tipo)) {
      throw new Error('Tipo de integração não suportado');
    }

    /*
      SSRF: o que se valida é o URL para onde vamos sair.

      Jira e ServiceNow não usam webhook: apontam para a instância do cliente,
      e é esse endereço que tem de passar pela validação. Esquecê-lo aqui
      transformaria o teste de conexão num scanner da rede interna.
    */
    const urlToCheck = tipo === 'jira' || tipo === 'servicenow' ? instance_url : webhook_url;
    const check = validarUrlExterno(urlToCheck);
    if (!check.ok) {
      return new Response(JSON.stringify({ success: false, error: check.error }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const safeHeaders = sanitizeHeaders(headers);


    let success = false;
    let errorMessage = '';
    /* Descoberta: o que o teste conseguiu ler do outro lado, para o ecra
       poder oferecer listas em vez de pedir para adivinhar. */
    let projetos: Array<{ key: string; name: string }> = [];
    let tiposDeItem: string[] = [];

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
          redirect: 'error',
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
            "activityImage": "https://akuris.pt/akuris-logo.png",
            "facts": [{
              "name": "Status",
              "value": "Conectado com sucesso"
            }],
            "markdown": true
          }]
        };

        const teamsResponse = await fetch(webhook_url, {
          method: 'POST',
          redirect: 'error',
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
          ...safeHeaders,
        };


        const webhookResponse = await fetch(webhook_url, {
          method: 'POST',
          redirect: 'error',
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
        /*
          O teste nao se limita a dizer "autenticou".

          A chave do projeto era caixa de texto e o tipo de item uma lista de
          cinco valores fixos -- que podem simplesmente nao existir na
          instancia do cliente. Escrevia-se "GRC", gravava-se, o cartao ficava
          verde, e o erro so aparecia no primeiro evento a serio: um 400 do
          Jira dentro de um log que ninguem abre.

          Agora o teste traz de volta os projetos a que esta conta tem acesso
          e, quando ja ha projeto escolhido, os tipos de item DESSE projeto. O
          ecra deixa de pedir para adivinhar e passa a oferecer uma lista.
        */
        const auth = btoa(`${email}:${api_token}`);
        const cabecalhos = {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        };

        const jiraResponse = await fetch(`${instance_url}/rest/api/3/myself`, {
          method: 'GET',
          redirect: 'error',
          headers: cabecalhos
        });

        if (!jiraResponse.ok) {
          success = false;
          errorMessage = jiraResponse.status === 401
            ? 'Falha na autenticacao: confira o e-mail e o token de API'
            : `Falha na autenticacao: ${jiraResponse.status}`;
          break;
        }

        const projRes = await fetch(
          `${instance_url}/rest/api/3/project/search?maxResults=100&orderBy=name`,
          { method: 'GET', redirect: 'error', headers: cabecalhos }
        );
        if (projRes.ok) {
          const corpoProj = await projRes.json();
          projetos = (corpoProj.values || []).map((pr: any) => ({ key: pr.key, name: pr.name }));
        }

        /*
           Autenticar e nao ver projeto nenhum e um problema de permissao, e
           vale a pena dize-lo agora -- e nao no primeiro incidente critico.
        */
        if (projetos.length === 0) {
          success = false;
          errorMessage = 'A conta autentica mas nao ve nenhum projeto. Confirme as permissoes do utilizador de integracao.';
          break;
        }

        if (project_key) {
          if (!projetos.some((pr) => pr.key === project_key)) {
            success = false;
            errorMessage = `Projeto ${project_key} nao encontrado nesta instancia`;
            break;
          }

          /* Tipos de item DESTE projeto. Falhar aqui nao invalida o teste: o
             ecra cai na lista de sempre e a pessoa escolhe a mao. */
          const tiposRes = await fetch(
            `${instance_url}/rest/api/3/issue/createmeta/${project_key}/issuetypes`,
            { method: 'GET', redirect: 'error', headers: cabecalhos }
          );
          if (tiposRes.ok) {
            const corpoTipos = await tiposRes.json();
            tiposDeItem = (corpoTipos.issueTypes || corpoTipos.values || [])
              .filter((tp: any) => !tp.subtask)
              .map((tp: any) => tp.name);
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
      JSON.stringify({ success, error: errorMessage || null, projetos, tiposDeItem }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    if ((error as any)?.status) return authErrorResponse(error, corsHeaders);
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
