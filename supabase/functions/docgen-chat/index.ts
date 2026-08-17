import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  computeCoverageScore,
  computeAnalyzedScore,
  reconcileReportedScore,
  applyRefineCoverage,
  complianceImpactFrom,
  filterInScope,
  expandNaoCobertosFromCatalog,
  computeResidualGaps,
  resolveDocumentScope,
  AUDIT_THRESHOLD,
  MAX_REFINE_ATTEMPTS,
} from '../_shared/compliance-score.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ConversationContext {
  user_name?: string;
  empresa_nome?: string;
  tipo_documento_identificado?: string;
  informacoes_coletadas?: Record<string, any>;
  template_sugerido?: any;
  etapa_atual?: string;
}

// Funções auxiliares para extração inteligente
function extractDocumentType(messageText: string): string | null {
  if (messageText.includes('política') || messageText.includes('politica')) return 'politica';
  if (messageText.includes('procedimento')) return 'procedimento';
  if (messageText.includes('norma')) return 'norma';
  if (messageText.includes('manual')) return 'manual';
  if (messageText.includes('código') || messageText.includes('codigo')) return 'codigo';
  return null;
}

function extractDocumentName(messageText: string): string | null {
  const patterns = [
    /política de ([^\n\.,]+)/i,
    /procedimento de ([^\n\.,]+)/i,
    /norma de ([^\n\.,]+)/i,
    /manual de ([^\n\.,]+)/i,
    /código de ([^\n\.,]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = messageText.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  return null;
}

function extractFrameworks(messageText: string): string[] {
  const frameworks = [];
  if (messageText.includes('iso 27001') || messageText.includes('iso27001')) frameworks.push('ISO 27001');
  if (messageText.includes('lgpd')) frameworks.push('LGPD');
  if (messageText.includes('coso')) frameworks.push('COSO');
  if (messageText.includes('itil')) frameworks.push('ITIL');
  if (messageText.includes('sox')) frameworks.push('SOX');
  return frameworks;
}

// Chama a IA via gateway do Lovable (OpenAI-compatível), igual às demais
// funções do projeto. Antes usava a API da Anthropic direto com um modelo
// que retornava 404 nesta conta.
// Modelo padrão (chat/quick_adherence): rápido e barato.
// Modelo de qualidade editorial (generate_document / refine_document / retry): pro.
const MODEL_FAST = 'google/gemini-3-flash-preview';
const MODEL_QUALITY = 'google/gemini-3.1-pro-preview';

async function callClaude(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  apiKey: string,
  maxTokens = 2000,
  temperature = 0.8,
  model: string = MODEL_FAST,
) {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI gateway error:', response.status, errorText, 'model:', model);
    if (response.status === 429) throw new AiGatewayError('Limite de requisições excedido. Tente novamente em alguns minutos.', 'RATE_LIMITED', 429);
    if (response.status === 402 || response.status === 403) {
      throw new AiGatewayError('Créditos de IA insuficientes para concluir esta operação.', 'CREDITS_EXHAUSTED', 402);
    }
    throw new AiGatewayError(`Erro na IA (${response.status})`, 'AI_ERROR', 502);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Erro tipado para o gateway de IA — permite mapear 402/403/429 em respostas
// estruturadas que o frontend entende (CreditsExhaustedDialog etc).
class AiGatewayError extends Error {
  code: string;
  httpStatus: number;
  constructor(message: string, code: string, httpStatus: number) {
    super(message);
    this.name = 'AiGatewayError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// Executa UMA rodada de refino gap-driven sobre o documento (mutação in-place).
// Extraído do generate_document para evitar estourar o timeout da plataforma:
// o frontend chama a action `auto_refine` uma vez por tentativa.
async function autoRefineOnce(params: {
  documentContent: any;
  catalogCodes: string[];
  residualGaps: string[];
  empresaNome: string;
  frameworkName?: string;
  apiKey: string;
  attempt: number;
}): Promise<{
  changed: boolean;
  before: number;
  after: number;
  gaps_targeted: string[];
  residualGaps: string[];
  naoCobertos: any[];
}> {
  const { documentContent, catalogCodes, apiKey, attempt, empresaNome, frameworkName } = params;
  const currentCov: any[] = Array.isArray(documentContent?.coverage_map) ? documentContent.coverage_map : [];
  const naoCobertosAtuais: any[] = Array.isArray(documentContent?.requisitos_nao_cobertos_justificativa)
    ? documentContent.requisitos_nao_cobertos_justificativa : [];
  const before = computeCoverageScore(currentCov, naoCobertosAtuais, 0);
  const gapsBatch = params.residualGaps.slice(0, 10);
  const fail = {
    changed: false, before, after: before, gaps_targeted: gapsBatch,
    residualGaps: params.residualGaps, naoCobertos: naoCobertosAtuais,
  };
  if (!gapsBatch.length || !catalogCodes.length || !documentContent?.secoes?.length) return fail;

  const instructionAuto = `Cubra explicitamente os seguintes requisitos ainda não endereçados no documento: ${gapsBatch.join(', ')}. Adicione cláusulas concretas nas seções mais apropriadas, sem perder cobertura já existente, e devolva o coverage_map atualizado incluindo esses códigos.`;
  const secoesForRefine = (documentContent.secoes || []).map((s: any) => ({ nome: s.nome, conteudo: s.conteudo }));
  const docJsonR = JSON.stringify({
    titulo: documentContent.titulo,
    versao: documentContent.versao,
    secoes: secoesForRefine,
  });
  const covBlock = currentCov.length
    ? `\n\n=== COVERAGE MAP ATUAL (NÃO PERDER COBERTURA) ===\n${currentCov
        .map((c: any) => `- [${c.requirement_codigo || 'S/C'}] ${c.requirement_titulo || ''} → seções ${JSON.stringify(c.section_indexes || [])} — evidência: "${(c.evidencia || '').slice(0, 160)}"`)
        .join('\n')}`
    : '';

  const sysR = `Você é um editor sênior de documentos corporativos com foco em compliance. Aplique a instrução cobrindo TODOS os requisitos indicados sem perder cobertura existente. Mantenha a lista de seções (mesmos nomes e ordem). Responda SOMENTE com JSON válido, sem markdown, no formato:
{
  "sections_changed": ["Nome da seção 1", ...],
  "summary": "1 frase descrevendo a mudança",
  "document": {
    "titulo": "...",
    "versao": "...",
    "secoes": [ { "nome": "...", "conteudo": "..." } ],
    "coverage_map": [ { "requirement_codigo": "A.8.13", "requirement_titulo": "...", "section_indexes": [2], "evidencia": "trecho literal (max 220 chars)" } ]
  },
  "removed_coverage": []
}`;
  const userR = `EMPRESA: ${empresaNome}
${frameworkName ? `FRAMEWORK: ${frameworkName}\n` : ''}
DOCUMENTO ATUAL (JSON):
${docJsonR}${covBlock}

INSTRUÇÃO (auto-refino gap-driven, tentativa ${attempt}/${MAX_REFINE_ATTEMPTS}):
${instructionAuto}

Devolva o JSON completo com coverage_map atualizado.`;

  const rawR = await callClaude(
    [{ role: 'user', content: userR }],
    sysR,
    apiKey,
    18000,
    0.35,
    MODEL_QUALITY,
  );

  let parsedR: any = null;
  try {
    parsedR = JSON.parse(rawR.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
  } catch (e) {
    console.log('DocGen auto-refino parse falhou na tentativa', attempt, e);
    return fail;
  }
  if (!parsedR?.document?.secoes?.length) return fail;

  const removed = new Set((parsedR?.removed_coverage || []).map((r: any) => String(r?.requirement_codigo || '')));
  const nextCoverage: any[] = Array.isArray(parsedR?.document?.coverage_map) && parsedR.document.coverage_map.length
    ? parsedR.document.coverage_map
    : currentCov.filter((c: any) => !removed.has(String(c?.requirement_codigo || '')));

  documentContent.titulo = parsedR.document.titulo || documentContent.titulo;
  documentContent.versao = parsedR.document.versao || documentContent.versao;
  documentContent.secoes = parsedR.document.secoes;
  documentContent.coverage_map = nextCoverage;

  const coveredNow = new Set(nextCoverage.map((c: any) => String(c?.requirement_codigo || '').trim()).filter(Boolean));
  const ncBase = naoCobertosAtuais.filter((n: any) => !coveredNow.has(String(n?.codigo || '').trim()));
  const expandedNaoCob = expandNaoCobertosFromCatalog(catalogCodes, nextCoverage, ncBase);
  documentContent.requisitos_nao_cobertos_justificativa = expandedNaoCob;

  const after = computeCoverageScore(nextCoverage, expandedNaoCob, 0);
  const nextResidual = computeResidualGaps(catalogCodes, nextCoverage, expandedNaoCob, 15);
  documentContent._initial_score = after;
  documentContent._residual_gaps = nextResidual;

  return { changed: true, before, after, gaps_targeted: gapsBatch, residualGaps: nextResidual, naoCobertos: expandedNaoCob };
}


import { parseDocumentJson, isValidDocument } from '../_shared/docgen-json.ts';

// ============ Quality gate helpers (Onda 3) ============
const PLACEHOLDER_RX = /\b(preencher|inserir|exemplo|TBD|lorem ipsum|xxx|xxxx|\.\.\.)\b/i;
function findWeakSections(secoes: any[]): { index: number; nome: string; motivo: string }[] {
  const weak: { index: number; nome: string; motivo: string }[] = [];
  (secoes || []).forEach((s, i) => {
    const conteudo = String(s?.conteudo || '').trim();
    if (conteudo.length < 200) {
      weak.push({ index: i, nome: s?.nome || `Seção ${i + 1}`, motivo: `curta (${conteudo.length} chars)` });
    } else if (PLACEHOLDER_RX.test(conteudo)) {
      weak.push({ index: i, nome: s?.nome || `Seção ${i + 1}`, motivo: 'contém placeholder' });
    }
  });
  return weak;
}

// Fetch non-compliant gaps for the framework
async function fetchFrameworkGaps(supabase: any, frameworkId: string, empresaId: string): Promise<string> {
  try {
    const { data: evals } = await supabase
      .from('gap_analysis_evaluations')
      .select('requirement_id, conformity_status')
      .eq('framework_id', frameworkId)
      .eq('empresa_id', empresaId)
      .in('conformity_status', ['nao_conforme', 'parcialmente_conforme']);

    if (!evals || evals.length === 0) return '';

    const reqIds = evals.map((e: any) => e.requirement_id);
    const { data: reqs } = await supabase
      .from('gap_analysis_requirements')
      .select('codigo, titulo, categoria')
      .in('id', reqIds);

    if (!reqs || reqs.length === 0) return '';

    const gapLines = reqs.map((r: any) => {
      const ev = evals.find((e: any) => e.requirement_id === r.id);
      const status = ev?.conformity_status === 'nao_conforme' ? 'Não Conforme' : 'Parcialmente Conforme';
      return `- [${r.codigo || 'S/C'}] ${r.titulo} (${r.categoria || 'Geral'}) — ${status}`;
    });

    return `\n\nGAPS IDENTIFICADOS NO FRAMEWORK (${gapLines.length} itens não conformes/parciais):\n${gapLines.join('\n')}`;
  } catch (error) {
    console.error('Error fetching framework gaps:', error);
    return '';
  }
}

// Busca TODOS os requisitos catalogados do(s) framework(s), com o que cada um
// exige (descrição/orientação) e o status de conformidade da empresa. Assim a IA
// pode identificar os requisitos relevantes ao tema do documento e garantir que
// o documento cumpra o que o framework pede. Genérico para qualquer framework.
async function fetchFrameworkRequirements(supabase: any, frameworkIds: string[], empresaId: string): Promise<string> {
  try {
    const ids = (frameworkIds || []).filter(Boolean);
    if (!ids.length) return '';

    const { data: reqs } = await supabase
      .from('gap_analysis_requirements')
      .select('id, framework_id, codigo, titulo, descricao, orientacao_implementacao, categoria')
      .in('framework_id', ids)
      .order('ordem', { ascending: true })
      .limit(900);
    if (!reqs || reqs.length === 0) return '';

    // Nome de cada framework — o prompt precisa deixar claro que há MAIS DE UM
    // referencial e que todos têm de ser endereçados (antes só ia um bloco solto).
    const { data: fwRows } = await supabase
      .from('gap_analysis_frameworks')
      .select('id, nome')
      .in('id', ids);
    const fwName = new Map<string, string>();
    (fwRows || []).forEach((f: any) => fwName.set(f.id, f.nome));

    // Status de conformidade da empresa, para marcar os gaps (prioridade).
    const { data: evals } = await supabase
      .from('gap_analysis_evaluations')
      .select('requirement_id, conformity_status')
      .in('framework_id', ids)
      .eq('empresa_id', empresaId)
      .limit(5000);
    const statusById = new Map<string, string>();
    (evals || []).forEach((e: any) => statusById.set(e.requirement_id, e.conformity_status));

    const trunc = (s: string | null, n: number) => (s && s.length > n ? `${s.slice(0, n)}…` : (s || ''));
    const renderLine = (r: any) => {
      const st = statusById.get(r.id);
      const gapTag = st === 'nao_conforme' ? ' [GAP: NÃO CONFORME]'
        : st === 'parcialmente_conforme' ? ' [GAP: PARCIAL]' : '';
      const exige = [
        r.descricao && `O que exige: ${trunc(r.descricao, 320)}`,
        r.orientacao_implementacao && `Como cumprir: ${trunc(r.orientacao_implementacao, 320)}`,
      ].filter(Boolean).join(' | ');
      return `- [${r.codigo || 'S/C'}] ${r.titulo}${r.categoria ? ` (${r.categoria})` : ''}${gapTag}${exige ? `\n    ${exige}` : ''}`;
    };

    // Agrupado por framework — cada bloco tem de ser coberto no documento.
    const blocks = ids.map((fid) => {
      const rows = (reqs as any[]).filter((r) => r.framework_id === fid);
      if (!rows.length) return '';
      return `### FRAMEWORK: ${fwName.get(fid) || fid} (${rows.length} requisitos)\n${rows.map(renderLine).join('\n')}`;
    }).filter(Boolean);

    return blocks.join('\n\n');
  } catch (error) {
    console.error('Error fetching framework requirements:', error);
    return '';
  }
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let { 
      message, 
      conversation_id, 
      user_id, 
      empresa_id,
      action = 'chat',
      doc_type_hint,
      framework_context,
      company_context: company_context_input,
      // Onda 3
      document,            // documento gerado completo (para refine_section / quick_adherence)
      section_index,       // índice da seção a refinar
      instruction,         // instrução do usuário para refinar a seção
      refine_attempt,      // número da tentativa (action auto_refine)
      conversation_title,  // título legível (modelo + data) definido pelo cliente
      briefing_text,       // briefing completo (modo "gerar documento direto", sem etapa de chat)
      doc_control,         // controlo documental (ISO 27001 7.5) + papéis reais informados no briefing


    } = await req.json();

    console.log('DocGen Chat request:', { message, conversation_id, action, user_id, empresa_id, framework_context });

    // ============ ACTION: load_company_context (sem custo de IA) ============
    if (action === 'load_company_context') {
      // === AUTH: validate JWT and derive empresa_id from caller's profile ===
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const verifier = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || SUPABASE_SERVICE_ROLE_KEY);
      const { data: userData, error: userErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: callerProfile } = await supabase
        .from('profiles').select('empresa_id, role').eq('user_id', userData.user.id).maybeSingle();
      // Override body empresa_id with the authenticated user's empresa (super_admin can pass any).
      const effectiveEmpresaId = callerProfile?.role === 'super_admin'
        ? (empresa_id ?? callerProfile?.empresa_id)
        : callerProfile?.empresa_id;
      if (!effectiveEmpresaId) {
        return new Response(JSON.stringify({ error: 'empresa_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Reassign for downstream queries below
      // eslint-disable-next-line no-var
      var empresa_id_resolved = effectiveEmpresaId;

      const [empresaRes, ativosRes, riscosRes, frameworksRes] = await Promise.all([
        supabase
          .from('empresas')
          .select('nome, cnpj, setor_atuacao, porte_empresa, objetivo_compliance, data_alvo_certificacao')
          .eq('id', empresa_id_resolved)
          .maybeSingle(),
        supabase
          .from('ativos')
          .select('nome, tipo, criticidade, proprietario')
          .eq('empresa_id', empresa_id_resolved)
          .in('criticidade', ['critica', 'alta', 'crítica'])
          .limit(8),
        supabase
          .from('riscos')
          .select('nome, nivel_risco_residual, status, categoria_id')
          .eq('empresa_id', empresa_id_resolved)
          .in('nivel_risco_residual', ['critico', 'alto', 'crítico'])
          .limit(8),
        supabase
          .from('gap_analysis_assessments')
          .select('framework_id, percentual_conclusao, status, gap_analysis_frameworks(nome, versao)')
          .eq('empresa_id', empresa_id_resolved)
          .order('updated_at', { ascending: false })
          .limit(10),
      ]);

      const company_context = {
        empresa: empresaRes.data || null,
        ativos_criticos: (ativosRes.data || []).map((a: any) => ({
          nome: a.nome, tipo: a.tipo, criticidade: a.criticidade, proprietario: a.proprietario,
        })),
        riscos_altos: (riscosRes.data || []).map((r: any) => ({
          nome: r.nome, nivel: r.nivel_risco_residual, status: r.status,
        })),
        frameworks: (frameworksRes.data || []).map((f: any) => ({
          framework_id: f.framework_id,
          nome: f.gap_analysis_frameworks?.nome,
          versao: f.gap_analysis_frameworks?.versao,
          score: f.percentual_conclusao,
          status: f.status,
        })).filter((f: any) => f.nome),
      };

      return new Response(JSON.stringify({ company_context }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ AUTH guard for all other actions ============
    // Trust only the JWT — never the empresa_id/user_id from the request body.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const verifier = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || SUPABASE_SERVICE_ROLE_KEY);
    const { data: authUserData, error: authUserErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authUserErr || !authUserData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authedUserId = authUserData.user.id;
    const { data: callerProfile } = await supabase
      .from('profiles').select('empresa_id, role').eq('user_id', authedUserId).maybeSingle();
    const authedEmpresaId = callerProfile?.role === 'super_admin'
      ? (empresa_id ?? callerProfile?.empresa_id)
      : callerProfile?.empresa_id;
    if (!authedEmpresaId) {
      return new Response(JSON.stringify({ error: 'Forbidden: empresa not found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Override body-supplied values with authenticated values (nunca confiar no body)
    user_id = authedUserId;
    empresa_id = authedEmpresaId;

    // Validação de payload ANTES de consumir crédito (evita cobrança em chamadas malformadas).
    if (action === 'refine_section' && (!document || typeof section_index !== 'number' || !instruction)) {
      return new Response(JSON.stringify({ error: 'document, section_index e instruction são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (action === 'auto_refine' && (!document || !Array.isArray(document?.secoes) || !document.secoes.length)) {
      return new Response(JSON.stringify({ error: 'document com seções é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (action === 'refine_document' && (!document || !instruction)) {
      return new Response(JSON.stringify({ error: 'document e instruction são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (action === 'quick_adherence' && (!document || !framework_context?.framework_id)) {
      return new Response(JSON.stringify({ error: 'document e framework_context.framework_id são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Crédito consumido apenas após sucesso da IA — cada handler (generate/refine)
    // chama consume_ai_credit no seu retorno bem-sucedido. Manter um único ponto
    // de consumo por ação evita cobranças em chamadas malformadas ou erros de gateway.
    const chargeAiCredit = async () => {
      try {
        await supabase.rpc('consume_ai_credit', {
          p_empresa_id: authedEmpresaId,
          p_user_id: authedUserId,
          p_funcionalidade: `docgen-chat:${action}`,
          p_descricao: `DocGen - ${action === 'generate_document' ? 'Geração de documento' : 'Chat conversacional'}`,
        });
      } catch (e) { console.warn('consume_ai_credit falhou:', e); }
    };
    // NOTA: cada handler (generate_document, refine_section, refine_document,
    // quick_adherence, chat) deve chamar `await chargeAiCredit()` após produzir
    // conteúdo com sucesso e antes de retornar a Response 200.


    // Buscar informações do usuário e empresa
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('user_id', user_id)
      .single();

    const { data: empresa } = await supabase
      .from('empresas')
      .select('nome')
      .eq('id', empresa_id)
      .single();

    // Fetch framework gaps if context provided
    let frameworkGapsText = '';
    if (framework_context?.framework_id && empresa_id) {
      frameworkGapsText = await fetchFrameworkGaps(supabase, framework_context.framework_id, empresa_id);
    }

    // Buscar ou criar conversa — SEMPRE filtrar por empresa_id + user_id (cross-tenant guard)
    let conversation;
    if (conversation_id) {
      const { data } = await supabase
        .from('docgen_conversations')
        .select('*')
        .eq('id', conversation_id)
        .eq('empresa_id', authedEmpresaId)
        .eq('user_id', authedUserId)
        .maybeSingle();
      if (!data) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      conversation = data;
    }

    if (!conversation) {
      const { data: newConversation, error: newConversationError } = await supabase
        .from('docgen_conversations')
        .insert({
          empresa_id,
          user_id,
          titulo: conversation_title
            || [
                 doc_type_hint || framework_context?.framework_name || 'Documento',
                 new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
               ].join(' — '),
          mensagens: [],
          contexto: {
            user_name: profile?.nome?.trim() || '',
            empresa_nome: empresa?.nome?.trim() || '',

            etapa_atual: 'inicio',
            ...(framework_context && { framework_context })
          }
        })
        .select()
        .maybeSingle();
      // Falhar aqui é barato; falhar depois da geração custa minutos de IA e um
      // crédito ao usuário. Por isso abortamos ANTES de chamar o modelo.
      if (newConversationError || !newConversation) {
        console.error('Falha ao criar docgen_conversations:', newConversationError);
        return new Response(
          JSON.stringify({
            error: 'CONVERSATION_CREATE_FAILED',
            message: 'Não foi possível iniciar a sessão do gerador de documentos.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      conversation = newConversation;
    }


    const context: ConversationContext = conversation?.contexto || {};
    const messages: ChatMessage[] = conversation?.mensagens || [];

    // Nomes reais sempre vencem o que ficou guardado no contexto (conversas
    // antigas trazem os genéricos "Empresa"/"Usuário", que acabavam no documento).
    const empresaNomeReal = empresa?.nome?.trim();
    const profileNomeReal = profile?.nome?.trim();
    if (empresaNomeReal) context.empresa_nome = empresaNomeReal;
    else if (context.empresa_nome === 'Empresa') context.empresa_nome = '';
    if (profileNomeReal) context.user_name = profileNomeReal;
    else if (context.user_name === 'Usuário') context.user_name = '';


    if (action === 'chat') {
      messages.push({ role: 'user', content: message });

      const { data: templates } = await supabase
        .from('docgen_templates')
        .select('*')
        .or(`empresa_id.eq.${empresa_id},is_system.eq.true`);

      let learningPatterns = [];
      try {
        const { data: patterns } = await supabase
          .from('docgen_learning_patterns')
          .select('*')
          .eq('empresa_id', empresa_id)
          .eq('tipo_documento', context.tipo_documento_identificado || 'geral')
          .order('taxa_sucesso', { ascending: false })
          .limit(5);
        learningPatterns = patterns || [];
      } catch (error) {
        console.log('Learning patterns not available:', error);
      }

      const frameworkSection = framework_context?.framework_name
        ? `\nCONTEXTO DO FRAMEWORK: O usuário está trabalhando com o framework "${framework_context.framework_name}". O documento gerado deve estar alinhado a este framework e endereçar os gaps identificados.${frameworkGapsText}`
        : '';

      // ========== Contexto automático da empresa (Onda 2) ==========
      const cc: any = company_context_input || (context as any).company_context || null;
      let companyContextSection = '';
      if (cc) {
        const emp = cc.empresa || {};
        const fmt = (arr: any[], render: (x: any) => string, max = 5) =>
          (arr || []).slice(0, max).map(render).join('\n');
        companyContextSection = `

CONTEXTO REAL DA EMPRESA (use estes dados para personalizar o documento — NÃO peça ao usuário informações já presentes aqui):
- Razão social: ${emp.nome || 'N/A'}
- CNPJ: ${emp.cnpj || 'N/A'}
- Setor: ${emp.setor_atuacao || 'N/A'}
- Porte: ${emp.porte_empresa || 'N/A'}
- Objetivo de compliance: ${emp.objetivo_compliance || 'N/A'}
${cc.frameworks?.length ? `\nFrameworks ativos da empresa:\n${fmt(cc.frameworks, (f: any) => `- ${f.nome}${f.versao ? ' ' + f.versao : ''} (score ${Number(f.score || 0)}%, ${f.status || 'em andamento'})`)}` : ''}
${cc.ativos_criticos?.length ? `\nAtivos críticos (top ${Math.min(cc.ativos_criticos.length, 5)}):\n${fmt(cc.ativos_criticos, (a: any) => `- ${a.nome} (${a.tipo || 'ativo'}, criticidade ${a.criticidade})`)}` : ''}
${cc.riscos_altos?.length ? `\nRiscos altos/críticos (top ${Math.min(cc.riscos_altos.length, 5)}):\n${fmt(cc.riscos_altos, (r: any) => `- ${r.nome} (nível ${r.nivel}, ${r.status || ''})`)}` : ''}`;
      }

      const systemPrompt = `Você é DocGen, um especialista em documentação corporativa altamente qualificado, com amplo conhecimento em frameworks de compliance, regulamentações e melhores práticas empresariais.

CONTEXTO DA CONVERSA:
- Empresa: ${context.empresa_nome}
- Usuário: ${context.user_name}
- Documento solicitado: ${doc_type_hint || 'documento corporativo'}
${frameworkSection}${companyContextSection}

SEU OBJETIVO:
Ajudar o usuário a criar documentos corporativos de alta qualidade, fazendo perguntas inteligentes e específicas para coletar informações precisas.${framework_context?.framework_name ? ` O documento deve endereçar os gaps de conformidade do framework ${framework_context.framework_name}.` : ''}

INSTRUÇÕES DE COMUNICAÇÃO:
1. **Seja conversacional e profissional** - Use um tom amigável mas competente
2. **Faça perguntas específicas** - NO MÁXIMO 4-6 perguntas por vez, mas seja muito específico
3. **Formate sua resposta claramente** - Use listas numeradas, negrito, e estrutura organizada
4. **Demonstre conhecimento** - Mencione frameworks relevantes (ISO 27001, LGPD, COSO, etc.)
5. **Seja prático** - Foque em informações que realmente impactam o documento final

TIPOS DE DOCUMENTOS ESPECIALIZADOS:
**Políticas Corporativas:** Segurança da Informação, Senhas, Mesa Limpa, LGPD, Código de Ética
**Procedimentos Operacionais:** Backup, Gestão de Incidentes, Controle de Acesso, Gestão de Mudanças
**Documentos de Compliance:** Plano de Continuidade, Análise de Impacto (BIA), ROPA, Matriz de Riscos

REGRAS PARA IDENTIFICAR QUANDO GERAR DOCUMENTO:
- O usuário respondeu pelo menos 3-4 rodadas de perguntas específicas
- Você coletou informações sobre: objetivo, escopo, responsabilidades, e procedimentos básicos
- O usuário demonstra que tem as informações necessárias

QUANDO ESTIVER PRONTO PARA GERAR O DOCUMENTO:
Você SÓ deve sinalizar prontidão quando tiver coletado, no MÍNIMO:
- Tipo e nome exato do documento
- Objetivo claro
- Escopo (a quem se aplica)
- Responsabilidades principais
- Pelo menos 2 diretrizes/procedimentos específicos do contexto da empresa

Quando — e SOMENTE quando — todas essas condições estiverem satisfeitas, finalize sua mensagem com uma frase de confirmação ("Tenho todas as informações necessárias para gerar a [NOME DO DOCUMENTO]...") e termine a mensagem com o marcador EXATO em uma linha separada:

[DOCGEN_READY]

Esse marcador é OBRIGATÓRIO para liberar a geração. Nunca o emita antes de coletar todos os itens acima. Nunca o use em respostas que ainda contenham perguntas pendentes.

IMPORTANTE: Sempre responda em português brasileiro. Responda SOMENTE com uma mensagem limpa e formatada. NÃO inclua JSON visível ou metadados técnicos (exceto o marcador [DOCGEN_READY] quando aplicável).`;

      // Call Claude for chat
      const aiMessage = await callClaude(
        messages.slice(-15),
        systemPrompt,
        LOVABLE_API_KEY,
        2000,
        0.8
      );
      await chargeAiCredit();

      console.log('AI Response length:', aiMessage.length);

      // Detecta marcador explícito [DOCGEN_READY] emitido pelo modelo quando coletou tudo.
      // Mantém heurística antiga apenas como fallback de robustez (mensagem deve conter
      // múltiplos sinais simultaneamente para evitar falso-positivo).
      const hasExplicitReady = /\[DOCGEN_READY\]/i.test(aiMessage);

      // Remove o marcador e blocos json antes de devolver ao frontend
      const cleanMessage = aiMessage
        .replace(/\[DOCGEN_READY\]/gi, '')
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/```[\s\S]*?```/g, (block) => block)
        .trim() || aiMessage.trim();

      const messageText = cleanMessage.toLowerCase();
      // Fallback exige 2 sinais distintos para reduzir falso-positivo
      const fallbackSignals = [
        messageText.includes('tenho todas as informações'),
        messageText.includes('posso gerar') && messageText.includes('clique'),
        messageText.includes('documento está pronto'),
      ].filter(Boolean).length;
      const isDocumentReady = hasExplicitReady || fallbackSignals >= 1;

      // extractFrameworks retorna sempre string[] (possivelmente vazio) — não sobrescrever
      // frameworks já detectados em turnos anteriores só porque este turno não citou nenhum.
      const detectedFrameworks = extractFrameworks(messageText);
      const parsedResponse: any = {
        message: cleanMessage,
        tipo_documento_identificado:
          extractDocumentType(messageText) || context.tipo_documento_identificado,
        documento_nome_identificado:
          extractDocumentName(messageText) || (context as any).documento_nome_identificado,
        frameworks_relacionados:
          detectedFrameworks.length ? detectedFrameworks : (context as any).frameworks_relacionados,
        etapa_atual: isDocumentReady ? 'pronto' : (context.etapa_atual || 'coleta'),
        documento_pronto: isDocumentReady,
        termos_com_tooltip: [],
        informacoes_necessarias: [],
      };

      messages.push({ role: 'assistant', content: parsedResponse.message });

      const updatedContext = {
        ...context,
        tipo_documento_identificado: parsedResponse.tipo_documento_identificado || 
                                    extractDocumentType(messageText) || 
                                    context.tipo_documento_identificado,
        documento_nome_identificado: parsedResponse.documento_nome_identificado || 
                                    extractDocumentName(messageText) || 
                                    (context as any).documento_nome_identificado,
        frameworks_relacionados: parsedResponse.frameworks_relacionados ||
                                (context as any).frameworks_relacionados,
        etapa_atual: isDocumentReady ? 'pronto' : (parsedResponse.etapa_atual || 'coleta'),
        documento_pronto: isDocumentReady,
        informacoes_coletadas: {
          ...context.informacoes_coletadas,
          ...(parsedResponse.informacoes_coletadas || {})
        },
        company_context: cc || (context as any).company_context || null,
      };

      try {
        if (parsedResponse.tipo_documento_identificado && parsedResponse.message) {
          await supabase
            .from('docgen_learning_patterns')
            .upsert({
              empresa_id,
              tipo_documento: parsedResponse.tipo_documento_identificado,
              pergunta_padrao: parsedResponse.message.substring(0, 200),
              contexto_aplicacao: {
                etapa: parsedResponse.etapa_atual,
                frameworks_mencionados: parsedResponse.frameworks_relacionados || [],
                user_input_context: message.substring(0, 100)
              },
              numero_usos: 1
            }, {
              onConflict: 'empresa_id,tipo_documento,pergunta_padrao',
              ignoreDuplicates: false
            });
        }
      } catch (learningError) {
        console.log('Learning data collection failed:', learningError);
      }

      await supabase
        .from('docgen_conversations')
        .update({
          mensagens: messages,
          contexto: updatedContext,
          tipo_documento_identificado: parsedResponse.tipo_documento_identificado,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

      return new Response(JSON.stringify({
        conversation_id: conversation.id,
        message: parsedResponse.message,
        tipo_documento_identificado: updatedContext.tipo_documento_identificado,
        documento_nome_identificado: updatedContext.documento_nome_identificado || null,
        termos_com_tooltip: parsedResponse.termos_com_tooltip || [],
        etapa_atual: updatedContext.etapa_atual,
        documento_pronto: isDocumentReady,
        informacoes_necessarias: parsedResponse.informacoes_necessarias || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'generate_document') {
      // Modo "gerar direto": não houve etapa de chat, então o briefing entra
      // como a primeira mensagem da conversa (para transcript e restauração).
      if (briefing_text && messages.length === 0) {
        messages.push({ role: 'user', content: String(briefing_text) });
        await supabase
          .from('docgen_conversations')
          .update({ mensagens: messages, updated_at: new Date().toISOString() })
          .eq('id', conversation.id);
      }
      const { data: templates } = await supabase
        .from('docgen_templates')
        .select('*')
        .or(`empresa_id.eq.${empresa_id},is_system.eq.true`);

      const hintName = (doc_type_hint || (context as any).documento_nome_identificado || '').toLowerCase();
      let template = templates?.find(t => (t.nome || '').toLowerCase() === hintName)
        || templates?.find(t => hintName && (t.nome || '').toLowerCase().includes(hintName))
        || templates?.find(t => t.tipo_documento === context.tipo_documento_identificado);
      
      if (!template) {
        const docType = context.tipo_documento_identificado || 'politica';
        if (docType === 'politica' || hintName.includes('política') || hintName.includes('politica')) {
          template = templates?.find(t => t.tipo_documento === 'politica') || templates?.[0];
        } else if (docType === 'procedimento' || hintName.includes('procedimento')) {
          template = templates?.find(t => t.tipo_documento === 'procedimento') || templates?.[0];
        } else {
          template = templates?.[0];
        }
      }
      
      if (!template) {
        throw new Error('Nenhum template disponível no sistema');
      }

      let templateEstrutura: any = template.estrutura;
      try {
        if (typeof templateEstrutura === 'string') {
          templateEstrutura = JSON.parse(templateEstrutura);
        }
      } catch (_e) {}

      const frameworkGapsSection = frameworkGapsText
        ? `\n\nIMPORTANTE — O documento deve endereçar os seguintes gaps de conformidade identificados no framework "${framework_context?.framework_name}":\n${frameworkGapsText}\n\nInclua seções, controles ou procedimentos específicos que resolvam cada gap listado.`
        : '';

      // O documento é escrito e avaliado contra TODOS os frameworks escolhidos
      // para ele (antes truncávamos para o primeiro e o 2.º era ignorado). O
      // denominador continua honesto porque `resolveDocumentScope` reduz cada
      // catálogo ao subconjunto temático do documento.
      const docFwIds: string[] = Array.from(new Set([
        ...(framework_context?.framework_ids || []),
        ...(framework_context?.framework_id ? [framework_context.framework_id] : []),
      ].filter(Boolean))) as string[];


      const docNome = (context as any).documento_nome_identificado || doc_type_hint || context.tipo_documento_identificado;
      let frameworkRequirementsText = '';
      if (docFwIds.length && empresa_id) {
        frameworkRequirementsText = await fetchFrameworkRequirements(supabase, docFwIds, empresa_id);
      }
      const frameworkRequirementsSection = frameworkRequirementsText
        ? `\n\n=== REQUISITOS DO(S) FRAMEWORK(S) — COBERTURA OBRIGATÓRIA ===
Abaixo estão os requisitos catalogados, AGRUPADOS POR FRAMEWORK. Antes de escrever o documento:
1) Identifique, EM CADA BLOCO DE FRAMEWORK, quais requisitos tratam do TEMA deste documento ("${docNome}").
2) TODOS os frameworks listados têm de ser endereçados. Se houver mais de um bloco, a seção "Referências Normativas" e o coverage_map DEVEM conter requisitos de CADA UM deles (ex.: cláusulas e Anexo A da ISO 27001 E critérios Common Criteria do SOC 2). Nunca escreva o documento contra um só framework quando há vários.
3) Garanta que o documento CUMPRA EXPLICITAMENTE cada requisito relevante — incorpore o que ele exige (descrição/orientação) nas seções apropriadas, com regras concretas e acionáveis.
4) Cite o código do requisito entre colchetes onde ele é endereçado (ex.: "[A.8.13]", "[CC6.1]").
5) Priorize os requisitos marcados como GAP.
6) Não invente requisitos fora desta lista.
7) OBRIGATÓRIO: no final devolva um coverage_map explícito ligando cada requisito relevante à(s) seção(ões) que o endereça(m), com o trecho-evidência.

${frameworkRequirementsText}`
        : '';


      // Transcrição real do briefing/chat — as respostas do usuário PRECISAM
      // chegar ao prompt de geração, senão o documento sai genérico.
      const transcript = (messages || [])
        .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .slice(-30)
        .map((m: any) => `[${m.role === 'user' ? 'USUÁRIO' : 'ASSISTENTE'}] ${String(m.content).slice(0, 1500)}`)
        .join('\n\n');
      const briefingBlock = String(briefing_text || '').trim();
      const transcriptFull = [briefingBlock ? `[USUÁRIO] ${briefingBlock.slice(0, 4000)}` : '', transcript]
        .filter(Boolean).join('\n\n');
      const transcriptSection = transcriptFull
        ? `\n\n=== RESPOSTAS DO USUÁRIO NO BRIEFING (FONTE DE VERDADE) ===
Abaixo está a conversa real entre o assistente e o usuário. INCORPORE LITERALMENTE prazos,
nomes de sistemas, papéis, valores, exceções, políticas internas, retenções, responsáveis e
qualquer particularidade citada pelo usuário. Se houver conflito entre o template padrão e o
que o usuário disse, PREVALEÇA A RESPOSTA DO USUÁRIO. Não repita perguntas — use o que já
foi respondido.

${transcriptFull}
=== FIM DAS RESPOSTAS DO USUÁRIO ===`
        : '';

      // === Controlo documental (ISO 27001 7.5) e papéis reais ===
      // Vem do briefing. Sem isto a IA inventa cargos (RACI) e omite
      // proprietário/aprovador/periodicidade — o documento não passa auditoria.
      const dc = (doc_control && typeof doc_control === 'object') ? doc_control : {};
      const dcRoles: string[] = Array.isArray(dc.roles) ? dc.roles.filter((r: any) => String(r || '').trim()) : [];
      const dcOwner = String(dc.owner || '').trim();
      const dcApprover = String(dc.approver || '').trim();
      const dcFrequency = String(dc.review_frequency || '').trim() || 'Anual';
      const dcClassification = String(dc.classification || '').trim() || 'Interna';
      const dcInlineRefs = dc.inline_refs !== false;

      const raciColumns = dcRoles.length
        ? dcRoles.join(' | ')
        : 'Responsável pela Segurança da Informação | Gestor da Área | Equipa de TI | Colaborador';
      const rolesRule = dcRoles.length
        ? `- A matriz RACI SÓ pode usar estes cargos, informados pela empresa: ${dcRoles.join(', ')}. É PROIBIDO inventar outros cargos, comités ou funções (não escreva CISO, DPO, Comité de Segurança etc. se não estiverem nesta lista).`
        : `- A empresa NÃO informou os cargos existentes. Use APENAS designações funcionais genéricas ("Responsável pela Segurança da Informação", "Gestor da Área", "Equipa de TI", "Colaborador") e acrescente, na seção "Premissas a validar", a premissa de que estes papéis precisam ser atribuídos a cargos reais. NUNCA afirme que a empresa possui CISO, DPO, Comité de Segurança ou qualquer estrutura que não tenha sido informada.`;

      const docControlSection = `\n\n=== CONTROLO DOCUMENTAL (ISO 27001, cláusula 7.5) ===
PROPRIETÁRIO_DO_DOCUMENTO: ${dcOwner || '(não informado — escreva "A definir" e registe como premissa a validar)'}
APROVADOR: ${dcApprover || '(não informado — escreva "A definir" e registe como premissa a validar)'}
PERIODICIDADE_DE_REVISÃO: ${dcFrequency}
CLASSIFICAÇÃO: ${dcClassification}
CARGOS_REAIS_INFORMADOS: ${dcRoles.length ? JSON.stringify(dcRoles) : '[]'}
REFERÊNCIAS_INLINE: ${dcInlineRefs ? 'sim' : 'não (os códigos vão apenas no coverage_map / anexo de rastreabilidade)'}`;

      const documentPrompt = `Você é um consultor sênior de GRC de uma firma Big Four com 20+ anos redigindo políticas e procedimentos corporativos auditáveis. Escreva no idioma português (Brasil), tom formal-institucional, voz ativa, frases curtas e verificáveis. NUNCA use jargão vazio ("robusto", "estado da arte", "world class"), NUNCA use placeholders ("preencher", "TBD", "XXX", "lorem ipsum"), NUNCA copie o nome do requisito como se fosse conteúdo. Cada afirmação deve ser AUDITÁVEL (quem faz, o quê, quando, com que evidência).

DOCUMENTO_EXATO: ${docNome}
FRAMEWORKS_REQUERIDOS: ${JSON.stringify((context as any).frameworks_relacionados || (framework_context ? [framework_context.framework_name] : []))}
EMPRESA: ${context.empresa_nome}
DATA_ATUAL: ${new Date().toISOString().slice(0, 10)} (use EXATAMENTE esta data onde precisar de data; NÃO invente outra)${docControlSection}
${frameworkRequirementsSection || frameworkGapsSection}${transcriptSection}

Use a estrutura do template abaixo e cubra explicitamente os requisitos do(s) framework(s) citado(s) quando aplicável.

TEMPLATE: ${JSON.stringify(templateEstrutura || template.estrutura)}
INFORMAÇÕES COLETADAS: ${JSON.stringify(context.informacoes_coletadas)}

REGRA DE OURO — LINGUAGEM NORMATIVA (o documento é PRESCRITIVO, não um relatório):
- Este documento define o que a organização DEVE fazer. NUNCA afirme, no indicativo presente, que um controlo já existe, já está implementado, já está configurado ou já é executado ("a empresa utiliza MFA", "os acessos são revistos trimestralmente"). Escreva sempre em forma de obrigação: "deve", "é obrigatório", "cabe a", "não é permitido".
- É PROIBIDO afirmar como facto qualquer ferramenta, sistema, estrutura organizacional, certificação, contrato ou métrica que NÃO tenha sido explicitamente informada pelo usuário no briefing/conversa acima.
- Quando um controlo for necessário mas a sua existência não tiver sido confirmada, escreva-o como requisito ("deve ser implantado…") e registe-o na seção "Premissas a validar".
- Valores sugeridos por boa prática devem ser marcados no texto com "(valor sugerido — validar)" e também listados nas premissas.

Regras editoriais (obrigatórias):
- Cada seção com no mínimo 3 parágrafos SUBSTANTIVOS (300+ caracteres cada) ou uma lista numerada com pelo menos 5 itens acionáveis.
- Seções "Papéis e Responsabilidades" DEVEM conter uma tabela RACI em MARKDOWN (formato GFM): linhas = atividades; colunas = Atividade | ${raciColumns}, preenchidas com R/A/C/I.
${rolesRule}
- Seções "Vigência", "Aprovação" e "Controle de Versões" DEVEM citar data real (DATA_ATUAL), o PROPRIETÁRIO_DO_DOCUMENTO, o APROVADOR e a PERIODICIDADE_DE_REVISÃO acima (se algum estiver "A definir", escreva "A definir" e registe a premissa).
- Onde houver métrica (retenção, RTO/RPO, prazos), traga valores CONCRETOS coerentes com o briefing do usuário. Se o usuário não deu, escolha um valor de mercado defensável e cite "(valor sugerido — validar)".
- RECOMENDAÇÕES TÉCNICAS ATUAIS: siga a prática vigente (NIST SP 800-63B e equivalentes). NÃO exija rotação periódica obrigatória de senhas sem indício de comprometimento; privilegie frases-passe longas, verificação contra listas de senhas comprometidas, MFA resistente a phishing e bloqueio progressivo. Não recomende controlos obsoletos (troca de senha a cada 30/60/90 dias, complexidade artificial de caracteres, expiração forçada sem risco associado).
- ${dcInlineRefs
        ? 'CADA cláusula que satisfaz um requisito do framework deve conter o CÓDIGO do requisito entre colchetes (ex.: "[A.8.13]") na primeira frase da cláusula.'
        : 'NÃO insira códigos de requisito entre colchetes no corpo do texto — a rastreabilidade fica exclusivamente no coverage_map (anexo). O corpo deve ler-se como um documento corporativo limpo.'}
- Personalização real: reflita as respostas do usuário na conversa acima — não use frases genéricas quando o usuário deu um dado concreto.

FORMATAÇÃO DO CAMPO "conteudo" (markdown restrito — o exportador só entende este subconjunto):
- Subtítulos com "## " (nível 2) e "### " (nível 3). NUNCA use "# " (o título da seção já é o H1).
- Listas com marcador usando "- " e listas numeradas usando "1. ", "2. " (uma por linha; indente com 2 espaços para sub-item).
- Tabelas SEMPRE em markdown GFM com linha separadora, ex.:
  | Atividade | Gestor da Área | Equipa de TI |
  | --- | --- | --- |
  | Aprovar a política | A | C |
- Ênfase apenas com **negrito** e *itálico*. NUNCA use HTML, NUNCA use asteriscos decorativos, "===", "---" como separador, emojis ou arte ASCII.
- Parágrafos separados por uma linha em branco. Não use tabulação para alinhar texto.

Estrutura obrigatória do documento:
- Capa: título=DOCUMENTO_EXATO, versão=1.0, data=DATA_ATUAL, empresa=EMPRESA, classificação=CLASSIFICAÇÃO
- Seção "Controle Documental" (LOGO A SEGUIR AO OBJETIVO ou como 1.ª seção) com uma tabela GFM contendo: Código/identificação, Versão, Data de emissão, Proprietário do documento, Aprovador, Periodicidade de revisão, Próxima revisão (DATA_ATUAL + periodicidade), Classificação da informação, Meio de distribuição
- Seção "Objetivo" com escopo, aplicabilidade e público-alvo
- Todas as seções definidas no template acima, em ordem
- Seção "Papéis e Responsabilidades" com matriz RACI
- Seção "Premissas a validar" — OBRIGATÓRIA — listando, em tabela GFM (Premissa | Porquê é premissa | Quem valida), tudo o que foi assumido e não confirmado pela empresa (ferramentas, estruturas, cargos, prazos sugeridos)
- Seção "Referências Normativas" listando TODOS os frameworks selecionados e as cláusulas/controlos relevantes de CADA UM
- Seção "Glossário" com termos técnicos usados no documento
- Seção "Histórico de Versões" com linha inicial (1.0, DATA_ATUAL, autor, "Emissão inicial")
- Seção "Aprovação" com responsáveis e data

Responda APENAS com um JSON na seguinte estrutura (sem markdown, sem comentários):
{
  "titulo": "título do documento (igual a DOCUMENTO_EXATO)",
  "versao": "1.0",
  "data_criacao": "use o valor de DATA_ATUAL acima",
  "secoes": [
    { "nome": "Objetivo", "conteudo": "..." }
  ],
  "metadados": {
    "classificacao": "${dcClassification}",
    "responsavel_elaboracao": "${context.user_name}",
    "proprietario": "${dcOwner || 'A definir'}",
    "responsavel_aprovacao": "${dcApprover || 'A definir'}",
    "frequencia_revisao": "${dcFrequency}",
    "proxima_revisao": "data = DATA_ATUAL + periodicidade (formato AAAA-MM-DD)",
    "publico_alvo": "Todos os colaboradores"
  },
  "premissas_a_validar": [
    { "premissa": "A organização dispõe de MFA no Entra ID", "motivo": "não confirmado no briefing — o documento exige-o como controlo", "validar_com": "Equipa de TI" }
  ],
  "glossario": [ { "termo": "RTO", "definicao": "Recovery Time Objective — tempo máximo tolerável para restaurar um serviço" } ],
  "historico_versoes": [ { "versao": "1.0", "data": "DATA_ATUAL", "autor": "${context.user_name}", "descricao": "Emissão inicial" } ],
  "coverage_map": [
    { "requirement_codigo": "A.8.13", "requirement_titulo": "...", "section_indexes": [2,5], "evidencia": "trecho literal do documento (max 220 chars) que satisfaz o requisito" }
  ],
  "requisitos_nao_cobertos_justificativa": [
    { "codigo": "A.5.30", "motivo": "fora do escopo desta política específica" }
  ]
}`;


      const docContent = await callClaude(
        [{ role: 'user', content: 'Gere o documento agora, respeitando TODAS as regras editoriais.' }],
        documentPrompt,
        LOVABLE_API_KEY,
        20000,
        0.35,
        MODEL_QUALITY,
      );

      let documentContent = parseDocumentJson(docContent);

      // Uma única re-tentativa quando o JSON veio truncado/inválido: em vez de
      // degradar o documento para um bloco de texto cru, pedimos o JSON de novo.
      if (!isValidDocument(documentContent)) {
        console.log('DocGen — JSON inválido na 1ª tentativa, refazendo geração');
        const retryContent = await callClaude(
          [{ role: 'user', content: 'A resposta anterior não era um JSON válido e completo. Gere o documento novamente devolvendo APENAS o JSON no formato exigido, sem cercas de código e sem texto fora do JSON. Se necessário, seja mais conciso para caber inteiro na resposta.' }],
          documentPrompt,
          LOVABLE_API_KEY,
          20000,
          0.3,
          MODEL_QUALITY,
        );
        const retryParsed = parseDocumentJson(retryContent);
        if (isValidDocument(retryParsed)) {
          documentContent = retryParsed;
        }
      }

      if (!isValidDocument(documentContent)) {
        console.error('DocGen — documento inválido após retry');
        return new Response(
          JSON.stringify({ error: 'INVALID_DOCUMENT', message: 'A IA não devolveu um documento estruturado válido.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Crédito só é debitado quando a geração REALMENTE produziu um documento.
      await chargeAiCredit();

      // A IA não conhece a data atual (chuta valores errados). Sempre sobrescrever
      // com a data do servidor para a capa/versão do documento ficar correta.
      if (documentContent && typeof documentContent === 'object') {
        documentContent.data_criacao = new Date().toISOString().slice(0, 10);
        // Controlo documental determinístico: o que o usuário informou vence o
        // que a IA escreveu, e o que ninguém informou fica "A definir" (nunca
        // um nome inventado).
        const meses: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12, bienal: 24 };
        const freqKey = dcFrequency.toLowerCase();
        const addMonths = meses[freqKey] ?? 12;
        const next = new Date();
        next.setMonth(next.getMonth() + addMonths);
        documentContent.metadados = {
          ...(documentContent.metadados || {}),
          classificacao: dcClassification,
          proprietario: dcOwner || documentContent.metadados?.proprietario || 'A definir',
          responsavel_aprovacao: dcApprover || documentContent.metadados?.responsavel_aprovacao || 'A definir',
          responsavel_elaboracao: documentContent.metadados?.responsavel_elaboracao || context.user_name || '',
          frequencia_revisao: dcFrequency,
          proxima_revisao: next.toISOString().slice(0, 10),
          referencias_inline: dcInlineRefs,
        };
      }


      // === Onda 3: Quality gate — reescreve seções curtas ou com placeholders ===
      try {
        const weak = findWeakSections(documentContent?.secoes || []);
        if (weak.length > 0 && weak.length <= 6) {
          console.log('DocGen quality gate — retry weak sections', weak);
          const secoesTitulos = (documentContent.secoes || []).map((s: any, i: number) => `${i + 1}. ${s.nome}`).join('\n');
          const retryPrompt = `Você é o mesmo consultor sênior de GRC Big Four. As seções abaixo saíram fracas (curtas ou com placeholders). Reescreva CADA uma delas com no mínimo 3 parágrafos substantivos ou lista numerada com 5+ itens acionáveis, mantendo códigos de framework [XX.X] onde já existiam, sem placeholders, sem jargão vazio, com regras concretas. Responda APENAS JSON: { "rewrites": [ { "section_index": N, "conteudo": "..." } ] }

DOCUMENTO: ${documentContent.titulo}
EMPRESA: ${context.empresa_nome}
SEÇÕES (índice.nome): 
${secoesTitulos}

SEÇÕES PARA REESCREVER:
${weak.map(w => `- índice ${w.index} ("${w.nome}") — motivo: ${w.motivo}\n  CONTEÚDO ATUAL:\n  ${String(documentContent.secoes[w.index]?.conteudo || '').slice(0, 800)}`).join('\n\n')}`;
          const retryRaw = await callClaude(
            [{ role: 'user', content: 'Reescreva as seções fracas agora.' }],
            retryPrompt,
            LOVABLE_API_KEY,
            6000,
            0.35,
            MODEL_QUALITY,
          );
          try {
            const cleanedRetry = retryRaw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const retryParsed = JSON.parse(cleanedRetry);
            const rewrites: any[] = Array.isArray(retryParsed?.rewrites) ? retryParsed.rewrites : [];
            rewrites.forEach((r: any) => {
              const idx = Number(r?.section_index);
              const conteudo = String(r?.conteudo || '').trim();
              if (Number.isInteger(idx) && conteudo.length > 200 && documentContent.secoes[idx]) {
                documentContent.secoes[idx].conteudo = conteudo;
              }
            });
          } catch (retryParseErr) {
            console.log('DocGen quality gate parse failed', retryParseErr);
          }
        }
      } catch (qgErr) {
        console.log('DocGen quality gate skipped', qgErr);
      }


      // === Contrato de cobertura + score determinístico, com ÂMBITO honesto ===
      // O denominador é o subconjunto do catálogo que trata do TEMA deste
      // documento (mais tudo o que ele próprio declarou cobrir). A cobertura do
      // framework inteiro continua a ser reportada, mas só como informação —
      // uma política isolada nunca cobre um framework completo.
      const coverageMap: any[] = Array.isArray(documentContent?.coverage_map) ? documentContent.coverage_map : [];
      let naoCobertos: any[] = Array.isArray(documentContent?.requisitos_nao_cobertos_justificativa)
        ? documentContent.requisitos_nao_cobertos_justificativa : [];

      let catalogCodes: string[] = [];
      let scopeCodes: string[] = [];
      let residualGaps: string[] = [];
      // Base de cálculo por framework — o usuário tem de conseguir auditar o
      // score: quantos requisitos entraram no âmbito, quais foram cobertos e
      // quais ficaram de fora, em CADA referencial selecionado.
      const scoreBreakdown: Array<{ framework_id: string; framework_name: string; scope: number; covered: number; missing: string[] }> = [];
      if (docFwIds.length) {
        try {
          const { data: catalogRows } = await supabase
            .from('gap_analysis_requirements')
            .select('framework_id, codigo, titulo, descricao')
            .in('framework_id', docFwIds)
            .order('ordem', { ascending: true })
            .limit(900);
          const scope = resolveDocumentScope(
            catalogRows || [],
            documentContent?.titulo,
            (documentContent?.secoes || []).map((s: any) => s?.nome),
            coverageMap,
          );
          catalogCodes = scope.catalogCodes;
          scopeCodes = scope.scopeCodes;

          const { data: fwRows } = await supabase
            .from('gap_analysis_frameworks')
            .select('id, nome')
            .in('id', docFwIds);
          const nameById = new Map<string, string>((fwRows || []).map((f: any) => [f.id, f.nome]));
          const declaredCodes = new Set(
            coverageMap.map((c: any) => String(c?.requirement_codigo || '').trim()).filter(Boolean),
          );
          const scopeSet = new Set(scopeCodes);
          docFwIds.forEach((fid) => {
            const fwScope = (catalogRows || [])
              .filter((r: any) => r.framework_id === fid)
              .map((r: any) => String(r.codigo || '').trim())
              .filter((c: string) => c && scopeSet.has(c));
            scoreBreakdown.push({
              framework_id: fid,
              framework_name: nameById.get(fid) || '',
              scope: fwScope.length,
              covered: fwScope.filter((c) => declaredCodes.has(c)).length,
              missing: fwScope.filter((c) => !declaredCodes.has(c)).slice(0, 12),
            });
          });
        } catch (catErr) {
          console.log('DocGen catalog fetch failed (score usará somente o coverage_map declarado)', catErr);
        }
        if (scopeCodes.length) {
          naoCobertos = expandNaoCobertosFromCatalog(scopeCodes, coverageMap, naoCobertos);
          residualGaps = computeResidualGaps(scopeCodes, coverageMap, naoCobertos, 15);
          // Reflete o denominador expandido de volta no documento persistido.
          documentContent.requisitos_nao_cobertos_justificativa = naoCobertos;
        }
      }

      const inScopeNaoCobertos = filterInScope(naoCobertos);
      const initial_score = computeCoverageScore(coverageMap, naoCobertos);
      const coveredCodes = new Set(
        coverageMap.map((c: any) => String(c?.requirement_codigo || '').trim()).filter(Boolean),
      );
      const frameworkCoverage = {
        covered: catalogCodes.filter((c) => coveredCodes.has(c)).length,
        total: catalogCodes.length,
      };
      documentContent._initial_score = initial_score;
      documentContent._score_source = scopeCodes.length ? 'coverage_map+scope' : 'coverage_map';
      documentContent._catalog_size = catalogCodes.length;
      documentContent._scope_size = scopeCodes.length;
      documentContent._framework_coverage = frameworkCoverage;
      documentContent._residual_gaps = residualGaps;
      documentContent._score_breakdown = scoreBreakdown;



      console.log('DocGen generate_document compliance (pré auto-refino)', {
        framework: framework_context?.framework_name,
        coverage_items: coverageMap.length,
        catalog_size: catalogCodes.length,
        nao_cobertos_in_scope: inScopeNaoCobertos.length,
        nao_cobertos_out_scope: naoCobertos.length - inScopeNaoCobertos.length,
        residual_gaps_top: residualGaps.slice(0, 8),
        initial_score,
      });

      // === Auto-refino movido para a action `auto_refine` ===
      // O pipeline em série (geração + quality gate + 2 refinos "pro") estourava
      // o timeout da plataforma (~150s). Agora a geração retorna assim que tem
      // o documento + score, e o frontend dispara `auto_refine` por tentativa.
      const auto_refine_attempts = 0;
      const auto_refine_history: Array<{ attempt: number; before: number; after: number; gaps_targeted: string[] }> = [];
      const finalScore = initial_score;
      const should_auto_refine =
        initial_score < AUDIT_THRESHOLD &&
        residualGaps.length > 0 &&
        scopeCodes.length > 0 &&
        Array.isArray(documentContent?.secoes) &&
        documentContent.secoes.length > 0;


      documentContent._auto_refine_attempts = auto_refine_attempts;
      documentContent._auto_refine_history = auto_refine_history;

      // Recompute em cima do estado FINAL (pós auto-refino).
      const finalCoverage: any[] = Array.isArray(documentContent?.coverage_map) ? documentContent.coverage_map : coverageMap;
      const finalInScopeNaoCobertos = filterInScope(naoCobertos);
      const warnings: string[] = [];
      if (finalCoverage.length === 0 && docFwIds.length > 0) {
        warnings.push('A IA não devolveu coverage_map — a análise de compliance pode ficar inconsistente.');
      }
      if (scopeCodes.length && residualGaps.length > 0 && finalScore < AUDIT_THRESHOLD) {
        warnings.push(`${residualGaps.length} requisito(s) ainda sem cobertura. Execute o refino automático para incluí-los.`);
      }

      if (finalScore > 0 && finalScore < AUDIT_THRESHOLD) {
        warnings.push(`Score final ${finalScore}% — abaixo do gate de ${AUDIT_THRESHOLD}% (${finalInScopeNaoCobertos.length} requisito(s) sem cobertura explícita).`);
      }

      console.log('DocGen generate_document compliance (final)', {
        framework: framework_context?.framework_name,
        coverage_items: finalCoverage.length,
        catalog_size: catalogCodes.length,
        initial_score,
        final_score: finalScore,
        auto_refine_attempts,
        residual_gaps_top: residualGaps.slice(0, 8),
      });

      try {
        await supabase
          .from('docgen_feedback_implicit')
          .insert({
            empresa_id,
            conversation_id: conversation.id,
            documento_salvo: true,
            qualidade_estimada: 8,
            padroes_identificados: {
              tipo_documento: context.tipo_documento_identificado,
              secoes_geradas: documentContent.secoes?.length || 0,
              frameworks_utilizados: context.informacoes_coletadas?.frameworks || [],
              initial_score,
              final_score: finalScore,
              auto_refine_attempts,
              coverage_items: finalCoverage.length,
            }
          });
      } catch (feedbackError) {
        console.log('Feedback collection failed:', feedbackError);
      }

      // No modo "gerar direto" não há etapa de chat, logo o tipo pode não ter
      // sido identificado. A coluna é NOT NULL — usamos fallbacks seguros.
      const tipoDocumentoFinal =
        context.tipo_documento_identificado
        || template.tipo_documento
        || (doc_type_hint ? String(doc_type_hint) : '')
        || 'politica';

      const { data: generatedDoc, error: generatedDocError } = await supabase
        .from('docgen_generated_docs')
        .insert({
          empresa_id,
          conversation_id: conversation.id,
          template_id: template.id,
          nome: documentContent.titulo || tipoDocumentoFinal,
          tipo_documento: tipoDocumentoFinal,
          conteudo: documentContent,
          created_by: user_id
        })
        .select()
        .maybeSingle();

      if (generatedDocError) {
        // Persistir o rascunho é acessório: o documento gerado tem de chegar
        // ao usuário mesmo que o registo auxiliar falhe.
        console.error('Falha ao persistir docgen_generated_docs:', generatedDocError);
      }

      return new Response(JSON.stringify({
        conversation_id: conversation.id,
        document_id: generatedDoc?.id ?? null,

        document: documentContent,
        initial_score,
        final_score: finalScore,
        auto_refine_attempts,
        auto_refine_history,
        coverage_map: finalCoverage,
        residual_gaps: residualGaps,
        catalog_size: catalogCodes.length,
        should_auto_refine,
        max_refine_attempts: MAX_REFINE_ATTEMPTS,
        audit_threshold: AUDIT_THRESHOLD,
        framework_ids: docFwIds,
        warnings,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ ACTION: auto_refine (1 tentativa gap-driven por chamada) ============
    // Separada de generate_document para não estourar o timeout da plataforma.
    if (action === 'auto_refine') {
      const attempt = Math.max(1, Math.min(Number(refine_attempt) || 1, MAX_REFINE_ATTEMPTS));
      const fwIds: string[] = Array.from(new Set([
        ...(framework_context?.framework_ids || []),
        ...(framework_context?.framework_id ? [framework_context.framework_id] : []),
      ].filter(Boolean))) as string[];


      // Mesmo âmbito usado na geração — o refino não pode perseguir requisitos
      // que não pertencem ao tema do documento.
      let catalogCodes: string[] = [];
      if (fwIds.length) {
        const { data: catalogRows } = await supabase
          .from('gap_analysis_requirements')
          .select('codigo, titulo, descricao')
          .in('framework_id', fwIds)
          .order('ordem', { ascending: true })
          .limit(600);
        catalogCodes = resolveDocumentScope(
          catalogRows || [],
          document?.titulo,
          (document?.secoes || []).map((s: any) => s?.nome),
          Array.isArray(document?.coverage_map) ? document.coverage_map : [],
        ).scopeCodes;
      }


      const currentCoverage: any[] = Array.isArray(document?.coverage_map) ? document.coverage_map : [];
      const currentNaoCob: any[] = Array.isArray(document?.requisitos_nao_cobertos_justificativa)
        ? document.requisitos_nao_cobertos_justificativa : [];
      const gaps = catalogCodes.length
        ? computeResidualGaps(catalogCodes, currentCoverage, currentNaoCob, 15)
        : (Array.isArray(document?._residual_gaps) ? document._residual_gaps : []);

      const result = await autoRefineOnce({
        documentContent: document,
        catalogCodes,
        residualGaps: gaps,
        empresaNome: context.empresa_nome || '',
        frameworkName: framework_context?.framework_name,
        apiKey: LOVABLE_API_KEY,
        attempt,
      });

      if (result.changed) await chargeAiCredit();

      const history = Array.isArray(document._auto_refine_history) ? document._auto_refine_history : [];
      if (result.changed) {
        history.push({ attempt, before: result.before, after: result.after, gaps_targeted: result.gaps_targeted });
      }
      document._auto_refine_history = history;
      document._auto_refine_attempts = attempt;

      // Persiste o snapshot mais recente do documento gerado.
      try {
        const { data: latestDoc } = await supabase
          .from('docgen_generated_docs')
          .select('id')
          .eq('conversation_id', conversation.id)
          .eq('empresa_id', empresa_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestDoc?.id) {
          await supabase
            .from('docgen_generated_docs')
            .update({ conteudo: document, updated_at: new Date().toISOString() })
            .eq('id', latestDoc.id);
        }
      } catch (_e) { /* não bloqueia resposta */ }

      const converged = result.after >= AUDIT_THRESHOLD;
      const should_continue =
        result.changed &&
        !converged &&
        result.after > result.before &&
        result.residualGaps.length > 0 &&
        attempt < MAX_REFINE_ATTEMPTS;

      console.log('DocGen auto_refine', { attempt, before: result.before, after: result.after, should_continue });

      return new Response(JSON.stringify({
        document,
        attempt,
        before: result.before,
        after: result.after,
        final_score: result.after,
        changed: result.changed,
        residual_gaps: result.residualGaps,
        should_continue,
        audit_threshold: AUDIT_THRESHOLD,
        max_refine_attempts: MAX_REFINE_ATTEMPTS,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    // ============ ACTION: refine_section (Onda 3 - 1 crédito já consumido acima) ============
    if (action === 'refine_section') {
      const secoes = document.secoes || [];
      const target = secoes[section_index];
      if (!target) {
        return new Response(JSON.stringify({ error: 'Seção não encontrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // === Onda 2: refino ciente de compliance ===
      // Códigos de requisitos que esta seção sustenta hoje (para não perder cobertura).
      const currentCoverage: any[] = Array.isArray(document?.coverage_map) ? document.coverage_map : [];
      const sectionCoverage = currentCoverage.filter((c: any) =>
        Array.isArray(c?.section_indexes) && c.section_indexes.includes(section_index)
      );
      const coverageAnchor = sectionCoverage.length
        ? `\n\n=== REQUISITOS QUE ESTA SEÇÃO SUSTENTA (NÃO REMOVER) ===\n${sectionCoverage.map((c: any) => `- [${c.requirement_codigo || 'S/C'}] ${c.requirement_titulo || ''} — evidência atual: "${(c.evidencia || '').slice(0, 160)}"`).join('\n')}\n\nRegra: preserve (ou substitua por equivalente melhor) qualquer cláusula que sustenta esses requisitos. Se removê-los intencionalmente, sinalize em removed_coverage.`
        : '';

      const sysPrompt = `Você é um editor sênior de documentos corporativos com foco em compliance. Refine APENAS a seção indicada, mantendo o tom, a estrutura geral do documento, a coerência com as demais seções E toda a cobertura de requisitos que a seção sustenta. Responda SOMENTE com JSON válido no formato pedido, sem markdown.`;
      const userPrompt = `DOCUMENTO: ${document.titulo}
EMPRESA: ${context.empresa_nome}
${framework_context?.framework_name ? `FRAMEWORK: ${framework_context.framework_name}\n` : ''}
SEÇÃO ATUAL ("${target.nome}"):
${target.conteudo}

OUTRAS SEÇÕES (apenas títulos para contexto):
${secoes.map((s: any, i: number) => `${i + 1}. ${s.nome}`).join('\n')}
${coverageAnchor}

INSTRUÇÃO DO USUÁRIO:
${instruction}

Reescreva o conteúdo da seção atendendo à instrução SEM perder a cobertura de compliance.

Responda EXATAMENTE neste JSON:
{
  "new_content": "novo texto da seção",
  "coverage_kept": ["A.8.13", ...],
  "coverage_updated_evidence": [ { "requirement_codigo": "A.8.13", "evidencia": "novo trecho literal (max 220 chars)" } ],
  "removed_coverage": [ { "requirement_codigo": "...", "motivo": "..." } ]
}`;

      const raw = await callClaude(
        [{ role: 'user', content: userPrompt }],
        sysPrompt,
        LOVABLE_API_KEY,
        3000,
        0.4
      );
      await chargeAiCredit();

      let parsedRefine: any = null;
      try {
        parsedRefine = JSON.parse(raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
      } catch (_e) {
        parsedRefine = { new_content: raw.trim(), coverage_kept: [], removed_coverage: [], coverage_updated_evidence: [] };
      }
      const newContent = String(parsedRefine?.new_content || raw).trim();

      const updatedSecoes = secoes.map((s: any, i: number) =>
        i === section_index ? { ...s, conteudo: newContent } : s
      );

      // Atualiza coverage_map: mantém entradas de outras seções; para esta seção,
      // preserva itens mantidos com evidência atualizada; remove os informados em removed_coverage.
      const removedCodesArr: string[] = (parsedRefine?.removed_coverage || []).map((r: any) => String(r?.requirement_codigo || ''));
      const removedCodes = new Set(removedCodesArr);
      const keptCodes = new Set((parsedRefine?.coverage_kept || []).map((c: any) => String(c)));
      const evidenceUpdatesArr: [string, string][] = (parsedRefine?.coverage_updated_evidence || [])
        .map((e: any) => [String(e?.requirement_codigo || ''), String(e?.evidencia || '')] as [string, string]);
      const nextCoverage = applyRefineCoverage({
        currentCoverage,
        sectionIndex: section_index,
        removedCodes: removedCodesArr,
        keptCodes: Array.from(keptCodes),
        evidenceUpdates: evidenceUpdatesArr,
      });

      const complianceImpact = complianceImpactFrom(removedCodes.size);
      const updatedDoc = { ...document, secoes: updatedSecoes, coverage_map: nextCoverage };

      // Recalcula score determinístico
      const naoCobertos: any[] = Array.isArray(updatedDoc?.requisitos_nao_cobertos_justificativa)
        ? updatedDoc.requisitos_nao_cobertos_justificativa : [];
      const newScore = computeCoverageScore(nextCoverage, naoCobertos, removedCodes.size);
      updatedDoc._initial_score = newScore;
      updatedDoc._score_source = 'coverage_map';

      console.log('DocGen refine_section compliance', {
        section_index,
        removed: Array.from(removedCodes),
        kept: nextCoverage.length,
        newScore,
        complianceImpact,
      });

      // Persiste o refino no snapshot mais recente da conversa em docgen_generated_docs.
      try {
        const { data: latestDoc } = await supabase
          .from('docgen_generated_docs')
          .select('id')
          .eq('conversation_id', conversation.id)
          .eq('empresa_id', empresa_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestDoc?.id) {
          await supabase
            .from('docgen_generated_docs')
            .update({ conteudo: updatedDoc, updated_at: new Date().toISOString() })
            .eq('id', latestDoc.id);
        }
      } catch (_e) { /* não bloqueia resposta */ }

      return new Response(JSON.stringify({
        section_index,
        new_content: newContent,
        document: updatedDoc,
        compliance_impact: complianceImpact,
        removed_coverage: parsedRefine?.removed_coverage || [],
        new_score: newScore,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    // ============ ACTION: quick_adherence (Onda 3) ============
    if (action === 'quick_adherence') {
      const MAX_REQS = 150;
      const { data: reqs } = await supabase
        .from('gap_analysis_requirements')
        .select('codigo, titulo, descricao, orientacao_implementacao, exemplos_evidencias, categoria')
        .eq('framework_id', framework_context.framework_id)
        .order('ordem')
        .limit(MAX_REQS);

      if (!reqs || reqs.length === 0) {
        return new Response(JSON.stringify({ error: 'Framework sem requisitos cadastrados' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Montar o documento completo (sem cortar por seção) respeitando um teto global.
      const secoes = document.secoes || [];
      const MAX_DOC_CHARS = 28000;
      let docDigest = '';
      let usedChars = 0;
      let truncatedDoc = false;
      for (let i = 0; i < secoes.length; i++) {
        const s = secoes[i];
        const header = `### Seção ${i + 1}: ${s?.nome || ''}\n`;
        const body = String(s?.conteudo || '');
        const remaining = MAX_DOC_CHARS - usedChars - header.length;
        if (remaining <= 200) {
          truncatedDoc = true;
          break;
        }
        const chunk = body.length > remaining ? (body.slice(0, remaining) + '\n[...trecho da seção truncado por limite de contexto...]') : body;
        if (body.length > remaining) truncatedDoc = true;
        docDigest += (docDigest ? '\n\n' : '') + header + chunk;
        usedChars += header.length + chunk.length;
        if (body.length > remaining) break;
      }

      const reqList = reqs.map((r: any) => {
        let entry = `- ID:${r.codigo || 'S/C'} | ${r.titulo}`;
        if (r.descricao) entry += `\n  Descrição: ${String(r.descricao).slice(0, 260)}`;
        if (r.orientacao_implementacao) entry += `\n  Norma exige: ${String(r.orientacao_implementacao).slice(0, 180)}`;
        if (r.exemplos_evidencias) entry += `\n  Evidências esperadas: ${String(r.exemplos_evidencias).slice(0, 140)}`;
        return entry;
      }).join('\n');

      const sysPrompt = `Você é um AUDITOR SÊNIOR de conformidade com 15+ anos de experiência. Avalie um documento corporativo (política/procedimento/manual) frente aos requisitos do framework. Seja criterioso e JUSTO: cite trechos do próprio documento como evidência. Marque "nao_aplicavel" APENAS quando o requisito genuinamente não pertence ao escopo do documento. Responda APENAS com JSON válido, sem markdown.`;

      const userPrompt = `FRAMEWORK: ${framework_context.framework_name}

REQUISITOS (${reqs.length}${truncatedDoc ? ' — documento parcialmente truncado por tamanho' : ''}):
${reqList}

DOCUMENTO CORPORATIVO "${document.titulo}":
${docDigest}

CRITÉRIOS DE AVALIAÇÃO:
- "conforme": o documento cobre adequadamente o requisito com cláusulas claras.
- "parcial": menciona ou aborda em parte, mas falta detalhamento/rigor.
- "nao_conforme": o requisito é relevante ao escopo e o documento NÃO o aborda.
- "nao_aplicavel": o requisito é fora do escopo deste documento específico (ex.: firewall em política de mesa limpa).

Responda EXATAMENTE neste JSON:
{
  "score": 0-100,
  "resumo": "1-2 frases sobre aderência geral",
  "secoes": [
    { "section_index": 0, "section_name": "...", "status": "forte|parcial|fraco|ausente", "requisitos_cobertos": ["ID/código", ...], "gaps": ["o que está faltando"] }
  ],
  "requisitos_analisados": [
    { "requisito_codigo": "ID/código", "status_aderencia": "conforme|parcial|nao_conforme|nao_aplicavel", "evidencias": "citação ou referência do documento (max 120 chars)", "gaps": "o que falta (max 100 chars)" }
  ],
  "requisitos_nao_cobertos": ["códigos dos requisitos relevantes ainda não endereçados"]
}`;

      const raw = await callClaude(
        [{ role: 'user', content: userPrompt }],
        sysPrompt,
        LOVABLE_API_KEY,
        6000,
        0.3
      );
      await chargeAiCredit();

      let parsed: any;
      try {
        parsed = JSON.parse(raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
      } catch {
        parsed = { score: 0, resumo: 'Não foi possível avaliar.', secoes: [], requisitos_analisados: [], requisitos_nao_cobertos: [] };
      }

      // Fallback determinístico: se a IA não devolveu score coerente, calcular pela
      // fórmula canônica (conforme=100, parcial=50, nao_conforme=0, N/A fora do denominador).
      const analisados: any[] = Array.isArray(parsed?.requisitos_analisados) ? parsed.requisitos_analisados : [];
      if (analisados.length > 0) {
        const { score: calc, contagem } = computeAnalyzedScore(analisados);
        const { score: finalScore, source } = reconcileReportedScore(parsed?.score, calc);
        parsed.score = finalScore;
        if (source === 'deterministic') {
          parsed.score_fonte = 'determinístico (statuses por requisito)';
        }
        parsed.contagem = {
          total: contagem.total,
          conformes: contagem.conformes,
          parciais: contagem.parciais,
          nao_conformes: contagem.nao_conformes,
          nao_aplicaveis: contagem.nao_aplicaveis,
        };
      }

      console.log('quick_adherence result', {
        framework: framework_context.framework_name,
        score: parsed?.score,
        contagem: parsed?.contagem,
        truncated: truncatedDoc,
      });

      return new Response(JSON.stringify({ adherence: parsed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ ACTION: refine_document (chat pós-geração aplica refinos no documento inteiro) ============
    if (action === 'refine_document') {
      // Persistir a instrução como turno de usuário na conversa (para futuros refinos verem o histórico).
      messages.push({ role: 'user', content: instruction });

      const secoes = document.secoes || [];
      const docJson = JSON.stringify({
        titulo: document.titulo,
        versao: document.versao,
        secoes: secoes.map((s: any) => ({ nome: s.nome, conteudo: s.conteudo })),
      });

      // Injeta contexto real da empresa (mesmo padrão do generate_document/chat).
      const ccRefine: any = company_context_input || (context as any).company_context || null;
      const companyBlock = ccRefine ? `\nCONTEXTO REAL DA EMPRESA (use estes dados; não invente):\n${JSON.stringify(ccRefine).slice(0, 6000)}\n` : '';

      // === Onda 2: refino ciente de compliance ===
      const currentCoverage: any[] = Array.isArray(document?.coverage_map) ? document.coverage_map : [];
      const coverageBlock = currentCoverage.length
        ? `\n\n=== COVERAGE MAP ATUAL (NÃO PERDER COBERTURA) ===\n${currentCoverage.map((c: any) => `- [${c.requirement_codigo || 'S/C'}] ${c.requirement_titulo || ''} → seções ${JSON.stringify(c.section_indexes || [])} — evidência: "${(c.evidencia || '').slice(0, 160)}"`).join('\n')}`
        : '';

      const sysPrompt = `Você é um editor sênior de documentos corporativos com foco em compliance. Você receberá um documento em JSON, seu coverage_map atual e uma instrução do usuário. Sua tarefa:
1) Identifique QUAIS seções devem ser alteradas para atender à instrução.
2) Reescreva SOMENTE o conteúdo dessas seções, preservando literalmente o conteúdo das demais.
3) Mantenha exatamente a mesma lista de seções (mesmos nomes e mesma ordem).
4) Incorpore dados concretos citados pelo usuário e o CONTEXTO REAL DA EMPRESA quando disponível.
5) NUNCA remova uma cláusula que sustenta um requisito coberto sem substituir por equivalente. Se a instrução obrigar a remoção, sinalize o requisito impactado em removed_coverage.
6) Devolva o coverage_map ATUALIZADO refletindo onde cada requisito agora é sustentado.
6.1) LINGUAGEM NORMATIVA: o documento é prescritivo. Escreva obrigações ("deve", "é obrigatório", "cabe a"), NUNCA afirme no indicativo que um controlo, ferramenta, cargo ou estrutura já existe se isso não foi informado. Tudo o que for assumido tem de constar da seção "Premissas a validar" (crie-a se não existir).
6.2) Não recomende controlos obsoletos (rotação obrigatória de senha a cada 30/60/90 dias, complexidade artificial). Siga NIST SP 800-63B.

7) Responda SOMENTE com JSON válido, sem markdown, no formato:
{
  "sections_changed": ["Nome da seção 1", ...],
  "summary": "1 frase descrevendo a mudança",
  "document": {
    "titulo": "...",
    "versao": "...",
    "secoes": [ { "nome": "...", "conteudo": "..." } ],
    "coverage_map": [ { "requirement_codigo": "A.8.13", "requirement_titulo": "...", "section_indexes": [2], "evidencia": "trecho literal atualizado (max 220 chars)" } ]
  },
  "removed_coverage": [ { "requirement_codigo": "...", "motivo": "..." } ]
}`;

      const userPrompt = `EMPRESA: ${context.empresa_nome}
${framework_context?.framework_name ? `FRAMEWORK: ${framework_context.framework_name}\n` : ''}${companyBlock}
DOCUMENTO ATUAL (JSON):
${docJson}${coverageBlock}

INSTRUÇÃO DO USUÁRIO:
${instruction}

Aplique a instrução conforme as regras do sistema e devolva o JSON completo COM coverage_map atualizado.`;

      const raw = await callClaude(
        [{ role: 'user', content: userPrompt }],
        sysPrompt,
        LOVABLE_API_KEY,
        18000,
        0.35,
        MODEL_QUALITY,
      );
      await chargeAiCredit();

      let parsed: any = null;
      try {
        parsed = JSON.parse(raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
      } catch (_e) {
        parsed = null;
      }

      if (!parsed?.document?.secoes?.length) {
        return new Response(JSON.stringify({
          error: 'Não foi possível interpretar a resposta da IA',
        }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Coverage map final: preferir o que a IA devolveu; senão preservar o atual
      // menos os removidos explicitamente.
      const removedCodes = new Set((parsed?.removed_coverage || []).map((r: any) => String(r?.requirement_codigo || '')));
      let nextCoverage: any[] = Array.isArray(parsed?.document?.coverage_map) && parsed.document.coverage_map.length
        ? parsed.document.coverage_map
        : currentCoverage.filter((c: any) => !removedCodes.has(String(c?.requirement_codigo || '')));

      // Preserva metadados/data/logo originais; troca título/versão/seções/coverage.
      const mergedDoc = {
        ...document,
        titulo: parsed.document.titulo || document.titulo,
        versao: parsed.document.versao || document.versao,
        secoes: parsed.document.secoes,
        coverage_map: nextCoverage,
      };

      // Recalcula score determinístico
      const naoCobertos: any[] = Array.isArray(mergedDoc?.requisitos_nao_cobertos_justificativa)
        ? mergedDoc.requisitos_nao_cobertos_justificativa : [];
      const newScore = computeCoverageScore(nextCoverage, naoCobertos, removedCodes.size);
      mergedDoc._initial_score = newScore;
      mergedDoc._score_source = 'coverage_map';

      const complianceImpact = complianceImpactFrom(removedCodes.size);
      const changed: string[] = Array.isArray(parsed.sections_changed) ? parsed.sections_changed : [];
      const summary: string = typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : (changed.length
            ? `Atualizei ${changed.length === 1 ? 'a seção' : 'as seções'} ${changed.join(', ')} com base na sua observação.`
            : 'Documento atualizado com base na sua observação.');

      const summaryWithScore = complianceImpact === 'reduced'
        ? `${summary} Atenção: ${removedCodes.size} requisito(s) perderam cobertura — nova pontuação: ${newScore}%.`
        : (newScore > 0 ? `${summary} Compliance preservado: ${newScore}%.` : summary);

      messages.push({ role: 'assistant', content: summaryWithScore });

      console.log('DocGen refine_document compliance', {
        removed: Array.from(removedCodes),
        kept: nextCoverage.length,
        newScore,
        complianceImpact,
      });

      try {
        await supabase
          .from('docgen_conversations')
          .update({ mensagens: messages, updated_at: new Date().toISOString() })
          .eq('id', conversation.id);
      } catch (_e) { /* não bloqueia resposta */ }

      // Persiste o refino no snapshot mais recente em docgen_generated_docs.
      try {
        const { data: latestDoc } = await supabase
          .from('docgen_generated_docs')
          .select('id')
          .eq('conversation_id', conversation.id)
          .eq('empresa_id', empresa_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestDoc?.id) {
          await supabase
            .from('docgen_generated_docs')
            .update({ conteudo: mergedDoc, updated_at: new Date().toISOString() })
            .eq('id', latestDoc.id);
        }
      } catch (_e) { /* não bloqueia resposta */ }

      return new Response(JSON.stringify({
        document: mergedDoc,
        sections_changed: changed,
        summary: summaryWithScore,
        compliance_impact: complianceImpact,
        removed_coverage: parsed?.removed_coverage || [],
        new_score: newScore,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    return new Response(JSON.stringify({ error: 'Action not supported' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in docgen-chat function:', error);
    const isGateway = error instanceof AiGatewayError;
    const code = isGateway ? (error as AiGatewayError).code : 'INTERNAL_ERROR';
    const status = isGateway ? (error as AiGatewayError).httpStatus : 500;
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
      code,
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  }
});
