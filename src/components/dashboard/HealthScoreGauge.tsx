import { useMemo } from 'react';

import type { GrcMaturity } from '@/hooks/useGrcMaturityScore';
import { useMaturityTrend } from '@/hooks/useMaturityTrend';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconTrendUp, IconTrendDown, IconMinus } from '@/components/icons';

interface HealthScoreGaugeProps {
  maturity: GrcMaturity;
}

/**
 * Semicircular ("meia-lua") gauge that visualizes the unified GRC Maturity score
 * coming from useGrcMaturityScore. Shows the same number as the Maturidade GRC
 * card so both views stay in sync.
 */
export function HealthScoreGauge({ maturity }: HealthScoreGaugeProps) {
  const { t } = useLanguage();
  const statusLabel = useMemo(() => {
    switch (maturity.status) {
      case 'excellent':
        return t('dashWidgets.radar.statusExcellent');
      case 'good':
        return t('dashWidgets.radar.statusGood');
      case 'warning':
        return t('dashWidgets.radar.statusWarning');
      case 'critical':
        return t('dashWidgets.radar.statusCritical');
      default:
        return t('dashWidgets.radar.statusNoData');
    }
  }, [maturity.status, t]);
  const { data: trend } = useMaturityTrend(maturity.score);

  // Map status -> stroke color (HSL via CSS variable, theme-safe)
  const strokeColor = useMemo(() => {
    switch (maturity.status) {
      case 'excellent':
        return 'hsl(142 71% 45%)'; // green-500
      case 'good':
        return 'hsl(var(--primary))';
      case 'warning':
        return 'hsl(45 93% 47%)'; // yellow-500
      case 'critical':
        return 'hsl(var(--destructive))';
      default:
        return 'hsl(var(--muted-foreground) / 0.4)';
    }
  }, [maturity.status]);

  // Geometry of the semicircle
  const size = 180;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = Math.PI * radius; // half circle
  const pct = maturity.status === 'no_data' ? 0 : Math.max(0, Math.min(100, maturity.score));
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="relative" style={{ width: size, height: size / 2 + 8 }}>
        <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
          {/* Track */}
          <path
            d={`M ${stroke / 2} ${size / 2}
                A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${size / 2}`}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Progress */}
          <path
            d={`M ${stroke / 2} ${size / 2}
                A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${size / 2}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
          />
        </svg>
        {/* Center number */}
        <div
          className="absolute inset-x-0 flex flex-col items-center"
          style={{ top: size / 2 - 44 }}
        >
          <span className={`text-4xl font-bold leading-none ${maturity.colorClass}`}>
            {maturity.status === 'no_data' ? '—' : maturity.score}
          </span>
          <span className="text-micro text-muted-foreground mt-1">{statusLabel}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-medium mt-1">
        {t('dashboard.maturity')}
      </p>

      {/* Tendência vs. 30 dias — centralizada */}
      <div className="mt-2 flex w-full items-center justify-center">
        {trend?.delta === null || trend?.delta === undefined ? (
          <span className="text-micro text-muted-foreground">
            {t('dashWidgets.radar.trendNoBaseline')}
          </span>
        ) : trend.delta === 0 ? (
          <span className="flex items-center gap-1 text-micro font-medium text-muted-foreground">
            <IconMinus className="h-3 w-3" strokeWidth={1.5} />
            {t('dashWidgets.radar.trendFlat')}
          </span>
        ) : (
          <span
            className={`flex items-center gap-1 text-micro font-medium ${
              trend.delta > 0 ? 'text-success' : 'text-destructive'
            }`}
          >
            {trend.delta > 0 ? (
              <IconTrendUp className="h-3 w-3" strokeWidth={1.5} />
            ) : (
              <IconTrendDown className="h-3 w-3" strokeWidth={1.5} />
            )}
            {trend.delta > 0
              ? t('dashWidgets.radar.trendUp', { delta: String(trend.delta) })
              : t('dashWidgets.radar.trendDown', { delta: String(trend.delta) })}
          </span>
        )}
      </div>

    </div>
  );
}
