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

/** Score derivado de prob × imp (strings "1"-"5"). */
export function scoreFromPI(prob?: string | number | null, imp?: string | number | null): number {
  const p = Number(prob) || 0;
  const i = Number(imp) || 0;
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

/** Risco "acima do apetite" = score (residual ou inicial) ≥ 10 (alto/crítico). */
export function isAcimaApetite(r: { nivel_risco_residual?: string | null; nivel_risco_inicial?: string | null }): boolean {
  const sev = severityFromNivel(r.nivel_risco_residual || r.nivel_risco_inicial);
  return sev === 'critico' || sev === 'alto';
}
