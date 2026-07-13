import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      "activityImage": "https://akuris-grc.lovable.app/akuris-logo.png",
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
      ...(gravidade === 'critica' || gravidade === 'alta' ? { priority: { name: 'High' } } : {})
    }
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
    const verifier = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey);
    const { data: userData, error: userErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('empresa_id, role')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (!callerProfile?.empresa_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { empresa_id: bodyEmpresaId, evento, titulo, descricao, link, dados, gravidade, triggered_by, timestamp } = await req.json();

    if (!evento) {
      return new Response(
        JSON.stringify({ error: 'evento é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Force empresa_id to caller's own empresa (super_admin may target any tenant).
    const isSuperAdmin = callerProfile.role === 'super_admin';
    const empresa_id = isSuperAdmin && bodyEmpresaId ? bodyEmpresaId : callerProfile.empresa_id;

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

      try {
        let success = false;
        let responseStatus = 0;

        const fetchWithRetry = async (url: string, options: RequestInit, retries = 1): Promise<Response> => {
          const response = await fetch(url, options);
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

            const { data: fullConfig } = await supabase
              .from('integracoes_config')
              .select('credenciais_encrypted')
              .eq('id', integration.id)
              .single();

            let parsedCreds: any = null;
            try {
              parsedCreds = typeof fullConfig?.credenciais_encrypted === 'string'
                ? JSON.parse(fullConfig.credenciais_encrypted)
                : fullConfig?.credenciais_encrypted;
            } catch { parsedCreds = null; }

            const jiraToken = parsedCreds?.api_token;

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
