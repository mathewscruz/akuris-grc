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
