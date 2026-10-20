/**
 * Catálogo único das funcionalidades que consomem créditos de IA.
 *
 * Fonte da verdade partilhada entre:
 *  - Configurações → Créditos IA (histórico por empresa)
 *  - Configurações → Financeiro IA (custo por modelo/empresa)
 *
 * Sempre que uma Edge Function passar a chamar `consume_ai_credit`,
 * registe aqui a `funcionalidade` e o modelo efetivamente usado.
 */

export type AiModelId =
  | 'google/gemini-3.6-flash'
  | 'google/gemini-4-argon'
  | 'google/gemini-3.1-pro-preview'
  | 'google/gemini-3.1-flash-lite'
  | 'google/gemini-3-flash-preview'
  | 'google/gemini-2.5-flash'
  | 'google/gemini-3-pro-image'
  | 'openai/gpt-5.4-mini';

export interface AiModelInfo {
  id: AiModelId;
  label: string;
  provider: string;
  /** USD por 1k tokens de entrada. */
  inputPer1kTokens: number;
  /** USD por 1k tokens de saída. */
  outputPer1kTokens: number;
  /** Custo médio estimado por requisição, em BRL. */
  avgCostPerReqBRL: number;
  /** Modelo usado só como fallback automático (não aparece como primário). */
  fallbackOnly?: boolean;
  /** Já não é usado por nenhuma função; só aparece se houver uso no período. */
  descontinuado?: boolean;
}

export const AI_MODELS: Record<AiModelId, AiModelInfo> = {
  'google/gemini-4-argon': {
    id: 'google/gemini-4-argon',
    label: 'Gemini 4',
    provider: 'Google',
    inputPer1kTokens: 0.002,
    outputPer1kTokens: 0.01,
    avgCostPerReqBRL: 0.25,
  },
  'google/gemini-3.6-flash': {
    id: 'google/gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    provider: 'Google',
    inputPer1kTokens: 0.00075,
    outputPer1kTokens: 0.00375,
    avgCostPerReqBRL: 0.06,
  },
  'google/gemini-3.1-pro-preview': {
    id: 'google/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    provider: 'Google',
    inputPer1kTokens: 0.00125,
    outputPer1kTokens: 0.01,
    avgCostPerReqBRL: 0.18,
    descontinuado: true,
  },
  'google/gemini-3.1-flash-lite': {
    id: 'google/gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    provider: 'Google',
    inputPer1kTokens: 0.00025,
    outputPer1kTokens: 0.0015,
    avgCostPerReqBRL: 0.01,
  },
  'google/gemini-3-flash-preview': {
    id: 'google/gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    provider: 'Google',
    inputPer1kTokens: 0.00015,
    outputPer1kTokens: 0.0006,
    avgCostPerReqBRL: 0.03,
    descontinuado: true,
  },
  'google/gemini-2.5-flash': {
    id: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'Google',
    inputPer1kTokens: 0.0003,
    outputPer1kTokens: 0.0025,
    avgCostPerReqBRL: 0.05,
    descontinuado: true,
  },
  'google/gemini-3-pro-image': {
    id: 'google/gemini-3-pro-image',
    label: 'Gemini 3 Pro Image',
    provider: 'Google',
    inputPer1kTokens: 0.002,
    outputPer1kTokens: 0.12,
    avgCostPerReqBRL: 0.7,
  },
  'openai/gpt-5.4-mini': {
    id: 'openai/gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    provider: 'OpenAI',
    inputPer1kTokens: 0.00075,
    outputPer1kTokens: 0.0045,
    avgCostPerReqBRL: 0.05,
    fallbackOnly: true,
  },
};

/** Cotação usada para converter USD → BRL no Financeiro IA. */
export const USD_BRL = 5.5;

/** Custo real em USD de uma chamada, a partir dos tokens medidos. Null se faltar medição ou modelo. */
export function custoRealUSD(modelo: string, tokensEntrada: number | null, tokensSaida: number | null): number | null {
  const m = AI_MODELS[modelo as AiModelId];
  if (!m || tokensEntrada == null || tokensSaida == null) return null;
  return (tokensEntrada / 1000) * m.inputPer1kTokens + (tokensSaida / 1000) * m.outputPer1kTokens;
}

export interface AiFeature {
  /** Valor gravado em creditos_consumo.funcionalidade (ou o seu prefixo antes de ":"). */
  key: string;
  labelPt: string;
  labelEn: string;
  /** Módulo do produto onde o utilizador aciona a funcionalidade. */
  modulePt: string;
  moduleEn: string;
  model: AiModelId;
  /** Modelo alternativo usado em caso de falha transitória. */
  fallbackModel?: AiModelId;
  edgeFunction: string;
  /** Platform-funded content stays catalogued for historical cost attribution. */
  billing?: 'customer' | 'platform';
}

export const AI_FEATURES: AiFeature[] = [
  {
    key: 'docgen-chat',
    labelPt: 'Gerador de documentos (IA)',
    labelEn: 'AI document generator',
    modulePt: 'Documentos',
    moduleEn: 'Documents',
    model: 'google/gemini-4-argon',
    fallbackModel: 'openai/gpt-5.4-mini',
    edgeFunction: 'docgen-chat',
  },
  {
    key: 'analyze_document_adherence',
    labelPt: 'Análise de aderência de documento',
    labelEn: 'Document adherence analysis',
    modulePt: 'Gap Analysis',
    moduleEn: 'Gap Analysis',
    model: 'google/gemini-4-argon',
    edgeFunction: 'analyze-document-adherence',
  },
  {
    key: 'analyze_evidence_against_requirement',
    labelPt: 'Validação de evidência vs. requisito',
    labelEn: 'Evidence vs. requirement validation',
    modulePt: 'Gap Analysis',
    moduleEn: 'Gap Analysis',
    model: 'google/gemini-4-argon',
    edgeFunction: 'analyze-evidence-against-requirement',
  },
  {
    key: 'evidence_cross_match',
    labelPt: 'Reutilização cruzada de evidências',
    labelEn: 'Evidence cross-match',
    modulePt: 'Gap Analysis',
    moduleEn: 'Gap Analysis',
    model: 'google/gemini-4-argon',
    edgeFunction: 'evidence-cross-match',
  },
  {
    key: 'gap_analysis_ai_diagnostic',
    labelPt: 'Diagnóstico consultivo do Gap Analysis',
    labelEn: 'Gap Analysis AI diagnostic',
    modulePt: 'Gap Analysis',
    moduleEn: 'Gap Analysis',
    model: 'google/gemini-4-argon',
    edgeFunction: 'gap-analysis-ai-diagnostic',
  },
  {
    key: 'populate-requirement-guidance',
    billing: 'platform',
    labelPt: 'Orientação de requisito (individual)',
    labelEn: 'Requirement guidance (single)',
    modulePt: 'Gap Analysis',
    moduleEn: 'Gap Analysis',
    model: 'google/gemini-3.6-flash',
    edgeFunction: 'populate-requirement-guidance',
  },
  {
    key: 'populate-requirement-guidance-batch',
    billing: 'platform',
    labelPt: 'Orientação de requisitos (lote)',
    labelEn: 'Requirement guidance (batch)',
    modulePt: 'Gap Analysis',
    moduleEn: 'Gap Analysis',
    model: 'google/gemini-3.6-flash',
    edgeFunction: 'populate-requirement-guidance',
  },
  {
    key: 'translate_framework_content',
    labelPt: 'Tradução de frameworks',
    labelEn: 'Framework translation',
    modulePt: 'Gap Analysis',
    moduleEn: 'Gap Analysis',
    model: 'google/gemini-3.1-flash-lite',
    edgeFunction: 'translate-framework-content',
  },
  /*
     `calculate-assessment-score` saiu daqui.

     Está publicada, configurada e nunca é chamada por ninguém: só existem
     comentários a referi-la. Enquanto esteve no catálogo, o painel Financeiro
     IA anunciava ao administrador uma funcionalidade cobrável que não corre.

     A pontuação do questionário é feita pela RPC `calculate_due_diligence_score`
     -- aritmética, repetível e conferível --, e é isso que se quer num número
     que decide contratações. A leitura fica para a `avaliar_fornecedor_ia`,
     que está aqui em baixo. A função de borda continua publicada; removê-la
     do projeto é passo de implantação, não de código.
  */
  {
    key: 'suggest_risk_treatment',
    labelPt: 'Sugestão de tratamento de risco',
    labelEn: 'Risk treatment suggestion',
    modulePt: 'Riscos',
    moduleEn: 'Risks',
    model: 'google/gemini-4-argon',
    edgeFunction: 'suggest-risk-treatment',
  },
  {
    /* Debitada desde sempre pela `avaliar-fornecedor-ia` e ausente daqui: o
       consumo entrava no livro e o custo caía no balde «modelo
       desconhecido», com o preço por omissão em vez do real. */
    key: 'avaliar_fornecedor_ia',
    labelPt: 'Parecer de IA sobre fornecedor',
    labelEn: 'AI opinion on supplier',
    modulePt: 'Due Diligence',
    moduleEn: 'Due diligence',
    model: 'google/gemini-4-argon',
    edgeFunction: 'avaliar-fornecedor-ia',
  },
  {
    /* Endpoint retirado, mantido no catálogo para valorar corretamente o
       consumo histórico que já foi registado. */
    key: 'dashboard_ai_summary',
    labelPt: 'Resumo do painel (IA)',
    labelEn: 'Dashboard summary (AI)',
    modulePt: 'Painel',
    moduleEn: 'Dashboard',
    model: 'google/gemini-3.6-flash',
    edgeFunction: 'dashboard-ai-summary',
  },
  {
    key: 'akuria_chat',
    labelPt: 'Assistente Akuria (chat)',
    labelEn: 'Akuria assistant (chat)',
    modulePt: 'Assistente',
    moduleEn: 'Assistant',
    model: 'google/gemini-3.6-flash',
    edgeFunction: 'akuria-chat',
  },
  {
    key: 'ai-assistant',
    labelPt: 'Assistente de módulo (insights)',
    labelEn: 'Module assistant (insights)',
    modulePt: 'Transversal',
    moduleEn: 'Cross-module',
    model: 'google/gemini-3.6-flash',
    edgeFunction: 'ai-module-assistant',
  },
  {
    key: 'projeto_status_report',
    labelPt: 'Relatório de estado do projeto',
    labelEn: 'Project status report',
    modulePt: 'Projetos',
    moduleEn: 'Projects',
    model: 'google/gemini-3.6-flash',
    edgeFunction: 'projeto-status-report',
  },
  {
    key: 'projeto_suggest_tasks',
    labelPt: 'Sugestão de tarefas do projeto',
    labelEn: 'Project task suggestions',
    modulePt: 'Projetos',
    moduleEn: 'Projects',
    model: 'google/gemini-3.6-flash',
    edgeFunction: 'projeto-suggest-tasks',
  },
  {
    key: 'responder_questionario',
    labelPt: 'Resposta automática a questionário de segurança',
    labelEn: 'Automatic security questionnaire answers',
    modulePt: 'Trust Center',
    moduleEn: 'Trust Center',
    model: 'google/gemini-4-argon',
    edgeFunction: 'answer-security-questionnaire',
  },
  {
    key: 'verificar_evidencias_itens',
    labelPt: 'Verificação de evidências esperadas por item',
    labelEn: 'Expected evidence check per item',
    modulePt: 'Gap Analysis',
    moduleEn: 'Gap Analysis',
    model: 'google/gemini-4-argon',
    edgeFunction: 'verify-evidence-items',
  },
  {
    key: 'generate_email_content',
    labelPt: 'Geração de conteúdo de e-mail',
    labelEn: 'Email content generation',
    modulePt: 'Campanhas',
    moduleEn: 'Campaigns',
    model: 'google/gemini-3.6-flash',
    edgeFunction: 'generate-email-content',
  },
];

const FEATURE_BY_KEY = new Map(AI_FEATURES.map((f) => [f.key, f]));

/** Resolve `funcionalidade` (aceita sufixos "chave:acao") para a entrada do catálogo. */
export function resolveAiFeature(funcionalidade: string | null | undefined): AiFeature | null {
  if (!funcionalidade) return null;
  const direct = FEATURE_BY_KEY.get(funcionalidade);
  if (direct) return direct;
  const prefix = funcionalidade.split(':')[0];
  return FEATURE_BY_KEY.get(prefix) ?? null;
}

/** Sufixo de ação, quando existir (ex.: "docgen-chat:refine" → "refine"). */
export function aiFeatureAction(funcionalidade: string): string | null {
  const idx = funcionalidade.indexOf(':');
  return idx >= 0 ? funcionalidade.slice(idx + 1) : null;
}

const FEATURE_BY_EDGE = new Map(AI_FEATURES.map((f) => [f.edgeFunction, f]));

/**
 * Resolve pelo NOME DA FUNÇÃO (o que a rede vê), e não pela chave gravada.
 *
 * O aviso de crédito nasce no `fetch`, onde só existe `/functions/v1/<nome>`;
 * a `funcionalidade` (com o sufixo da acção) só aparece do lado do servidor.
 */
export function aiFeatureByEdgeFunction(edgeFunction: string): AiFeature | null {
  return FEATURE_BY_EDGE.get(edgeFunction) ?? null;
}

/** Rótulo a partir do nome da função, para o aviso de «gastou 1 crédito». */
export function aiEdgeFunctionLabel(edgeFunction: string, locale: string): string | null {
  const f = aiFeatureByEdgeFunction(edgeFunction);
  if (!f) return null;
  return locale.startsWith('en') ? f.labelEn : f.labelPt;
}

export function aiFeatureLabel(funcionalidade: string, locale: string): string {
  const feature = resolveAiFeature(funcionalidade);
  const en = locale.startsWith('en');
  if (!feature) return funcionalidade;
  const action = aiFeatureAction(funcionalidade);
  const base = en ? feature.labelEn : feature.labelPt;
  return action ? `${base} · ${action}` : base;
}

export function aiFeatureModuleLabel(funcionalidade: string, locale: string): string | null {
  const feature = resolveAiFeature(funcionalidade);
  if (!feature) return null;
  return locale.startsWith('en') ? feature.moduleEn : feature.modulePt;
}

export function aiModelForFuncionalidade(funcionalidade: string): AiModelInfo | null {
  const feature = resolveAiFeature(funcionalidade);
  return feature ? AI_MODELS[feature.model] : null;
}

/** Custo médio estimado (BRL) de uma requisição desta funcionalidade. */
export function aiAvgCostForFuncionalidade(funcionalidade: string): number {
  return aiModelForFuncionalidade(funcionalidade)?.avgCostPerReqBRL ?? 0.03;
}

/** Funcionalidades que usam determinado modelo como primário. */
export function featuresUsingModel(modelId: AiModelId): AiFeature[] {
  return AI_FEATURES.filter((f) => f.model === modelId);
}
