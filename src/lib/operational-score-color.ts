/**
 * Higher is better. The three semantic tokens are interpolation anchors, not
 * score bands: every point has its own shade, including fractional scores.
 * OKLab keeps the blend smooth and the theme tokens support light/dark mode.
 */
export function operationalScoreColor(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'hsl(var(--muted-foreground))';
  const score = Math.max(0, Math.min(100, value));
  const [from, to, progress] = score <= 50
    ? ['destructive', 'warning', score / 50] as const
    : ['warning', 'success', (score - 50) / 50] as const;
  const weight = progress * 100;
  return `color-mix(in oklab, hsl(var(--${from})) ${100 - weight}%, hsl(var(--${to})) ${weight}%)`;
}
