/**
 * avisar-vencimentos — os três avisos de prazo que ninguém disparava.
 *
 * `controle_vencendo`, `contrato_vencendo` e `plano_acao_vencido` estavam no
 * catálogo de integrações e ofereciam-se como caixas no Slack e no Teams.
 * Nenhum tinha emissor. Repare no padrão: são exactamente os três que alguém
 * liga — ninguém quer um aviso de «contrato criado», quer o de «contrato a
 * vencer» — e eram os três que nunca chegavam.
 *
 * E não podiam mesmo: um vencimento não acontece por alguém clicar. Acontece
 * porque o dia passou. Precisa de quem olhe o calendário todos os dias.
 *
 * Corre por empresa e reaproveita o `integration-webhook-dispatcher`, que já
 * sabe montar o payload de cada destino, respeitar os eventos que cada
 * integração escolheu e registar o envio em `integracoes_webhook_logs`.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

/** Quantos dias de antecedência valem um aviso. */
const JANELA_DIAS = 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const segredo = Deno.env.get('DAILY_REMINDER_SECRET') ?? '';
  if (!token || (token !== chaveServico && (!segredo || token !== segredo))) {
    return json({ error: 'nao_autorizado' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(url, chaveServico);

  const hoje = new Date();
  const limite = new Date(hoje.getTime() + JANELA_DIAS * 86400000)
    .toISOString()
    .slice(0, 10);
  const hojeISO = hoje.toISOString().slice(0, 10);

  /** Manda um evento pelo despachante que já existe. */
  const despachar = async (
    empresaId: string,
    evento: string,
    titulo: string,
    descricao: string,
    link: string,
    gravidade: 'baixa' | 'media' | 'alta' | 'critica',
    dados: Record<string, unknown>,
  ) => {
    const r = await fetch(`${url}/functions/v1/integration-webhook-dispatcher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chaveServico}` },
      body: JSON.stringify({
        empresa_id: empresaId,
        evento,
        titulo,
        descricao,
        link,
        gravidade,
        dados,
        timestamp: new Date().toISOString(),
      }),
    });
    if (!r.ok) console.error('despacho falhou', evento, r.status, await r.text());
    return r.ok;
  };

  try {
    const site = Deno.env.get('SITE_URL') ?? 'https://akuris.pt';
    const contagem = { controle_vencendo: 0, contrato_vencendo: 0, plano_acao_vencido: 0 };

    /* Controlos cuja próxima avaliação cai dentro da janela. */
    const { data: controles } = await supabase
      .from('controles')
      .select('id, nome, codigo, criticidade, proxima_avaliacao, empresa_id')
      .eq('status', 'ativo')
      .not('proxima_avaliacao', 'is', null)
      .gte('proxima_avaliacao', hojeISO)
      .lte('proxima_avaliacao', limite);

    for (const c of controles ?? []) {
      const grave = c.criticidade === 'critico' ? 'alta' : 'media';
      if (
        await despachar(
          c.empresa_id,
          'controle_vencendo',
          `Controle a vencer: ${c.codigo ? `${c.codigo} — ` : ''}${c.nome}`,
          `A próxima avaliação está marcada para ${c.proxima_avaliacao}.`,
          `${site}/governanca`,
          grave as 'alta' | 'media',
          { controle_id: c.id, proxima_avaliacao: c.proxima_avaliacao },
        )
      ) {
        contagem.controle_vencendo++;
      }
    }

    /* Contratos a expirar dentro da janela. */
    const { data: contratos } = await supabase
      .from('contratos')
      .select('id, nome, data_fim, empresa_id')
      .not('data_fim', 'is', null)
      .gte('data_fim', hojeISO)
      .lte('data_fim', limite);

    for (const c of contratos ?? []) {
      if (
        await despachar(
          c.empresa_id,
          'contrato_vencendo',
          `Contrato a vencer: ${c.nome}`,
          `A vigência termina em ${c.data_fim}.`,
          `${site}/contratos`,
          'media',
          { contrato_id: c.id, data_fim: c.data_fim },
        )
      ) {
        contagem.contrato_vencendo++;
      }
    }

    /*
      Planos de ação já vencidos — este olha para trás, não para a frente.
      Um plano cujo prazo passou e continua aberto é a definição de pendência.
    */
    const { data: planos } = await supabase
      .from('planos_acao')
      .select('id, titulo, prazo, status, prioridade, empresa_id')
      .not('prazo', 'is', null)
      .lt('prazo', hojeISO)
      /* Os estados reais da tabela são `pendente`, `em_andamento` e
         `concluido`. Listar variantes inventadas dava a ideia de cobrir mais
         do que existe. */
      .not('status', 'in', '("concluido","cancelado")');

    for (const p of planos ?? []) {
      if (
        await despachar(
          p.empresa_id,
          'plano_acao_vencido',
          `Plano de ação vencido: ${p.titulo}`,
          `O prazo era ${p.prazo} e o plano continua em «${p.status}».`,
          `${site}/planos-acao`,
          p.prioridade === 'critico' || p.prioridade === 'alto' ? 'alta' : 'media',
          { plano_id: p.id, prazo: p.prazo, status: p.status },
        )
      ) {
        contagem.plano_acao_vencido++;
      }
    }

    return json({ janela_dias: JANELA_DIAS, enviados: contagem });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'erro_inesperado' }, 500);
  }
});
