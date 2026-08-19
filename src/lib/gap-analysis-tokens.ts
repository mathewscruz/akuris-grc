/**
 * Akuris Design Tokens — Gap Analysis
 * --------------------------------------------------------------------------
 * Fonte única de verdade para cores, classes e variantes do módulo.
 * Sempre usar tokens semânticos (success/warning/destructive/info/muted/primary).
 * Nunca usar cores cruas Tailwind (bg-success, text-info, etc).
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

// ---------------------------------------------------------------------------
// Categorias de framework — tokens neutros + ícone diferenciador
// ---------------------------------------------------------------------------

export type FrameworkCategory =
  | 'seguranca'
  | 'privacidade'
  | 'risco'
  | 'governanca'
  | 'compliance'
  | 'qualidade'
  | 'ambiente';

export const CATEGORIAS_DE_FRAMEWORK: FrameworkCategory[] = [
  'seguranca',
  'privacidade',
  'risco',
  'governanca',
  'compliance',
  'qualidade',
  'ambiente',
];

/**
 * `tipo_framework` → grupo do catálogo. Fonte única.
 *
 * Havia TRÊS cópias desta função — em `FrameworkCatalog`, em
 * `GapAnalysisFrameworks` e implícita nos tokens — e todas conheciam quatro
 * grupos para um catálogo de sete tipos. Sete frameworks apareciam sob
 * "Segurança da Informação": a ISO 14001 (ambiente), a ISO 31000 e o COSO ERM
 * (risco), o DORA, a ISO 37301, a NIS2 e a SOX (compliance). Quem filtrava por
 * risco não encontrava um único framework de risco.
 */
const GRUPO_POR_TIPO: Record<string, FrameworkCategory> = {
  seguranca_informacao: 'seguranca',
  privacidade: 'privacidade',
  gestao_riscos: 'risco',
  governanca_ti: 'governanca',
  compliance: 'compliance',
  qualidade: 'qualidade',
  meio_ambiente: 'ambiente',
};

export function getCategory(tipo?: string | null): FrameworkCategory {
  const t = (tipo || '').toLowerCase().trim();
  if (GRUPO_POR_TIPO[t]) return GRUPO_POR_TIPO[t];
  // Um tipo novo, cadastrado por um cliente, cai na heurística de texto.
  if (t.includes('privacidade') || t.includes('privacy')) return 'privacidade';
  if (t.includes('risco') || t.includes('risk')) return 'risco';
  if (t.includes('ambiente') || t.includes('environment')) return 'ambiente';
  if (t.includes('qualidade') || t.includes('quality')) return 'qualidade';
  if (t.includes('compliance') || t.includes('conformidade')) return 'compliance';
  if (t.includes('governanca') || t.includes('governance')) return 'governanca';
  return 'seguranca';
}

/** Classes para badge de categoria — tons neutros sobre superfície, sem cores cruas */
export const CATEGORY_BADGE_CLASS: Record<FrameworkCategory, string> = {
  seguranca: 'bg-primary/10 text-primary border-primary/20',
  privacidade: 'bg-info/10 text-info border-info/20',
  risco: 'bg-warning/10 text-warning border-warning/20',
  governanca: 'bg-accent/30 text-accent-foreground border-accent/40',
  compliance: 'bg-info/10 text-info border-info/20',
  qualidade: 'bg-success/10 text-success border-success/20',
  ambiente: 'bg-success/10 text-success border-success/20',
};

export function getCategoryLabel(category: FrameworkCategory): string {
  return tGlobal(`gapAnalysis.catalog.category.${category}`);
}

/** Esforço estimado a partir do nº de requisitos */
export type EffortLevel = 'baixo' | 'medio' | 'alto';

export function getEffortLevel(count: number): { level: EffortLevel; label: string; variant: Variant } {
  if (count <= 30) return { level: 'baixo', label: tGlobal('sweepRiscos.gap.effortLevel.baixo'), variant: 'success' };
  if (count <= 100) return { level: 'medio', label: tGlobal('sweepRiscos.gap.effortLevel.medio'), variant: 'warning' };
  return { level: 'alto', label: tGlobal('sweepRiscos.gap.effortLevel.alto'), variant: 'destructive' };
}
