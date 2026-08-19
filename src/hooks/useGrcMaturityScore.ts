import { useMemo } from 'react';
import { useRadarChartData } from './useRadarChartData';
import { useLanguage } from '@/contexts/LanguageContext';

export type MaturityStatus = 'excellent' | 'good' | 'warning' | 'critical' | 'no_data';

export interface GrcMaturity {
  /** 0-100, average of modules that have data. 0 when nothing has data yet. */
  score: number;
  status: MaturityStatus;
  /** PT label aligned with status (e.g. "Bom"). */
  label: string;
  /** Tailwind text color class for the status. */
  colorClass: string;
  modulesWithData: number;
  totalModules: number;
  isLoading: boolean;
}

const STATUS_COLOR: Record<MaturityStatus, string> = {
  excellent: 'text-success',
  good: 'text-primary',
  warning: 'text-warning',
  critical: 'text-destructive',
  no_data: 'text-muted-foreground',
};

function classify(score: number): Exclude<MaturityStatus, 'no_data'> {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
}

/**
 * Single source of truth for the GRC Maturity score shown across the dashboard
 * (Hero Banner and Maturity card). Averages only modules with data so empty
 * modules don't artificially drag the score down — aligned with the project's
 * zero-base scoring rule.
 */
export function useGrcMaturityScore(): GrcMaturity {
  const { data, isLoading } = useRadarChartData();
  const { t } = useLanguage();

  return useMemo<GrcMaturity>(() => {
    const totalModules = data?.length ?? 0;
    const withData = (data ?? []).filter((d) => d.hasData);
    const modulesWithData = withData.length;

    if (modulesWithData === 0) {
      return {
        score: 0,
        status: 'no_data',
        label: t('sweepCore.maturity.noData'),
        colorClass: STATUS_COLOR.no_data,
        modulesWithData: 0,
        totalModules,
        isLoading,
      };
    }

    const score = Math.round(
      withData.reduce((sum, d) => sum + d.score, 0) / withData.length
    );
    const status = classify(score);

    return {
      score,
      status,
      label: t(`sweepCore.maturity.${status}`),
      colorClass: STATUS_COLOR[status],
      modulesWithData,
      totalModules,
      isLoading,
    };
  }, [data, isLoading, t]);
}
