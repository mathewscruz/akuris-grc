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
