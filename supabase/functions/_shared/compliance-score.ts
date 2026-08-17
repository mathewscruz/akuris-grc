/**
 * Núcleo determinístico de scoring de compliance do DocGen ⇄ Análise de Aderência.
 *
 * Este módulo é PURO (sem I/O, sem Supabase) para permitir testes ponta a ponta
 * das regras de compliance sem depender do gateway da IA. As Edge Functions
 * `docgen-chat` e `analyze-document-adherence` importam daqui para garantir que
 * "gerado em compliance = mantém compliance após refino = mantém compliance
 * após reanálise" é a MESMA fórmula em todos os pontos do pipeline.
 */

export type StatusAderencia = 'conforme' | 'parcial' | 'nao_conforme' | 'nao_aplicavel';
export type ResultadoGeral = 'conforme' | 'parcial' | 'nao_conforme';
export type ComplianceImpact = 'preserved' | 'reduced';

export const SCORE_MAP: Record<Exclude<StatusAderencia, 'nao_aplicavel'>, number> = {
  conforme: 100,
  parcial: 50,
  nao_conforme: 0,
};

/**
 * Constantes canônicas do pipeline gerador ⇄ analisador.
 * - FRAMEWORK_REQ_CAP: teto de requisitos usado em BOTH generate_document e analyze
 *   para que os dois lados falem do mesmo universo. Frameworks maiores (PCI DSS,
 *   CIS v8) são paginados no analisador em lotes de ANALYZER_BATCH_SIZE.
 * - AUDIT_THRESHOLD: nota mínima que a self-audit exige antes de devolver o doc.
 * - MAX_REFINE_ATTEMPTS: quantas rodadas de refino gap-driven o gerador executa.
 */
export const FRAMEWORK_REQ_CAP = 300;
export const ANALYZER_BATCH_SIZE = 60;
export const ANALYZER_CONCURRENCY = 2;
export const AUDIT_THRESHOLD = 80;
export const MAX_REFINE_ATTEMPTS = 2;


export interface CoverageItem {
  requirement_codigo?: string;
  requirement_titulo?: string;
  section_indexes?: number[];
  evidencia?: string;
}

export interface NaoCobertoJustificativa {
  codigo?: string;
  motivo?: string;
}

export interface RequisitoAnalisado {
  requirement_id?: string;
  requisito_codigo?: string;
  status_aderencia?: StatusAderencia | string;
}

/**
 * Considera "fora de escopo" as justificativas que citam "fora do escopo" ou
 * "não aplicável" — essas ficam FORA do denominador do score.
 */
export function isInScope(naoCoberto: NaoCobertoJustificativa | null | undefined): boolean {
  const motivo = String(naoCoberto?.motivo || '').toLowerCase();
  if (motivo.includes('fora do escopo')) return false;
  if (motivo.includes('nao aplic')) return false;
  if (motivo.includes('não aplic')) return false;
  return true;
}

export function filterInScope(naoCobertos: NaoCobertoJustificativa[] | null | undefined): NaoCobertoJustificativa[] {
  return (naoCobertos || []).filter(isInScope);
}

/**
 * Score determinístico usado pela GERAÇÃO e por cada REFINO — reflete o
 * coverage_map declarado pelo autor/IA. Formula:
 *
 *   score = cobertos / (cobertos + naoCobertosRelevantes + removidos)
 *
 * `removedCount` (opcional) é o número de requisitos que perderam cobertura
 * durante um refino — mantê-los no denominador impede que o refino inflacione
 * o score simplesmente removendo cláusulas.
 */
export function computeCoverageScore(
  coverageMap: CoverageItem[] | null | undefined,
  naoCobertos: NaoCobertoJustificativa[] | null | undefined,
  removedCount = 0,
): number {
  const cobertos = (coverageMap || []).length;
  const inScope = filterInScope(naoCobertos).length;
  const denom = cobertos + inScope + Math.max(removedCount, 0);
  if (denom === 0) return 0;
  return Math.round((cobertos / denom) * 100);
}

export interface AnalyzedScoreResult {
  score: number;
  contagem: {
    total: number;
    conformes: number;
    parciais: number;
    nao_conformes: number;
    nao_aplicaveis: number;
    silently_missing: number;
  };
}

/**
 * Score determinístico do ANALISADOR (quick_adherence e analyze-document-adherence).
 *
 * - conforme=100, parcial=50, nao_conforme=0
 * - `nao_aplicavel` sai do denominador
 * - Requisitos que a IA deixou silenciosamente de avaliar (`silentlyMissing`)
 *   entram no denominador como `nao_conforme`, impedindo que frameworks
 *   grandes (PCI DSS ~288, CIS v8 ~153) inflacionem o score por omissão.
 */
export function computeAnalyzedScore(
  analisados: RequisitoAnalisado[] | null | undefined,
  silentlyMissing = 0,
): AnalyzedScoreResult {
  const list = analisados || [];
  const na = list.filter((r) => r?.status_aderencia === 'nao_aplicavel').length;
  const conformes = list.filter((r) => r?.status_aderencia === 'conforme').length;
  const parciais = list.filter((r) => r?.status_aderencia === 'parcial').length;
  const naoConformes = list.filter((r) => r?.status_aderencia === 'nao_conforme').length;
  const missing = Math.max(silentlyMissing, 0);
  const denom = Math.max(list.length - na + missing, 0);
  const num = list
    .filter((r) => r?.status_aderencia && r.status_aderencia !== 'nao_aplicavel')
    .reduce((s, r) => s + (SCORE_MAP[r.status_aderencia as keyof typeof SCORE_MAP] ?? 0), 0);
  const score = denom === 0 ? 0 : Math.round(num / denom);
  return {
    score,
    contagem: {
      total: list.length,
      conformes,
      parciais,
      nao_conformes: naoConformes,
      nao_aplicaveis: na,
      silently_missing: missing,
    },
  };
}

/**
 * Aplica o fallback determinístico sobre o score que a IA reportou. A IA vence
 * quando entrega um valor coerente (dentro de 25 pontos do cálculo). Caso
 * contrário, o determinístico prevalece — evita o bug de "vários conformes com
 * 0%" e o caso oposto (IA inflando score).
 */
export function reconcileReportedScore(
  reportedScore: unknown,
  deterministic: number,
  tolerance = 25,
): { score: number; source: 'ia' | 'deterministic' } {
  const reported = Number(reportedScore);
  const reportedValid = Number.isFinite(reported) && reported > 0 && reported <= 100;
  if (!reportedValid) return { score: deterministic, source: 'deterministic' };
  if (Math.abs(deterministic - reported) > tolerance) {
    return { score: deterministic, source: 'deterministic' };
  }
  return { score: Math.round(reported), source: 'ia' };
}

/** Reconcilia `resultado_geral` com o percentual final para não haver contradição no relatório. */
export function resolveResultadoGeral(pct: number): ResultadoGeral {
  if (pct >= 80) return 'conforme';
  if (pct >= 40) return 'parcial';
  return 'nao_conforme';
}

export interface RefineCoverageInput {
  currentCoverage: CoverageItem[];
  sectionIndex: number;
  removedCodes: Iterable<string>;
  keptCodes?: Iterable<string>;
  evidenceUpdates?: Iterable<[string, string]>;
}

/**
 * Recalcula o coverage_map após um refino de SEÇÃO. Regras:
 * - entradas de OUTRAS seções ficam intocadas;
 * - entradas desta seção com código em `removedCodes` são retiradas;
 * - códigos com `evidenceUpdates` recebem a nova evidência;
 * - se a IA não confirmar um código em `coverage_kept`, mantemos por segurança
 *   (compliance-first) — evita drop silencioso.
 */
export function applyRefineCoverage(input: RefineCoverageInput): CoverageItem[] {
  const { currentCoverage, sectionIndex } = input;
  const removed = new Set(Array.from(input.removedCodes || []).map(String));
  const evidenceMap = new Map<string, string>();
  for (const [code, evi] of Array.from(input.evidenceUpdates || [])) {
    evidenceMap.set(String(code), String(evi));
  }
  return (currentCoverage || [])
    .filter((c) => {
      const belongsHere = Array.isArray(c?.section_indexes) && c.section_indexes.includes(sectionIndex);
      if (!belongsHere) return true;
      const code = String(c?.requirement_codigo || '');
      return !removed.has(code);
    })
    .map((c) => {
      const code = String(c?.requirement_codigo || '');
      if (evidenceMap.has(code)) {
        return { ...c, evidencia: evidenceMap.get(code) };
      }
      return c;
    });
}

export function complianceImpactFrom(removedCount: number): ComplianceImpact {
  return removedCount > 0 ? 'reduced' : 'preserved';
}

/**
 * Expande a lista `nao_cobertos` incluindo TODOS os códigos do catálogo do
 * framework que não aparecem no coverage_map nem já estavam em nao_cobertos.
 * Isso garante que o denominador do score reflita o universo REAL do framework
 * (não apenas os requisitos que a IA "lembrou" de declarar).
 */
export function expandNaoCobertosFromCatalog(
  catalogCodes: Iterable<string>,
  coverageMap: CoverageItem[] | null | undefined,
  naoCobertos: NaoCobertoJustificativa[] | null | undefined,
  defaultMotivo = 'não coberto pela versão atual do documento (silêncio da IA)',
): NaoCobertoJustificativa[] {
  const covered = new Set(
    (coverageMap || [])
      .map((c) => String(c?.requirement_codigo || '').trim())
      .filter(Boolean),
  );
  const known = new Map<string, NaoCobertoJustificativa>();
  for (const n of naoCobertos || []) {
    const code = String(n?.codigo || '').trim();
    if (code) known.set(code, n);
  }
  const codes = Array.from(catalogCodes).map((c) => String(c || '').trim()).filter(Boolean);
  for (const code of codes) {
    if (covered.has(code)) continue;
    if (known.has(code)) continue;
    known.set(code, { codigo: code, motivo: defaultMotivo });
  }
  return Array.from(known.values());
}

/**
 * Gaps residuais para alimentar o refino gap-driven: retorna os códigos do
 * catálogo que estão dentro do escopo e ainda não têm cobertura, ordenados
 * para priorizar códigos mais curtos (geralmente requisitos-pai).
 */
export function computeResidualGaps(
  catalogCodes: Iterable<string>,
  coverageMap: CoverageItem[] | null | undefined,
  naoCobertos: NaoCobertoJustificativa[] | null | undefined,
  limit = 15,
): string[] {
  const covered = new Set(
    (coverageMap || []).map((c) => String(c?.requirement_codigo || '').trim()).filter(Boolean),
  );
  const outOfScope = new Set(
    (naoCobertos || [])
      .filter((n) => !isInScope(n))
      .map((n) => String(n?.codigo || '').trim())
      .filter(Boolean),
  );
  const gaps: string[] = [];
  for (const raw of catalogCodes) {
    const code = String(raw || '').trim();
    if (!code) continue;
    if (covered.has(code)) continue;
    if (outOfScope.has(code)) continue;
    gaps.push(code);
  }
  gaps.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return gaps.slice(0, Math.max(1, limit));
}

/* =========================================================================
 * Âmbito do documento (scope) — evita comparar UM documento com o catálogo
 * INTEIRO do framework.
 *
 * Um documento único (ex.: "Política de Controlo de Acesso") nunca cobre os
 * 184 requisitos de um framework; usar o catálogo completo como denominador
 * produzia sempre scores de ~8% e bloqueava a publicação. O denominador passa
 * a ser o subconjunto TEMATICAMENTE relacionado com o documento; a cobertura
 * do framework inteiro continua a ser reportada, mas apenas como informação.
 * ========================================================================= */

export interface CatalogRequirement {
  codigo?: string | null;
  titulo?: string | null;
  descricao?: string | null;
}

/** Remove acentos, pontuação e minúsculas — base para comparação de termos. */
export function normalizeTerm(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'para', 'com', 'em',
  'no', 'na', 'nos', 'nas', 'ao', 'aos', 'por', 'um', 'uma', 'the', 'of', 'and',
  'to', 'for', 'politica', 'procedimento', 'norma', 'manual', 'plano', 'documento',
  'policy', 'procedure', 'standard', 'plan', 'document', 'seguranca', 'informacao',
  'objetivo', 'escopo', 'glossario', 'referencias', 'aprovacao', 'historico',
  'versoes', 'papeis', 'responsabilidades', 'geral', 'gerais',
]);

/** Extrai termos significativos (>=4 letras, sem stopwords) de um texto. */
export function extractTerms(...parts: Array<string | null | undefined>): Set<string> {
  const terms = new Set<string>();
  for (const part of parts) {
    for (const raw of normalizeTerm(part).split(/[^a-z0-9]+/)) {
      if (raw.length < 4) continue;
      if (STOPWORDS.has(raw)) continue;
      terms.add(raw);
    }
  }
  return terms;
}

export interface DocumentScope {
  /** Códigos que formam o denominador do score deste documento. */
  scopeCodes: string[];
  /** Todos os códigos do catálogo (métrica informativa de cobertura). */
  catalogCodes: string[];
}

/**
 * Determina o âmbito de um documento dentro do catálogo do framework.
 *
 * Entra no âmbito qualquer requisito que:
 *  - já esteja declarado no coverage_map do documento, OU
 *  - partilhe pelo menos um termo significativo com o título do documento ou
 *    com os nomes das suas secções.
 *
 * Se a heurística não encontrar nada (documento genérico, catálogo sem texto),
 * cai para o catálogo completo — o comportamento antigo, conservador.
 */
export function resolveDocumentScope(
  catalog: CatalogRequirement[] | null | undefined,
  documentTitle: string | null | undefined,
  sectionNames: Array<string | null | undefined> = [],
  coverageMap: CoverageItem[] | null | undefined = [],
): DocumentScope {
  const rows = (catalog || []).filter((r) => String(r?.codigo || '').trim());
  const catalogCodes = rows.map((r) => String(r.codigo).trim());

  const declared = new Set(
    (coverageMap || [])
      .map((c) => String(c?.requirement_codigo || '').trim())
      .filter(Boolean),
  );
  const docTerms = extractTerms(documentTitle, ...sectionNames);

  const scope: string[] = [];
  for (const row of rows) {
    const code = String(row.codigo).trim();
    if (declared.has(code)) {
      scope.push(code);
      continue;
    }
    if (docTerms.size === 0) continue;
    const reqTerms = extractTerms(row.titulo, row.descricao);
    let hit = false;
    for (const term of reqTerms) {
      if (docTerms.has(term)) { hit = true; break; }
    }
    if (hit) scope.push(code);
  }

  // Sem sinal suficiente: mantém o catálogo completo para não mascarar lacunas.
  if (scope.length === 0) return { scopeCodes: catalogCodes, catalogCodes };
  return { scopeCodes: scope, catalogCodes };
}
