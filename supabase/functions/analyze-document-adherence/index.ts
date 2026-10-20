import { fetchIA, rotularFuncaoIA } from '../_shared/ai.ts';
rotularFuncaoIA('analyze_document_adherence');
// Análise de aderência de documento a um framework — em segundo plano.
//
// Antes: uma única chamada lia só os primeiros 30k caracteres e avaliava tudo
// de uma vez; documentos/frameworks grandes estouravam o tempo (503).
// Agora: o pedido do usuário cria um "trabalho" (analise_aderencia_jobs) e
// responde na hora. Cada invocação interna faz uma fatia curta (até 3 trechos
// ou 3 lotes), grava o progresso e chama a próxima. Sem limite de tamanho.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { MODELOS } from '../_shared/modelos.ts';
import { fetchWithTimeout, fetchAnaliseComReserva } from '../_shared/ai.ts';
import {
  comRepeticao, dividirEmLotes, emPool, juntarLotes, IaIndisponivelError,
  dividirTexto, orcamentoResumo, proximosPendentes, LIMITE_TEXTO_DIRETO,
  calcularVeredito, compararVersoes, extrairTitulos,
} from './lotes.ts';
import { temCreditoIA, semCreditoIA } from '../_shared/creditos.ts';
import { computeAnalyzedScore, resolveResultadoGeral, resolveDocumentScope } from "../_shared/compliance-score.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AI_KEY = Deno.env.get('LOVABLE_API_KEY') || '';
const GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const POR_FATIA = 3;
const TAM_LOTE = 25;

class BloqueioIA extends Error {}

// ---------- encadeamento ----------
function agendarProximo(jobId: string, atrasoMs = 1000) {
  const p = (async () => {
    await new Promise((r) => setTimeout(r, atrasoMs));
    await fetch(`${SUPABASE_URL}/functions/v1/analyze-document-adherence`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_step: true, jobId }),
    }).then((r) => r.text()).catch((e) => console.error('Falha ao agendar próxima fatia:', e));
  })();
  const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
}

// ---------- chamadas à IA ----------
async function chamarIA(model: string, system: string, user: string, maxTokens: number, timeoutMs = 50000): Promise<string> {
  const resp = await comRepeticao(() => fetchAnaliseComReserva(GATEWAY, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  }, timeoutMs));
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    console.error('AI gateway error:', resp.status, txt.slice(0, 300));
    if (resp.status === 402) throw new BloqueioIA('Créditos de IA insuficientes.');
    if (resp.status === 403) throw new BloqueioIA('Acesso à IA bloqueado para esta conta.');
    throw new IaIndisponivelError();
  }
  const j = await resp.json();
  return String(j.choices?.[0]?.message?.content || '');
}

async function resumirTrecho(trecho: string, idx: number, total: number, framework: string, limite: number): Promise<string> {
  const txt = await chamarIA(MODELOS.ANALISE,
    'Você extrai evidências de documentos corporativos para auditoria de conformidade. Responda só com o texto pedido.',
    `Este é o trecho ${idx + 1} de ${total} de um documento que será auditado contra ${framework}.
Extraia, em até ${limite} caracteres, tudo que possa servir de evidência de conformidade: políticas, responsabilidades, controles, prazos, procedimentos, papéis, revisões, registros, sanções. Cite frases literais entre aspas sempre que possível e indique o título da seção. Não invente nada.

TRECHO:
---
${trecho}
---`, Math.ceil(limite / 2.5));
  return `### Trecho ${idx + 1}/${total}\n${txt.slice(0, limite + 400)}`;
}

function montarReqsText(lote: any[]) {
  return lote.map((r: any, i: number) => {
    let e = `${i + 1}. ID:${r.id} | ${r.codigo || 'N/A'}: ${r.titulo}`;
    if (r.descricao) e += `\n   Descrição: ${String(r.descricao).substring(0, 300)}`;
    if (r.orientacao_implementacao) e += `\n   O que a norma exige: ${String(r.orientacao_implementacao).substring(0, 200)}`;
    if (r.exemplos_evidencias) e += `\n   Evidências esperadas: ${String(r.exemplos_evidencias).substring(0, 150)}`;
    return e;
  }).join('\n\n');
}

function montarPrompt(ctx: any, lote: any[], documento: string, resumido: boolean) {
  return `Você é um AUDITOR SÊNIOR de conformidade regulatória (ISO 27001, LGPD, NIST CSF, SOC 2, GDPR, PCI DSS e outros).

TAREFA: compare ITEM A ITEM o documento com os requisitos do framework ${ctx.framework_nome} (${ctx.framework_versao || ''}).
${resumido ? 'O documento é extenso; abaixo estão as EVIDÊNCIAS EXTRAÍDAS de todos os seus trechos (citações literais entre aspas). Considere-as como o conteúdo do documento.\n' : ''}
MÉTODO:
1. Identifique tipo e escopo do documento
2. Para CADA requisito, verifique se há cláusulas que o atendem e CITE trechos como evidência
3. Se não aborda, indique o GAP
4. "nao_aplicavel" APENAS se o requisito não se relaciona com o escopo
5. "conforme" = cobre adequadamente; "parcial" = incompleto; "nao_conforme" = ausente
6. OBRIGATÓRIO: "requisitos_analisados" para TODOS os ${lote.length} requisitos abaixo
${ctx.coverage_block || ''}

DOCUMENTO:
---
${documento}
---

REQUISITOS (${lote.length} de ${ctx.total_escopo}):
${montarReqsText(lote)}

FORMATO JSON OBRIGATÓRIO (apenas JSON válido, sem markdown):
{
  "documento_tipo_identificado": "string",
  "documento_escopo_identificado": "string curta",
  "total_requisitos_relevantes": número,
  "pontos_fortes": [{"titulo": "max 60", "descricao": "max 150"}],
  "pontos_melhoria": [{"titulo": "max 60", "descricao": "max 150", "prioridade": "alta|media|baixa"}],
  "requisitos_analisados": [{
    "requirement_id": "UUID exato", "requisito_codigo": "código",
    "status_aderencia": "conforme"|"nao_conforme"|"parcial"|"nao_aplicavel",
    "evidencias_encontradas": "max 120", "gaps_especificos": "max 100",
    "score_conformidade": 0-10, "observacoes_ia": "max 150", "justificativa_relevancia": "max 80"
  }],
  "requisitos_nao_aplicaveis": ["UUIDs"],
  "recomendacoes": ["max 150 chars cada, mínimo 3"],
  "analise_detalhada": "resumo executivo (max 300 palavras)"
}`;
}

async function avaliarLote(ctx: any, lote: any[], documento: string, resumido: boolean) {
  const content = await chamarIA(MODELOS.LEITURA_LONGA,
    'Você é um auditor sênior de conformidade regulatória. Retorne APENAS JSON válido seguindo exatamente o schema.',
    montarPrompt(ctx, lote, documento, resumido), 12000, 100000);
  const limpo = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(limpo);
  if (!Array.isArray(parsed?.requisitos_analisados)) throw new Error('JSON sem requisitos');
  return parsed;
}

// ---------- uma fatia do trabalho ----------
async function falharJob(supabase: SupabaseClient, job: any, msg: string) {
  await supabase.from('analise_aderencia_jobs').update({ status: 'erro', erro: msg, locked_until: null, updated_at: new Date().toISOString() }).eq('id', job.id);
  await supabase.from('gap_analysis_adherence_assessments').update({
    status: 'erro', metadados_analise: { erro: msg, timestamp_erro: new Date().toISOString() },
  }).eq('id', job.assessment_id).eq('empresa_id', job.empresa_id);
}

async function executarFatia(supabase: SupabaseClient, jobId: string) {
  const agora = new Date();
  // Lock: só uma invocação por vez processa o trabalho.
  const { data: candidatos } = await supabase.from('analise_aderencia_jobs')
    .select('id, locked_until, saltos_restantes, status').eq('id', jobId).maybeSingle();
  if (!candidatos || candidatos.status !== 'processando') return;
  if (candidatos.locked_until && new Date(candidatos.locked_until) > agora) return;
  if (candidatos.saltos_restantes <= 0) {
    await falharJob(supabase, { id: jobId, ...(await supabase.from('analise_aderencia_jobs').select('assessment_id, empresa_id').eq('id', jobId).single()).data }, 'Limite de etapas atingido.');
    return;
  }
  let q = supabase.from('analise_aderencia_jobs')
    .update({ locked_until: new Date(agora.getTime() + 150000).toISOString(), saltos_restantes: candidatos.saltos_restantes - 1 })
    .eq('id', jobId).eq('status', 'processando');
  q = candidatos.locked_until ? q.eq('locked_until', candidatos.locked_until) : q.is('locked_until', null);
  const { data: job } = await q.select('*').maybeSingle();
  if (!job) return; // outra invocação pegou

  const ctx = job.contexto || {};
  const trechos: string[] = job.trechos || [];
  const resumos: any[] = job.resumos || [];
  const lotes: any[][] = job.lotes || [];
  const resultados: any[] = job.resultados || [];
  let etapa: string = job.etapa;
  let progresso: number = job.progresso;

  try {
    if (etapa === 'classificando') {
      await classificar(supabase, job, ctx, trechos);
      return;
    }
    if (etapa === 'resumindo') {
      const idx = proximosPendentes(resumos, trechos.length, POR_FATIA);
      const limite = orcamentoResumo(trechos.length);
      const feitos = await Promise.all(idx.map((i) => resumirTrecho(trechos[i], i, trechos.length, ctx.framework_nome, limite)));
      idx.forEach((i, k) => { resumos[i] = feitos[k]; });
      progresso += idx.length;
      if (proximosPendentes(resumos, trechos.length, 1).length === 0) etapa = 'avaliando';
    } else if (etapa === 'avaliando') {
      const resumido = trechos.length > 1;
      const documento = resumido ? resumos.join('\n\n') : trechos[0];
      const idx = proximosPendentes(resultados, lotes.length, POR_FATIA);
      const feitos = await emPool(idx, POR_FATIA, async (i) => {
        try { return await avaliarLote(ctx, lotes[i], documento, resumido); }
        catch (e) { if (e instanceof BloqueioIA) throw e; console.error(`Lote ${i} falhou:`, e); return { falhou: true }; }
      });
      idx.forEach((i, k) => { resultados[i] = feitos[k]; });
      progresso += idx.length;
      if (proximosPendentes(resultados, lotes.length, 1).length === 0) etapa = 'finalizando';
    }

    if (etapa === 'finalizando') {
      await finalizar(supabase, job, ctx, lotes, resultados);
      return;
    }

    await supabase.from('analise_aderencia_jobs').update({
      etapa, progresso, resumos, resultados, locked_until: null, updated_at: new Date().toISOString(),
    }).eq('id', job.id);
    agendarProximo(job.id);
  } catch (e) {
    console.error('Fatia falhou:', e);
    if (e instanceof BloqueioIA) return await falharJob(supabase, job, e.message);
    // Trecho de resumo que falhou mesmo após repetições: tenta de novo numa próxima fatia, com espera.
    await supabase.from('analise_aderencia_jobs').update({ locked_until: null, erro: String((e as Error)?.message || e), updated_at: new Date().toISOString() }).eq('id', job.id);
    if (job.saltos_restantes > 1) agendarProximo(job.id, 20000);
    else await falharJob(supabase, job, new IaIndisponivelError().message);
  }
}


// ---------- etapa 1: entender a política e escolher os requisitos aplicáveis ----------
async function classificar(supabase: SupabaseClient, job: any, ctx: any, trechos: string[]) {
  const catalogo: any[] = ctx.catalogo || [];
  const inicio = trechos.join('\n').slice(0, 8000);
  const titulos = extrairTitulos(trechos.join('\n'));
  const lista = catalogo.map((r: any) => `${r.codigo}: ${r.titulo}`).join('\n');
  let tipo = '', tema = '', codigos: string[] = [], justificativa = '';
  try {
    const out = await chamarIA(MODELOS.ANALISE,
      'Você é um auditor sênior. Responda APENAS JSON válido.',
      `Pergunta do usuário: "De acordo com a norma ${ctx.framework_nome} ${ctx.framework_versao || ''}, esta política está em compliance?"

Para responder, primeiro identifique o tipo e o tema do documento e escolha, da lista de requisitos da norma, SOMENTE os que um documento com esse tema deve cobrir. Não inclua requisitos de outros temas (ex.: uma política de mesa limpa não precisa cobrir backup).

TÍTULOS DO DOCUMENTO:
${titulos.join('\n') || '(sem títulos detectados)'}

INÍCIO DO DOCUMENTO:
---
${inicio}
---

REQUISITOS DA NORMA (código: título):
${lista}

JSON: {"documento_tipo": "string", "documento_tema": "string curta", "justificativa": "1 frase sobre por que esses requisitos", "requisitos_aplicaveis": ["códigos exatos da lista"]}`, 4000);
    const p = JSON.parse(out.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
    tipo = String(p.documento_tipo || ''); tema = String(p.documento_tema || '');
    justificativa = String(p.justificativa || '');
    codigos = Array.isArray(p.requisitos_aplicaveis) ? p.requisitos_aplicaveis.map((c: any) => String(c).trim()) : [];
  } catch (e) {
    if (e instanceof BloqueioIA) return await falharJob(supabase, job, e.message);
    console.error('Classificação falhou, usando correspondência por tema:', e);
  }
  const set = new Set(codigos);
  let sugeridos = catalogo.filter((r: any) => set.has(String(r.codigo || '').trim())).map((r: any) => r.id);
  if (!sugeridos.length) {
    const scope = resolveDocumentScope(catalogo, tema || titulos[0] || '', titulos, []);
    const sc = new Set(scope.scopeCodes);
    sugeridos = catalogo.filter((r: any) => sc.has(String(r.codigo || '').trim())).map((r: any) => r.id);
  }
  // Segue direto para a avaliação com os requisitos que a IA considerou aplicáveis.
  const pedidos = new Set<string>(sugeridos);
  const escolhidos = catalogo.filter((r: any) => pedidos.has(r.id));
  const lotes = dividirEmLotes(escolhidos.length ? escolhidos : catalogo, TAM_LOTE);
  const total = (trechos.length > 1 ? trechos.length : 0) + lotes.length;
  await supabase.from('analise_aderencia_jobs').update({
    status: 'processando', etapa: trechos.length > 1 ? 'resumindo' : 'avaliando',
    lotes, total, progresso: 0, resumos: [], resultados: [],
    saltos_restantes: Math.ceil(total / POR_FATIA) * 4 + 10, locked_until: null, updated_at: new Date().toISOString(),
    contexto: { ...ctx, catalogo: undefined, documento_tipo: tipo, documento_tema: tema, escopo_justificativa: justificativa,
      total_escopo: escolhidos.length || catalogo.length,
      fora_escopo_ids: escolhidos.length ? catalogo.filter((r: any) => !pedidos.has(r.id)).map((r: any) => r.id) : [] },
  }).eq('id', job.id);
  agendarProximo(job.id);
}

// ---------- etapa final: interpretar em linguagem de consultor ----------
async function interpretar(ctx: any, analisados: any[], porId: Map<string, any>, veredito: string, score: number) {
  const linhas = analisados.slice(0, 150).map((d: any) => {
    const q = porId.get(d.requirement_id);
    return `- ${q?.codigo || d.requisito_codigo} ${q?.titulo || ''} | ${d.status_aderencia} | evidência: ${d.evidencias_encontradas || '-'} | falta: ${d.gaps_especificos || '-'}`;
  }).join('\n');
  const out = await chamarIA(MODELOS.ANALISE,
    'Você é um consultor sênior de conformidade. Responda APENAS JSON válido, em português, direto e prático.',
    `Pergunta: "De acordo com a norma ${ctx.framework_nome}, a política '${ctx.documento_tema || ctx.nome_analise || ''}' está em compliance?"
Veredito calculado: ${veredito} (nota ${score}% no escopo desta política). NÃO mude o veredito.

RESULTADO POR REQUISITO:
${linhas}

Explique o veredito ao usuário e ensine exatamente o que ele precisa fazer, como um consultor que instrui.
JSON: {
 "resumo": "2-3 frases respondendo a pergunta e explicando o porquê",
 "acoes": [{
   "titulo": "ajuste concreto, max 80",
   "descricao": "resumo do ajuste, max 200",
   "prioridade": "alta|media|baixa",
   "essencial": true se sem isso a política não fica em compliance; false se é boa prática,
   "requisito_codigo": "código",
   "exigencia_norma": "o que a norma exige, em linguagem simples, max 220",
   "evidencia_documento": "trecho LITERAL curto da política relacionado, ou 'Não encontramos menção a ...' — nunca invente citações",
   "impacto": "por que importa / o que um auditor apontaria, max 180",
   "passos": ["2 a 4 passos práticos, max 120 cada"],
   "texto_sugerido": "parágrafo pronto para inserir na política, max 600"
 }],
 "pontos_fortes": [{"titulo": "max 60", "descricao": "max 150", "citacao": "trecho literal curto da política"}]
}
Ordene as ações da mais importante para a menos importante. Máximo 10 ações e 6 pontos fortes. Se estiver tudo conforme, "acoes" traz apenas boas práticas com essencial=false.`, 9000);
  return JSON.parse(out.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
}

async function finalizar(supabase: SupabaseClient, job: any, ctx: any, lotes: any[][], resultados: any[]) {
  const ok = resultados.map((r) => (r && !r.falhou ? r : null));
  const junto = juntarLotes(ok);
  if (junto.lotes_ok === 0) return await falharJob(supabase, job, new IaIndisponivelError().message);

  const reqsAvaliados = lotes.filter((_, i) => ok[i]).flat();
  const reqsNaoAvaliados = lotes.flat().length - reqsAvaliados.length;

  const { data: recibo, error: credErr } = await supabase.rpc('consume_ai_credit_idempotente', {
    p_empresa_id: job.empresa_id, p_user_id: job.user_id,
    p_funcionalidade: 'analyze_document_adherence',
    p_idempotency_key: `aderencia:${job.assessment_id}`,
    p_descricao: 'Análise de aderência do documento para framework',
  });
  const r = recibo as { charged?: boolean; reason?: string } | null;
  if (!credErr && r && r.charged !== true && r.reason === 'CREDITS_EXHAUSTED') {
    return await falharJob(supabase, job, 'Créditos de IA insuficientes.');
  }
  if (credErr) console.warn('consume_ai_credit_idempotente falhou:', credErr);

  const analisados = junto.requisitos_analisados.map((req: any) => ({
    ...req,
    evidencias_encontradas: (req.evidencias_encontradas || '').substring(0, 120),
    gaps_especificos: (req.gaps_especificos || '').substring(0, 100),
    observacoes_ia: (req.observacoes_ia || '').substring(0, 150),
    justificativa_relevancia: (req.justificativa_relevancia || '').substring(0, 80),
  }));
  const missing = Math.max(reqsAvaliados.length - analisados.length, 0);
  const { score, contagem } = computeAnalyzedScore(analisados, missing);
  const veredito = calcularVeredito(score, contagem);
  const porIdF = new Map(lotes.flat().map((q: any) => [q.id, q]));
  let interp: any = null;
  try { interp = await interpretar(ctx, analisados, porIdF, veredito, score); }
  catch (e) { console.error('Interpretação falhou (usa pontos dos lotes):', e); }
  const acoes = Array.isArray(interp?.acoes) && interp.acoes.length
    ? interp.acoes.slice(0, 12).map((a: any) => ({ ...a, requirement_id: lotes.flat().find((q: any) => q.codigo === a.requisito_codigo)?.id || null }))
    : (junto.pontos_melhoria || []).map((p: any) => ({ titulo: p.titulo, descricao: p.descricao, prioridade: p.prioridade || 'media', requisito_codigo: null, requirement_id: null }));
  const pontosFortes = Array.isArray(interp?.pontos_fortes) && interp.pontos_fortes.length ? interp.pontos_fortes : junto.pontos_fortes;

  let comparacao: any = null;
  if (ctx.versao_anterior_id) {
    const { data: prev } = await supabase.from('gap_analysis_adherence_details')
      .select('requirement_id, status_aderencia').eq('assessment_id', ctx.versao_anterior_id);
    if (prev?.length) comparacao = compararVersoes(prev as any, analisados);
  }

  const recomendacoes = reqsNaoAvaliados > 0
    ? [`${reqsNaoAvaliados} requisitos não foram avaliados por indisponibilidade temporária da IA. Reanalise o documento para completar.`, ...junto.recomendacoes]
    : junto.recomendacoes;

  const { data: atualMeta } = await supabase.from('gap_analysis_adherence_assessments').select('metadados_analise').eq('id', job.assessment_id).maybeSingle();
  const { error: upErr } = await supabase.from('gap_analysis_adherence_assessments').update({
    status: 'concluido',
    resultado_geral: resolveResultadoGeral(score, contagem),
    percentual_conformidade: score,
    pontos_fortes: pontosFortes, pontos_melhoria: acoes.map((a: any) => ({ titulo: a.titulo, descricao: a.descricao, prioridade: a.prioridade })),
    recomendacoes, analise_detalhada: interp?.resumo ? `${interp.resumo}\n\n${junto.analise_detalhada}` : junto.analise_detalhada,
    metadados_analise: {
      ...((atualMeta?.metadados_analise as Record<string, unknown>) || {}),
      modelo_usado: MODELOS.LEITURA_LONGA, provider: 'lovable-ai-gateway', _score_fonte: 'deterministic',
      tempo_processamento: Date.now(),
      total_requisitos: ctx.total_escopo, total_requisitos_catalogo: ctx.total_catalogo,
      total_requisitos_analisados: reqsAvaliados.length, total_requisitos_nao_analisados: reqsNaoAvaliados,
      truncado: false, total_requisitos_relevantes: junto.total_requisitos_relevantes,
      documento_tamanho: ctx.documento_tamanho, documento_trechos: (job.trechos || []).length,
      documento_tipo: junto.documento_tipo_identificado, documento_escopo: junto.documento_escopo_identificado,
      requisitos_nao_aplicaveis: junto.requisitos_nao_aplicaveis,
      veredito, veredito_resumo: interp?.resumo || null, acoes,
      escopo_ids: lotes.flat().map((q: any) => q.id), fora_escopo_ids: ctx.fora_escopo_ids || [],
      documento_tema: ctx.documento_tema || null, escopo_justificativa: ctx.escopo_justificativa || null,
      versao_anterior_id: ctx.versao_anterior_id || null, comparacao,
    },
    updated_at: new Date().toISOString(),
  }).eq('id', job.assessment_id).eq('empresa_id', job.empresa_id);
  if (upErr) return await falharJob(supabase, job, upErr.message);

  const porId = porIdF;
  if (analisados.length) {
    await supabase.from('gap_analysis_adherence_details').delete().eq('assessment_id', job.assessment_id);
    const { error: detErr } = await supabase.from('gap_analysis_adherence_details').insert(analisados.map((req: any) => {
      const q: any = porId.get(req.requirement_id);
      return {
        assessment_id: job.assessment_id, requirement_id: req.requirement_id,
        requisito_codigo: q?.codigo || req.requisito_codigo || '', requisito_titulo: q?.titulo || '',
        status_aderencia: req.status_aderencia, evidencias_encontradas: req.evidencias_encontradas,
        gaps_especificos: req.gaps_especificos, score_conformidade: req.score_conformidade,
        observacoes_ia: req.observacoes_ia, justificativa_relevancia: req.justificativa_relevancia || null,
      };
    }).filter((d: any) => porId.has(d.requirement_id)));
    if (detErr) console.error('Erro ao gravar detalhes:', detErr);
  }

  await supabase.from('analise_aderencia_jobs').update({
    status: 'concluido', etapa: 'concluido', progresso: job.total, resultados, locked_until: null, erro: null,
    trechos: [], updated_at: new Date().toISOString(),
  }).eq('id', job.id);

  // Avisa quem enviou e os administradores da MESMA empresa.
  const { data: admins } = await supabase.from('profiles').select('user_id')
    .eq('empresa_id', job.empresa_id).eq('ativo', true).in('role', ['admin', 'super_admin']);
  const destinatarios = Array.from(new Set([job.user_id, ...((admins ?? []).map((p: any) => p.user_id))].filter(Boolean)));
  const { data: asmt } = await supabase.from('gap_analysis_adherence_assessments').select('framework_id')
    .eq('id', job.assessment_id).eq('empresa_id', job.empresa_id).maybeSingle();
  const mensagem = `${ctx.nome_analise || ctx.framework_nome}: ${veredito === 'em_compliance' ? 'em compliance' : veredito === 'com_ressalvas' ? 'em compliance com ressalvas' : 'não está em compliance'} (${Number(score).toFixed(1)}%)`;
  await supabase.from('notifications').insert(destinatarios.map((uid) => ({
    user_id: uid,
    title: 'Análise de conformidade concluída',
    message: mensagem,
    type: 'success', link_to: asmt?.framework_id ? `/gap-analysis/framework/${asmt.framework_id}` : '/gap-analysis',
  }))).then(() => {}, () => {});
}

// ---------- pedido do usuário: cria o trabalho ----------
async function iniciar(supabase: SupabaseClient, body: any, empresaId: string, userId: string) {
  const { assessmentId, storageFileName, source, docgenDocument, coverage_map: providedCoverageMap } = body;
  const isDocgen = source === 'docgen';
  if (!assessmentId) return json({ error: 'assessmentId obrigatório' }, 400);

  const { data: a } = await supabase.from('gap_analysis_adherence_assessments')
    .select('id, empresa_id, framework_id, nome_analise').eq('id', assessmentId).maybeSingle();
  if (!a) return json({ error: 'Assessment não encontrado' }, 404);
  if (a.empresa_id !== empresaId) return json({ error: 'Forbidden' }, 403);

  // Retomar um trabalho parado (botão "Tentar novamente" / tela aberta).
  if (body.acao === 'retomar') {
    const { data: j } = await supabase.from('analise_aderencia_jobs').select('id, status, empresa_id')
      .eq('assessment_id', assessmentId).eq('empresa_id', empresaId).maybeSingle();
    if (!j) return json({ error: 'Análise não encontrada' }, 404);
    if (j.status === 'processando') agendarProximo(j.id, 0);
    return json({ success: true, jobId: j.id, status: j.status }, 202);
  }

  let documentText = '';
  if (isDocgen) {
    if (!Array.isArray(docgenDocument?.secoes) || !docgenDocument.secoes.length) return json({ error: 'docgenDocument.secoes obrigatório quando source=docgen' }, 400);
    documentText = `# ${docgenDocument.titulo || 'Documento'}\n\n` +
      docgenDocument.secoes.map((s: any, i: number) => `## Seção ${i + 1}: ${s?.nome || ''}\n${String(s?.conteudo || '')}`).join('\n\n');
  } else {
    const path = String(storageFileName || '');
    if (!path.startsWith(`${empresaId}/`)) return json({ error: 'Arquivo inválido para esta empresa' }, 403);
    if (!path.toLowerCase().endsWith('.txt')) return json({ error: 'Apenas TXT pré-processados são aceitos.' }, 400);
    const { data: f, error } = await supabase.storage.from('adherence-documents').download(path);
    if (error || !f) return json({ error: `Erro ao baixar documento: ${error?.message}` }, 400);
    documentText = await f.text();
  }
  if (documentText.trim().length < 100) return json({ error: 'Documento não contém texto suficiente para análise (mínimo 100 caracteres)' }, 400);

  const { data: framework } = await supabase.from('gap_analysis_frameworks').select('id, nome, versao').eq('id', a.framework_id).single();
  if (!framework) return json({ error: 'Framework não encontrado' }, 404);
  const { data: requirements } = await supabase.from('gap_analysis_requirements')
    .select('id, codigo, titulo, descricao, orientacao_implementacao, exemplos_evidencias')
    .eq('framework_id', a.framework_id).order('ordem');
  if (!requirements?.length) return json({ error: 'Framework não possui requisitos cadastrados' }, 400);

  let escopo: any[] = requirements;
  if (isDocgen) {
    const scope = resolveDocumentScope(requirements, docgenDocument?.titulo,
      (docgenDocument?.secoes || []).map((s: any) => s?.nome),
      Array.isArray(docgenDocument?.coverage_map) ? docgenDocument.coverage_map : []);
    const set = new Set(scope.scopeCodes);
    const f = requirements.filter((r: any) => set.has(String(r?.codigo || '').trim()));
    if (f.length) escopo = f;
  }

  const coverageMap: any[] = isDocgen && Array.isArray(docgenDocument?.coverage_map) ? docgenDocument.coverage_map
    : (Array.isArray(providedCoverageMap) ? providedCoverageMap : []);
  const coverage_block = coverageMap.length
    ? `\nCOVERAGE_MAP DECLARADO PELO AUTOR (validar contra o texto):\n${coverageMap.slice(0, 200).map((c: any) => `- [${c.requirement_codigo || 'S/C'}] ${c.requirement_titulo || ''} → "${String(c.evidencia || '').slice(0, 160)}"`).join('\n')}\nSe a evidência declarada estiver no documento, tenda para "conforme"; se não, "nao_conforme".`
    : '';

  if (!(await temCreditoIA(supabase, empresaId))) return semCreditoIA(corsHeaders);

  // Versão anterior (mesma empresa e mesmo framework) para comparar no fim.
  let versaoAnteriorId: string | null = null;
  if (typeof body.versaoAnteriorId === 'string') {
    const { data: prev } = await supabase.from('gap_analysis_adherence_assessments').select('id')
      .eq('id', body.versaoAnteriorId).eq('empresa_id', empresaId).eq('framework_id', a.framework_id).maybeSingle();
    versaoAnteriorId = prev?.id || null;
  }

  const trechos = documentText.length <= LIMITE_TEXTO_DIRETO ? [documentText] : dividirTexto(documentText);
  // Upload: primeiro entende a política e propõe o escopo; DocGen já vem com escopo.
  const precisaClassificar = !isDocgen;
  const lotes = precisaClassificar ? [] : dividirEmLotes(escopo, TAM_LOTE);
  const etapa = precisaClassificar ? 'classificando' : (trechos.length > 1 ? 'resumindo' : 'avaliando');
  const total = precisaClassificar ? 1 : (trechos.length > 1 ? trechos.length : 0) + lotes.length;

  await supabase.from('analise_aderencia_jobs').delete().eq('assessment_id', assessmentId);
  const { data: job, error: jobErr } = await supabase.from('analise_aderencia_jobs').insert({
    assessment_id: assessmentId, empresa_id: empresaId, user_id: userId,
    etapa, trechos, lotes, total, progresso: 0,
    saltos_restantes: Math.ceil(Math.max(total, 1) / POR_FATIA) * 4 + 10,
    contexto: {
      framework_nome: framework.nome, framework_versao: framework.versao, nome_analise: a.nome_analise,
      coverage_block, total_escopo: escopo.length, versao_anterior_id: versaoAnteriorId,
      catalogo: precisaClassificar ? escopo.map((r: any) => ({ ...r, descricao: r.descricao ? String(r.descricao).slice(0, 300) : null })) : undefined, total_catalogo: requirements.length, documento_tamanho: documentText.length,
    },
  }).select('id').single();
  if (jobErr || !job) return json({ error: `Não foi possível iniciar a análise: ${jobErr?.message}` }, 500);

  await supabase.from('gap_analysis_adherence_assessments').update({ status: 'processando' }).eq('id', assessmentId).eq('empresa_id', empresaId);
  agendarProximo(job.id, 0);
  console.log('Análise iniciada', { assessmentId, trechos: trechos.length, lotes: lotes.length });
  return json({ success: true, jobId: job.id, total, trechos: trechos.length, lotes: lotes.length }, 202);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    if (!AI_KEY) return json({ error: 'LOVABLE_API_KEY não configurada' }, 500);
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    // Fatia interna (só o próprio sistema, com a chave de serviço).
    if (body?.job_step === true) {
      if (token !== SERVICE_KEY) return json({ error: 'Unauthorized' }, 401);
      if (typeof body.jobId !== 'string') return json({ error: 'jobId obrigatório' }, 400);
      await executarFatia(supabase, body.jobId);
      return json({ ok: true });
    }

    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const verifier = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || SERVICE_KEY);
    const { data: u, error: uErr } = await verifier.auth.getUser(token);
    if (uErr || !u?.user) return json({ error: 'Unauthorized' }, 401);
    const { data: profile } = await supabase.from('profiles').select('empresa_id').eq('user_id', u.user.id).eq('ativo', true).maybeSingle();
    if (!profile?.empresa_id) return json({ error: 'User profile missing empresa_id' }, 403);
    return await iniciar(supabase, body, profile.empresa_id, u.user.id);
  } catch (error) {
    console.error('Error in analyze-document-adherence:', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
