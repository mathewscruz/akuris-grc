/**
 * Utilidades compartilhadas pelo módulo de Riscos (Visão geral, Matriz, Tabela, Drawer).
 * Mantém regras de score, derivações de SLA, ID curto e mapeamentos para tons semânticos.
 */
import { differenceInDays } from 'date-fns';

export type Severity = 'critico' | 'alto' | 'medio' | 'baixo';

export const NIVEL_LABELS: Record<Severity, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};

const norm = (s?: string | null) =>
  (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Converte qualquer label de nível (com acento, MAIÚSCULA, snake_case) para chave canônica. */
export function severityFromNivel(raw?: string | null): Severity {
  const v = norm(raw);
  if (v === 'critico' || v === 'muito alto') return 'critico';
  if (v === 'alto') return 'alto';
  if (v === 'medio') return 'medio';
  return 'baixo';
}

/**
 * Mapa de valores textuais legados de probabilidade/impacto → escala canônica 1–5.
 * Riscos antigos gravaram texto ("provavel", "catastrofico"); os novos gravam
 * número ("1".."5"). Este mapa permite normalizar ambos para a mesma escala.
 */
const SCALE_MAP: Record<string, number> = {
  // Probabilidade
  raro: 1,
  improvavel: 2,
  possivel: 3,
  provavel: 4,
  quase_certo: 5,
  muito_provavel: 5,
  // Impacto
  insignificante: 1,
  menor: 2,
  moderado: 3,
  maior: 4,
  catastrofico: 5,
};

/**
 * Normaliza um valor de probabilidade/impacto para a escala canônica 1–5.
 * Aceita número ("1".."5") ou texto legado ("provavel", "catastrofico").
 * Retorna null quando não há valor reconhecível. Fonte única de verdade para
 * toda conversão prob/impacto → número (matriz, sparkline, score, exibição).
 */
export function toScaleNumber(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isFinite(n) && n >= 1 && n <= 5) return Math.round(n);
  const key = norm(value as string).replace(/\s+/g, '_');
  return SCALE_MAP[key] ?? null;
}

/** Exibição "P × I" normalizada: sempre número (ou "—"), nunca texto legado. */
export function formatScaleValue(value?: string | number | null): string {
  const n = toScaleNumber(value);
  return n === null ? '—' : n.toString();
}

/** Score derivado de prob × imp. Aceita número ("1"-"5") ou texto legado. */
export function scoreFromPI(prob?: string | number | null, imp?: string | number | null): number {
  const p = toScaleNumber(prob) ?? 0;
  const i = toScaleNumber(imp) ?? 0;
  return p * i;
}

/** Mapeamento score → severidade (usado pelo heatmap se não houver matriz cadastrada). */
export function severityFromScore(score: number): Severity {
  if (score >= 16) return 'critico';
  if (score >= 10) return 'alto';
  if (score >= 5) return 'medio';
  return 'baixo';
}

/** ID curto display-only: "R-014" derivado dos últimos 3 chars do uuid. */
export function shortRiskId(uuid?: string | null, codigo?: string | null): string {
  if (codigo) return codigo;
  if (!uuid) return 'R-—';
  const tail = uuid.replace(/-/g, '').slice(-3).toUpperCase();
  return `R-${tail}`;
}

export type SlaStatus = 'no_prazo' | 'atencao' | 'vencido' | 'sem_revisao';

export function slaFromRevisao(dataProximaRevisao?: string | null): SlaStatus {
  if (!dataProximaRevisao) return 'sem_revisao';
  const dias = differenceInDays(new Date(dataProximaRevisao), new Date());
  if (dias < 0) return 'vencido';
  if (dias <= 7) return 'atencao';
  return 'no_prazo';
}

export const SLA_LABELS: Record<SlaStatus, string> = {
  no_prazo: 'No prazo',
  atencao: 'Atenção',
  vencido: 'Vencido',
  sem_revisao: '—',
};

/** Iniciais para avatar fallback. */
export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** "há Nd / Nm / Na". */
export function relativeShort(iso?: string | null): string {
  if (!iso) return '—';
  const days = differenceInDays(new Date(), new Date(iso));
  if (days < 1) return 'hoje';
  if (days < 30) return `há ${days}d`;
  if (days < 365) return `há ${Math.floor(days / 30)}m`;
  return `há ${Math.floor(days / 365)}a`;
}

/**
 * Risco "acima do apetite". Quando um limite de apetite (score máximo aceitável)
 * é informado, compara o score numérico do risco (residual||inicial) a ele.
 * Sem apetite configurado (ou risco sem P×I), cai no fallback por severidade
 * (alto/crítico), preservando o comportamento anterior.
 */
export function isAcimaApetite(
  r: {
    nivel_risco_residual?: string | null;
    nivel_risco_inicial?: string | null;
    probabilidade_residual?: string | number | null;
    impacto_residual?: string | number | null;
    probabilidade_inicial?: string | number | null;
    impacto_inicial?: string | number | null;
  },
  apetiteScore?: number | null,
): boolean {
  if (apetiteScore != null) {
    const score = scoreFromPI(
      r.probabilidade_residual ?? r.probabilidade_inicial,
      r.impacto_residual ?? r.impacto_inicial,
    );
    if (score > 0) return score > apetiteScore;
  }
  const sev = severityFromNivel(r.nivel_risco_residual || r.nivel_risco_inicial);
  return sev === 'critico' || sev === 'alto';
}
