/** Dias inteiros entre hoje (local) e a data ISO (yyyy-mm-dd). */
export function diasAte(dataIso: string, hoje: Date = new Date()): number {
  const [y, m, d] = dataIso.slice(0, 10).split('-').map(Number);
  const alvo = Date.UTC(y, m - 1, d);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86_400_000);
}

/** Contratos a 30 dias ou menos ficam destacados. */
export type UrgenciaContrato = 'urgente' | 'proximo' | 'normal';
export function urgenciaContrato(dias: number): UrgenciaContrato {
  if (dias <= 30) return 'urgente';
  if (dias <= 60) return 'proximo';
  return 'normal';
}

/** Severidade de uma célula do mapa 5x5 pelo produto P×I. */
export function severidadeCelula(p: number, i: number): 'critical' | 'high' | 'medium' | 'low' {
  const n = p * i;
  if (n >= 15) return 'critical';
  if (n >= 10) return 'high';
  if (n >= 5) return 'medium';
  return 'low';
}

/** Estados de contrato em vigor (entram em "a vencer"). */
export const CONTRATO_VIGENTE = ['ativo', 'vigente'] as const;

/**
 * Série semanal da conformidade média: por semana (segunda-feira), a última
 * nota de cada framework, mantendo a anterior quando não há medição nova;
 * depois a média entre frameworks.
 */
export function serieSemanalConformidade(
  rows: { framework_id: string | null; score: number | string; recorded_at: string }[],
  locale = 'pt-BR',
): { label: string; v: number }[] {
  const semanaDe = (iso: string) => {
    const d = new Date(iso); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  };
  const ordenadas = [...rows].filter((r) => r.framework_id).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  if (!ordenadas.length) return [];
  const semanas = [...new Set(ordenadas.map((r) => semanaDe(r.recorded_at)))].sort((a, b) => a - b);
  const atual = new Map<string, number>();
  let idx = 0;
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short' });
  let ultimoMes = -1;
  return semanas.map((w) => {
    while (idx < ordenadas.length && semanaDe(ordenadas[idx].recorded_at) <= w) {
      atual.set(ordenadas[idx].framework_id!, Number(ordenadas[idx].score)); idx++;
    }
    const vals = [...atual.values()];
    const d = new Date(w); const mes = d.getMonth();
    const raw = fmt.format(d).replace('.', '');
    const label = mes !== ultimoMes ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
    ultimoMes = mes;
    return { label, v: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) };
  });
}
