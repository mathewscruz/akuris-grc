import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AkurisPulse } from "@/components/ui/AkurisPulse";
import { RiscosStats } from "@/hooks/useRiscosStats";
import { TrendingUp, TrendingDown, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from '@/contexts/LanguageContext';

interface RiskScoreCardProps {
  stats: RiscosStats | undefined;
  loading?: boolean;
}

const getColor = (score: number): string => {
  if (score >= 80) return "hsl(var(--success))";
  if (score >= 60) return "hsl(var(--primary))";
  if (score >= 40) return "hsl(var(--warning))";
  return "hsl(var(--destructive))";
};

const getLabel = (score: number, t: (k: string) => string): string => {
  if (score === 0) return t('riscosDetalhe.scoreCard.noData');
  if (score >= 80) return t('riscosDetalhe.scoreCard.excellent');
  if (score >= 60) return t('riscosDetalhe.scoreCard.good');
  if (score >= 40) return t('riscosDetalhe.scoreCard.attention');
  return t('riscosDetalhe.scoreCard.critical');
};

function useLegendItems(t: (k: string) => string) {
  return [
    { label: t('riscosDetalhe.scoreCard.critical'), color: "bg-destructive" },
    { label: t('riscosDetalhe.scoreCard.attention'), color: "bg-warning" },
    { label: t('riscosDetalhe.scoreCard.good'), color: "bg-primary" },
    { label: t('riscosDetalhe.scoreCard.excellent'), color: "bg-success" },
  ];
}

const calcDisplayScore = (stats: RiscosStats): number => {
  if (stats.total === 0) return 0;
  const positivos = stats.baixos + stats.aceitos + stats.tratamentos_concluidos;
  return Math.min(100, Math.round((positivos / stats.total) * 100));
};

/**
 * RiskScoreCard alinhado à anatomia oficial do StatCard (Onda 5).
 * Mesma altura mínima (148px), mesmo padding (p-5 pl-6), mesma linha de título.
 * O gauge SVG ocupa o slot do "valor herói + segments".
 */
export function RiskScoreCard({ stats, loading }: RiskScoreCardProps) {
  const { t } = useLanguage();
  if (loading || !stats) {
    return (
      <Card variant="elevated" className="h-full min-h-[148px] flex items-center justify-center">
        <AkurisPulse size={36} />
      </Card>
    );
  }

  const displayScore = calcDisplayScore(stats);
  const scoreColor = getColor(displayScore);
  const label = getLabel(displayScore, t);
  const legendItems = useLegendItems(t);

  const hasVariation = stats.variacao7dias !== null && stats.variacao7dias !== 0;
  const isPositiveTrend = stats.variacao7dias && stats.variacao7dias < 0;

  // SVG gauge arc (semicircle)
  const radius = 60;
  const circumference = Math.PI * radius;
  const progress = (displayScore / 100) * circumference;
  const strokeWidth = 10;

  return (
    <Card
      variant="elevated"
      className="group relative overflow-hidden transition-all duration-300 h-full min-h-[148px]"
    >
      <CardContent className="p-5 pl-6 flex flex-col gap-3 h-full">
        {/* Linha 1: ícone + título | delta — mesma estrutura do StatCard */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground flex-shrink-0 [&_svg]:h-4 [&_svg]:w-4">
              <ShieldCheck strokeWidth={1.5} />
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {t('riscosDetalhe.scoreCard.title')}
            </span>
          </div>

          {hasVariation && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
                isPositiveTrend ? "text-success" : "text-destructive"
              )}
            >
              {isPositiveTrend ? (
                <TrendingUp className="h-3 w-3" strokeWidth={1.5} />
              ) : (
                <TrendingDown className="h-3 w-3" strokeWidth={1.5} />
              )}
              {Math.abs(stats.variacao7dias!)}%
            </span>
          )}
        </div>

        {/* Linha 2: gauge + valor herói lado a lado */}
        <div className="flex items-center gap-3">
          <svg width="96" height="56" viewBox="0 0 160 100" className="flex-shrink-0">
            <path
              d="M 20 90 A 60 60 0 0 1 140 90"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <path
              d="M 20 90 A 60 60 0 0 1 140 90"
              fill="none"
              stroke={scoreColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${progress} ${circumference}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="flex flex-col">
            <span
              className={cn(
                "text-4xl font-semibold tracking-tight tabular-nums leading-none",
                displayScore === 0 ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {displayScore}
            </span>
            <span className="text-[11px] text-muted-foreground mt-1">{label}</span>
          </div>
        </div>

        {/* Linha 3: legenda — ocupa o mesmo slot dos segments/description */}
        <div className="min-h-[44px] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          {legendItems.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1">
              <span className={cn("inline-block h-1.5 w-1.5 rounded-full", item.color)} />
              <span className="text-muted-foreground">{item.label}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
