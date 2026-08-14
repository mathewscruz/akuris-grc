/**
 * Akuris Design Tokens — Gap Analysis
 * --------------------------------------------------------------------------
 * Fonte única de verdade para cores, classes e variantes do módulo.
 * Sempre usar tokens semânticos (success/warning/destructive/info/muted/primary).
 * Nunca usar cores cruas Tailwind (bg-emerald-500, text-blue-600, etc).
 */

import type { BadgeProps } from '@/components/ui/badge';
import { tGlobal } from '@/lib/i18n-global';
import { CHART_SEVERITY, chartSeries } from '@/lib/chart-tokens';

export type ConformityStatus = 'conforme' | 'parcial' | 'nao_conforme' | 'nao_aplicavel' | 'nao_avaliado';

type Variant = NonNullable<BadgeProps['variant']>;

/** Variant semântica do Badge para cada status de conformidade */
export const STATUS_BADGE_VARIANT: Record<ConformityStatus, Variant> = {
  conforme: 'success',
  parcial: 'warning',
  nao_conforme: 'destructive',
  nao_aplicavel: 'secondary',
  nao_avaliado: 'outline',
};

/** Label traduzida para cada status de conformidade */
export function getStatusLabel(status: ConformityStatus): string {
  const map: Record<ConformityStatus, string> = {
    conforme: tGlobal('sweepRiscos.gap.statusLabels.conforme'),
    parcial: tGlobal('sweepRiscos.gap.statusLabels.parcial'),
    nao_conforme: tGlobal('sweepRiscos.gap.statusLabels.naoConforme'),
    nao_aplicavel: tGlobal('sweepRiscos.gap.statusLabels.na'),
    nao_avaliado: tGlobal('sweepRiscos.gap.statusLabels.naoAvaliado'),
  };
  return map[status];
}

/** Classe Tailwind de fundo sólido (para blocos/heatmaps) — usa tokens HSL */
export const STATUS_BG_CLASS: Record<ConformityStatus, string> = {
  conforme: 'bg-success',
  parcial: 'bg-warning',
  nao_conforme: 'bg-destructive',
  nao_aplicavel: 'bg-info',
  nao_avaliado: 'bg-muted-foreground/30',
};

/** Classe Tailwind de texto colorido para o status */
export const STATUS_TEXT_CLASS: Record<ConformityStatus, string> = {
  conforme: 'text-success',
  parcial: 'text-warning',
  nao_conforme: 'text-destructive',
  nao_aplicavel: 'text-info',
  nao_avaliado: 'text-muted-foreground',
};

/** Cor HSL crua do token (para uso em SVG/recharts/inline style) */
export const STATUS_HSL: Record<ConformityStatus, string> = {
  conforme: 'hsl(var(--success))',
  parcial: 'hsl(var(--warning))',
  nao_conforme: 'hsl(var(--destructive))',
  nao_aplicavel: 'hsl(var(--info))',
  nao_avaliado: 'hsl(var(--muted-foreground))',
};

// ---------------------------------------------------------------------------
// Score-based helpers (escala normalizada 0-100)
// ---------------------------------------------------------------------------

export type ScoreVariant = 'success' | 'primary' | 'warning' | 'destructive';

/** Retorna variant para score normalizado 0-100. Limites: 80/60/40. */
export function getScoreVariant(score: number): ScoreVariant {
  if (score >= 80) return 'success';
  if (score >= 60) return 'primary';
  if (score >= 40) return 'warning';
  return 'destructive';
}

/** Retorna variant aceito pelo Badge (mapeia primary → default) */
export function getScoreBadgeVariant(score: number): Variant {
  const v = getScoreVariant(score);
  return v === 'primary' ? 'default' : v;
}

/** Retorna cor HSL crua via token CSS — para SVG/recharts/inline */
export function getScoreHsl(score: number): string {
  switch (getScoreVariant(score)) {
    // Envio 9: o roxo não é cor de dados. A faixa intermédia usa o neutro
    // da paleta de gráficos; as restantes usam a escala de severidade.
    case 'success': return CHART_SEVERITY.low;
    case 'primary': return chartSeries(0);
    case 'warning': return CHART_SEVERITY.medium;
    case 'destructive': return CHART_SEVERITY.critical;
  }
}

/** Retorna classes Tailwind de texto via token semântico */
export function getScoreTextClass(score: number): string {
  switch (getScoreVariant(score)) {
    case 'success': return 'text-success';
    case 'primary': return 'text-primary';
    case 'warning': return 'text-warning';
    case 'destructive': return 'text-destructive';
  }
}

/** Retorna classes Tailwind de fundo via token semântico */
export function getScoreBgClass(score: number): string {
  switch (getScoreVariant(score)) {
    case 'success': return 'bg-success';
    case 'primary': return 'bg-primary';
    case 'warning': return 'bg-warning';
    case 'destructive': return 'bg-destructive';
  }
}

/** Normaliza um score arbitrário (0-5 ou 0-100) para escala 0-100 */
export function normalizeScore(score: number, scoreType: 'percentage' | 'decimal' | 'scale_0_5'): number {
  if (scoreType === 'percentage') return score;
  return (score / 5) * 100;
}

// ---------------------------------------------------------------------------
// Categorias de framework — tokens neutros + ícone diferenciador
// ---------------------------------------------------------------------------

export type FrameworkCategory = 'seguranca' | 'privacidade' | 'governanca' | 'qualidade';

/** Classes para badge de categoria — tons neutros sobre superfície, sem cores cruas */
export const CATEGORY_BADGE_CLASS: Record<FrameworkCategory, string> = {
  seguranca: 'bg-primary/10 text-primary border-primary/20',
  privacidade: 'bg-info/10 text-info border-info/20',
  governanca: 'bg-accent/30 text-accent-foreground border-accent/40',
  qualidade: 'bg-success/10 text-success border-success/20',
};

export function getCategoryLabel(category: FrameworkCategory): string {
  const map: Record<FrameworkCategory, string> = {
    seguranca: tGlobal('sweepRiscos.gap.fwCategoryLong.seguranca'),
    privacidade: tGlobal('sweepRiscos.gap.fwCategoryLong.privacidade'),
    governanca: tGlobal('sweepRiscos.gap.fwCategoryLong.governanca'),
    qualidade: tGlobal('sweepRiscos.gap.fwCategoryLong.qualidade'),
  };
  return map[category];
}

/** Esforço estimado a partir do nº de requisitos */
export type EffortLevel = 'baixo' | 'medio' | 'alto';

export function getEffortLevel(count: number): { level: EffortLevel; label: string; variant: Variant } {
  if (count <= 30) return { level: 'baixo', label: tGlobal('sweepRiscos.gap.effortLevel.baixo'), variant: 'success' };
  if (count <= 100) return { level: 'medio', label: tGlobal('sweepRiscos.gap.effortLevel.medio'), variant: 'warning' };
  return { level: 'alto', label: tGlobal('sweepRiscos.gap.effortLevel.alto'), variant: 'destructive' };
}
