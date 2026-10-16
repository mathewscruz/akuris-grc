/**
 * Higher is better. One fixed semantic colour per band (no blending), matching
 * the maturity labels: Excelente >=80, Bom >=60, Atenção >=40, Crítico <40.
 */
export function operationalScoreColor(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'hsl(var(--muted-foreground))';
  const score = Math.max(0, Math.min(100, value));
  if (score >= 80) return 'hsl(var(--success))';
  if (score >= 60) return 'hsl(var(--good))';
  if (score >= 40) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}
