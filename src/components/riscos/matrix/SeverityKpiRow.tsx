/**
 * SeverityKpiRow — faixa única (cartão) com Críticos/Altos/Médios/Baixos.
 * Envio 14 · ponto 5: deixa de haver dois vocabulários visuais — usa o mesmo
 * StatStrip dos restantes módulos. A tendência vs 30d permanece visível para
 * não esconder uma informação de decisão atrás de hover.
 */
import { StatStrip, type StatStripItem, type StatStripTone } from '@/components/ui/stat-strip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEffect, useRef, useState } from 'react';

type SevKey = 'critico' | 'alto' | 'medio' | 'baixo';

/** Cor só onde exige ação; médios e baixos ficam neutros. */
const SEV_TONE: Record<SevKey, StatStripTone> = {
  critico: 'destructive',
  alto: 'orange',
  medio: 'neutral',
  baixo: 'neutral',
};

interface ItemTrend {
  delta: number | null; // riscos a mais/menos vs 30d (null = sem dado)
}

interface Props {
  counts: Record<SevKey, number>;
  trends?: Partial<Record<SevKey, ItemTrend>>;
  onSelect?: (sev: SevKey) => void;
}

export function SeverityKpiRow({ counts, trends, onSelect }: Props) {
  const { t } = useLanguage();
  const sevs: SevKey[] = ['critico', 'alto', 'medio', 'baixo'];
  const previousCritical = useRef(counts.critico ?? 0);
  const [criticalArrival, setCriticalArrival] = useState(false);

  useEffect(() => {
    const next = counts.critico ?? 0;
    if (next > previousCritical.current) {
      setCriticalArrival(false);
      const start = requestAnimationFrame(() => setCriticalArrival(true));
      const stop = window.setTimeout(() => setCriticalArrival(false), 620);
      previousCritical.current = next;
      return () => {
        cancelAnimationFrame(start);
        window.clearTimeout(stop);
      };
    }
    previousCritical.current = next;
  }, [counts.critico]);

  const trendLabel = (delta: number | null | undefined): string => {
    if (delta === null || delta === undefined) return t('riscosVisoes.matrix.severityKpiRow.semDados');
    if (delta === 0) return t('riscosVisoes.matrix.severityKpiRow.igualMes');
    const mes = t('riscosVisoes.matrix.severityKpiRow.trendMes');
    return delta > 0 ? `+${delta} ${mes}` : `${delta} ${mes}`;
  };

  const items: StatStripItem[] = sevs.map((sev) => {
    const label = t(`riscosVisoes.matrix.severityKpiRow.labels.${sev}`);
    const delta = trends?.[sev]?.delta;
    return {
      key: sev,
      label,
      value: counts[sev] ?? 0,
      tone: SEV_TONE[sev],
      attentionPulse: sev === 'critico' && criticalArrival,
      context: delta == null ? t('experience.noHistory') : t('riscosVisoes.matrix.severityKpiRow.vsMesAnterior'),
      hint: `${label} — ${t('riscosVisoes.matrix.severityKpiRow.vsMesAnterior')}: ${trendLabel(delta)}`,
      trend: delta === null || delta === undefined
        ? undefined
        : {
            label: trendLabel(delta),
            direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
            favorable: delta === 0 ? undefined : delta < 0,
          },
      onClick: onSelect ? () => onSelect(sev) : undefined,
    };
  });

  return <StatStrip items={items} />;
}
