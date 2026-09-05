import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { severidadeCanonica, isSevero } from '../_shared/severidade.ts';
import { validarUrlExterno } from '../_shared/ssrf.ts';
import { lerCredenciais } from '../_shared/credenciais.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface IntegrationConfig {
  id: string;
  tipo_integracao: string;
  webhook_url: string | null;
  configuracoes: {
    eventos?: string[];
    headers?: Record<string, string>;
  };
  status: string;
}

// Formata evento bruto para texto legível
function formatEvento(evento: string): string {
  return evento
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Extrai módulo do nome do evento
function extrairModulo(evento: string): string {
  const map: Record<string, string> = {
    'incidente': 'Incidentes',
    'risco': 'Riscos',
    'controle': 'Controles',
    'ativo': 'Ativos',
    'documento': 'Documentos',
    'auditoria': 'Auditorias',
    'contrato': 'Contratos',
    'denuncia': 'Denúncias',
    
    'chave': 'Chaves Criptográficas',
    'licenca': 'Licenças',
    'conta': 'Contas Privilegiadas',
    'revisao': 'Revisão de Acessos',
    'plano': 'Planos de Ação',
    'due_diligence': 'Due Diligence',
    'gap': 'Gap Analysis',
  };
  const lower = evento.toLowerCase();
  for (const [key, label] of Object.entries(map)) {
    if (lower.includes(key)) return label;
  }
  return 'Akuris';
}

// Formata gravidade para exibição
function formatGravidade(gravidade: string | undefined): { label: string; emoji: string; color: string } {
  switch (gravidade?.toLowerCase()) {
    case 'critica': return { label: 'Crítica', emoji: '🔴', color: 'FF0000' };
    case 'alta': return { label: 'Alta', emoji: '🟠', color: 'FFA500' };
    case 'media': return { label: 'Média', emoji: '🟡', color: 'FFD700' };
    case 'baixa': return { label: 'Baixa', emoji: '🟢', color: '00C853' };
    default: return { label: gravidade || 'Não definida', emoji: 'ℹ️', color: '607D8B' };
  }
}

function buildSlackPayload(titulo: string, descricao: string | undefined, evento: string, gravidade: string | undefined, link: string | undefined, dados: any, timestamp: string | undefined) {
  const grav = formatGravidade(gravidade);
  const modulo = extrairModulo(evento);
  const eventoFormatado = formatEvento(evento);
  const ts = new Date(timestamp || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${grav.emoji} ${titulo}`, emoji: true }
    },
    { type: "divider" },
  ];

  if (descricao) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: descricao }
    });
  }

  // Campos estruturados
  const fields: any[] = [
    { type: "mrkdwn", text: `*📦 Módulo:*\n${modulo}` },
    { type: "mrkdwn", text: `*📋 Evento:*\n${eventoFormatado}` },
    { type: "mrkdwn", text: `*⚠️ Gravidade:*\n${grav.emoji} ${grav.label}` },
    { type: "mrkdwn", text: `*🕐 Data/Hora:*\n${ts}` },
  ];

  if (dados?.responsavel) {
    fields.push({ type: "mrkdwn", text: `*👤 Responsável:*\n${dados.responsavel}` });
  }
  if (dados?.status) {
    fields.push({ type: "mrkdwn", text: `*📊 Status:*\n${dados.status}` });
  }

  blocks.push({ type: "section", fields });

  // Dados adicionais relevantes
  const extras: string[] = [];
  if (dados?.id) extras.push(`*ID:* ${dados.id}`);
  if (dados?.categoria) extras.push(`*Categoria:* ${dados.categoria}`);
  if (dados?.prazo) extras.push(`*Prazo:* ${dados.prazo}`);
  if (dados?.impacto) extras.push(`*Impacto:* ${dados.impacto}`);

  if (extras.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: extras.join(' | ') }]
    });
  }

  if (link) {
    blocks.push({
      type: "actions",
      elements: [{
        type: "button",
        text: { type: "plain_text", text: "📎 Ver no Akuris", emoji: true },
        url: link,
        style: "primary"
      }]
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `_Enviado por Akuris GRC Platform_` }]
  });

  return { blocks };
}

function buildTeamsPayload(titulo: string, descricao: string | undefined, evento: string, gravidade: string | undefined, link: string | undefined, dados: any, timestamp: string | undefined) {
  const grav = formatGravidade(gravidade);
  const modulo = extrairModulo(evento);
  const eventoFormatado = formatEvento(evento);
  const ts = new Date(timestamp || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const facts = [
    { name: "Módulo", value: modulo },
    { name: "Evento", value: eventoFormatado },
    { name: "Gravidade", value: `${grav.emoji} ${grav.label}` },
    { name: "Data/Hora", value: ts },
  ];

  if (dados?.responsavel) facts.push({ name: "Responsável", value: dados.responsavel });
  if (dados?.status) facts.push({ name: "Status", value: dados.status });
  if (dados?.categoria) facts.push({ name: "Categoria", value: dados.categoria });
  if (dados?.id) facts.push({ name: "ID do Registro", value: dados.id });
  if (dados?.prazo) facts.push({ name: "Prazo", value: dados.prazo });

  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": grav.color,
    "summary": titulo,
    "sections": [{
      "activityTitle": `${grav.emoji} ${titulo}`,
      "activitySubtitle": `${modulo} • ${ts}`,
      "activityImage": "https://akuris.pt/akuris-logo.png",
      "facts": facts,
      "text": descricao || '',
      "markdown": true
    }],
    ...(link ? {
      "potentialAction": [{
        "@type": "OpenUri",
        "name": "📎 Ver no Akuris",
        "targets": [{ "os": "default", "uri": link }]
      }]
    } : {})
  };
}

function buildJiraPayload(titulo: string, descricao: string | undefined, evento: string, gravidade: string | undefined, link: string | undefined, dados: any, timestamp: string | undefined, jiraProjectKey: string, jiraIssueType: string) {
  const grav = formatGravidade(gravidade);
  const modulo = extrairModulo(evento);
  const eventoFormatado = formatEvento(evento);
  const ts = new Date(timestamp || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  let fullDescription = `*Descrição:*\n${descricao || 'Sem descrição'}\n\n`;
  fullDescription += `----\n\n`;
  fullDescription += `*Detalhes do Evento Akuris:*\n`;
  fullDescription += `||Campo||Valor||\n`;
  fullDescription += `|Módulo|${modulo}|\n`;
  fullDescription += `|Evento|${eventoFormatado}|\n`;
  fullDescription += `|Gravidade|${grav.emoji} ${grav.label}|\n`;
  fullDescription += `|Data/Hora|${ts}|\n`;

  if (dados?.responsavel) fullDescription += `|Responsável|${dados.responsavel}|\n`;
  if (dados?.status) fullDescription += `|Status|${dados.status}|\n`;
  if (dados?.categoria) fullDescription += `|Categoria|${dados.categoria}|\n`;
  if (dados?.id) fullDescription += `|ID Registro|${dados.id}|\n`;
  if (dados?.prazo) fullDescription += `|Prazo|${dados.prazo}|\n`;
  if (dados?.impacto) fullDescription += `|Impacto|${dados.impacto}|\n`;

  if (link) fullDescription += `\n*Link:* [Ver no Akuris|${link}]\n`;

  const labels = ['akuris', 'grc', modulo.toLowerCase().replace(/\s+/g, '-').replace(/[áàã]/g, 'a').replace(/[éê]/g, 'e').replace(/[íî]/g, 'i').replace(/[óôõ]/g, 'o').replace(/[úû]/g, 'u').replace(/ç/g, 'c')];

  return {
    fields: {
      project: { key: jiraProjectKey },
      summary: `[Akuris] ${titulo}`,
      description: fullDescription,
      issuetype: { name: jiraIssueType },
      labels: labels,
      ...(isSevero(gravidade) ? { priority: { name: 'High' } } : {})
    }
  };
}

/**
 * ServiceNow — a Table API, e a matriz de prioridade que ela espera.
 *
 * O ServiceNow não aceita uma «gravidade»: calcula a prioridade a partir de
 * `impact` × `urgency`, ambos de 1 a 3. Mandar só um dos dois deixa o outro no
 * valor por omissão e o chamado entra como P5, que é onde os chamados morrem.
 *
 * `correlation_id` é o que evita duplicado: se o mesmo evento do mesmo registo
 * for despachado duas vezes — um reenvio, uma repetição — a instância sabe que
 * é o mesmo. Sem ele, cada tentativa abre um chamado novo.
 */
function buildServiceNowPayload(titulo: string, descricao: string | undefined, evento: string, gravidade: string | undefined, link: string | undefined, dados: any, timestamp: string | undefined, categoria: string) {
  const grav = formatGravidade(gravidade);
  const modulo = extrairModulo(evento);
  const ts = new Date(timestamp || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const MATRIZ: Record<string, { impact: string; urgency: string }> = {
    critica: { impact: '1', urgency: '1' },
    alta: { impact: '1', urgency: '2' },
    media: { impact: '2', urgency: '2' },
    baixa: { impact: '3', urgency: '3' },
  };
  const escala = MATRIZ[(gravidade || 'media').toLowerCase()] || MATRIZ.media;

  let corpo = `${descricao || 'Sem descrição'}\n\n`;
  corpo += `--- Detalhes do evento Akuris ---\n`;
  corpo += `Módulo: ${modulo}\n`;
  corpo += `Evento: ${formatEvento(evento)}\n`;
  corpo += `Gravidade: ${grav.label}\n`;
  corpo += `Data/Hora: ${ts}\n`;
  if (dados?.responsavel) corpo += `Responsável: ${dados.responsavel}\n`;
  if (dados?.status) corpo += `Status: ${dados.status}\n`;
  if (dados?.prazo) corpo += `Prazo: ${dados.prazo}\n`;
  if (dados?.id) corpo += `ID no Akuris: ${dados.id}\n`;
  if (link) corpo += `\nAbrir no Akuris: ${link}\n`;

  return {
    short_description: `[Akuris] ${titulo}`,
    description: corpo,
    category: categoria,
    impact: escala.impact,
    urgency: escala.urgency,
    correlation_id: `akuris:${evento}:${dados?.id ?? timestamp ?? ''}`,
    correlation_display: 'Akuris GRC',
  };
}

function buildWebhookPayload(titulo: string, descricao: string | undefined, evento: string, gravidade: string | undefined, link: string | undefined, dados: any, timestamp: string | undefined, empresa_id: string) {
  const grav = formatGravidade(gravidade);
  const modulo = extrairModulo(evento);

  return {
    fonte: 'Akuris',
    versao: '2.0',
    evento,
    evento_label: formatEvento(evento),
    modulo,
    timestamp: timestamp || new Date().toISOString(),
    titulo,
    descricao,
    link,
    gravidade: gravidade || null,
    gravidade_label: grav.label,
    gravidade_emoji: grav.emoji,
    dados: dados || {},
    empresa_id,
    metadata: {
      responsavel: dados?.responsavel || null,
      status: dados?.status || null,
      categoria: dados?.categoria || null,
      prazo: dados?.prazo || null,
      impacto: dados?.impacto || null,
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AUTH: require valid Supabase JWT ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    /*
      Segunda porta: chamada interna com a chave de serviço.

      Exigir sempre um JWT de utilizador deixava de fora o evento que mais
      interessa neste produto — `denuncia_recebida`. Uma denúncia entra pelo
      portal público, sem sessão nenhuma, e por isso NUNCA houve forma de a
      recepção chegar às integrações: quem ligasse «Denúncia recebida» ao Slack
      não era avisado ao receber uma denúncia.

      A chave de serviço só existe do lado do servidor, e é o mesmo padrão que
      `send-denuncia-notification` já usa. Com ela, o `empresa_id` vem do corpo
      — não há chamador com quem o confrontar — e por isso a porta fica limitada
      a chamadas internas.
    */
    const token = authHeader.replace('Bearer ', '');
    const chamadaInterna = token === supabaseServiceKey;

    let callerProfile: { empresa_id: string; role: string } | null = null;
    if (!chamadaInterna) {
      const verifier = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey);
      const { data: userData, error: userErr } = await verifier.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('empresa_id, role')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (!perfil?.empresa_id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      callerProfile = perfil as { empresa_id: string; role: string };
    }

    const { empresa_id: bodyEmpresaId, evento, titulo, descricao, link, dados, gravidade, triggered_by, timestamp } = await req.json();

    if (!evento) {
      return new Response(
        JSON.stringify({ error: 'evento é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Force empresa_id to caller's own empresa (super_admin may target any tenant).
    const isSuperAdmin = callerProfile?.role === 'super_admin';
    const empresa_id = chamadaInterna
      ? bodyEmpresaId
      : (isSuperAdmin && bodyEmpresaId ? bodyEmpresaId : callerProfile!.empresa_id);

    if (!empresa_id) {
      return new Response(
        JSON.stringify({ error: 'empresa_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Dispatching event: ${evento} for empresa: ${empresa_id}`);


    const { data: integrations, error: fetchError } = await supabase
      .from('integracoes_config')
      .select('*')
      .eq('empresa_id', empresa_id)
      .eq('status', 'conectado');

    if (fetchError) {
      console.error('Erro ao buscar integrações:', fetchError);
      throw fetchError;
    }

    if (!integrations || integrations.length === 0) {
      console.log('Nenhuma integração ativa encontrada');
      return new Response(
        JSON.stringify({ dispatched: 0, message: 'Nenhuma integração ativa' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { tipo: string; success: boolean; error?: string }[] = [];

    for (const integration of integrations as IntegrationConfig[]) {
      const eventosConfigurados = integration.configuracoes?.eventos || [];
      if (eventosConfigurados.length > 0 && !eventosConfigurados.includes(evento)) {
        console.log(`Evento ${evento} não configurado para ${integration.tipo_integracao}`);
        continue;
      }

      if (!integration.webhook_url) {
        console.log(`Webhook URL não configurada para ${integration.tipo_integracao}`);
        continue;
      }

      /*
        SSRF: o `webhook_url` é escrito pelo cliente (a instância do Jira, do
        ServiceNow, o webhook do Slack) e todos os destinos abaixo fazem `fetch`
        a ele. Sem esta linha, «a minha instância Jira é http://169.254.169.254»
        faz o servidor buscar as credenciais IAM da máquina e enviá-las adiante.
        Um só ponto de estrangulamento, porque todos os ramos usam este campo.
      */
      const alvo = validarUrlExterno(integration.webhook_url);
      if (!alvo.ok) {
        console.error(`SSRF bloqueado para ${integration.tipo_integracao}: ${alvo.error} (${integration.webhook_url})`);
        await supabase.from('integracoes_webhook_logs').insert({
          integracao_id: integration.id,
          evento,
          payload: { titulo, descricao, link, dados, gravidade },
          status_code: 0,
          sucesso: false,
          resposta: { error: `destino recusado: ${alvo.error}` },
          empresa_id,
        });
        results.push({ tipo: integration.tipo_integracao, success: false, error: alvo.error });
        continue;
      }

      try {
        let success = false;
        let responseStatus = 0;

        const fetchWithRetry = async (url: string, options: RequestInit, retries = 1): Promise<Response> => {
          const response = await fetch(url, { ...options, redirect: 'error' });
          if (!response.ok && response.status >= 500 && retries > 0) {
            console.log(`Retrying ${url} after ${response.status}...`);
            await new Promise(r => setTimeout(r, 2000));
            return fetchWithRetry(url, options, retries - 1);
          }
          return response;
        };

        switch (integration.tipo_integracao) {
          case 'slack': {
            const slackPayload = buildSlackPayload(titulo, descricao, evento, gravidade, link, dados, timestamp);
            const slackResponse = await fetchWithRetry(integration.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(slackPayload)
            });
            success = slackResponse.ok;
            responseStatus = slackResponse.status;
            break;
          }

          case 'teams': {
            const teamsPayload = buildTeamsPayload(titulo, descricao, evento, gravidade, link, dados, timestamp);
            const teamsResponse = await fetchWithRetry(integration.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(teamsPayload)
            });
            success = teamsResponse.ok;
            responseStatus = teamsResponse.status;
            break;
          }

          case 'webhooks': {
            const webhookPayload = buildWebhookPayload(titulo, descricao, evento, gravidade, link, dados, timestamp, empresa_id);
            const webhookHeaders: Record<string, string> = {
              'Content-Type': 'application/json',
              ...(integration.configuracoes?.headers || {})
            };
            const webhookResponse = await fetchWithRetry(integration.webhook_url, {
              method: 'POST',
              headers: webhookHeaders,
              body: JSON.stringify(webhookPayload)
            });
            success = webhookResponse.status >= 200 && webhookResponse.status < 400;
            responseStatus = webhookResponse.status;
            break;
          }

          case 'jira': {
            const jiraConfig: any = integration.configuracoes || {};
            const jiraInstanceUrl = (integration.webhook_url || '').replace(/\/+$/, '');
            const jiraEmail = jiraConfig.email as string;
            const jiraProjectKey = (jiraConfig.project_key as string) || 'GRC';
            const jiraIssueType = (jiraConfig.issue_type as string) || 'Task';

            /* Segredo cifrado em repouso: decifra no servidor, via RPC. */
            const parsedCreds = await lerCredenciais(supabase, integration.id);
            const jiraToken = parsedCreds?.api_token as string | undefined;

            if (!jiraInstanceUrl || !jiraEmail || !jiraToken) {
              console.error('Jira credentials incomplete');
              success = false;
              responseStatus = 0;
              break;
            }

            const jiraPayload = buildJiraPayload(titulo, descricao, evento, gravidade, link, dados, timestamp, jiraProjectKey, jiraIssueType);

            const jiraAuth = btoa(`${jiraEmail}:${jiraToken}`);
            const jiraResponse = await fetch(`${jiraInstanceUrl}/rest/api/3/issue`, {
              method: 'POST',
              redirect: 'error',
              headers: {
                'Authorization': `Basic ${jiraAuth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(jiraPayload)
            });

            success = jiraResponse.ok;
            responseStatus = jiraResponse.status;

            if (success) {
              const jiraData = await jiraResponse.json();
              console.log(`Jira ticket created: ${jiraData.key}`);
            } else {
              const errBody = await jiraResponse.text();
              console.error(`Jira API error: ${errBody}`);
            }
            break;
          }

          case 'servicenow': {
            const snConfig: any = integration.configuracoes || {};
            const snInstancia = (integration.webhook_url || '').replace(/\/+$/, '');
            const snUtilizador = snConfig.utilizador as string;
            const snTabela = (snConfig.tabela as string) || 'incident';
            const snCategoria = (snConfig.categoria as string) || 'inquiry';

            const snCreds = await lerCredenciais(supabase, integration.id);
            const snSenha = snCreds?.senha as string | undefined;

            if (!snInstancia || !snUtilizador || !snSenha) {
              console.error('ServiceNow credentials incomplete');
              success = false;
              responseStatus = 0;
              break;
            }

            const snPayload = buildServiceNowPayload(titulo, descricao, evento, gravidade, link, dados, timestamp, snCategoria);
            const snAuth = btoa(`${snUtilizador}:${snSenha}`);

            const snResponse = await fetch(`${snInstancia}/api/now/table/${snTabela}`, {
              method: 'POST',
              redirect: 'error',
              headers: {
                'Authorization': `Basic ${snAuth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(snPayload)
            });

            success = snResponse.ok;
            responseStatus = snResponse.status;

            if (success) {
              const snData = await snResponse.json();
              console.log(`ServiceNow record created: ${snData?.result?.number ?? '(sem numero)'}`);
            } else {
              console.error(`ServiceNow API error: ${await snResponse.text()}`);
            }
            break;
          }
        }

        await supabase.from('integracoes_webhook_logs').insert({
          integracao_id: integration.id,
          evento,
          payload: { titulo, descricao, link, dados, gravidade },
          status_code: responseStatus,
          sucesso: success,
          empresa_id
        });

        results.push({ tipo: integration.tipo_integracao, success });
        console.log(`Dispatched to ${integration.tipo_integracao}: ${success ? 'SUCCESS' : 'FAILED'}`);

      } catch (integrationError) {
        console.error(`Error dispatching to ${integration.tipo_integracao}:`, integrationError);

        await supabase.from('integracoes_webhook_logs').insert({
          integracao_id: integration.id,
          evento,
          payload: { titulo, descricao, link, dados, gravidade },
          status_code: 0,
          sucesso: false,
          resposta: { error: (integrationError instanceof Error ? integrationError.message : String(integrationError)) },
          empresa_id
        });

        results.push({ tipo: integration.tipo_integracao, success: false, error: (integrationError instanceof Error ? integrationError.message : String(integrationError)) });
      }
    }

    return new Response(
      JSON.stringify({
        dispatched: results.filter(r => r.success).length,
        total: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Dispatcher error:', error);
    return new Response(
      JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
