/**
 * SeverityKpiRow — faixa única (cartão) com Críticos/Altos/Médios/Baixos.
 * Envio 14 · ponto 5: deixa de haver dois vocabulários visuais — usa o mesmo
 * StatStrip dos restantes módulos. A tendência vs 30d fica no tooltip do item.
 */
import { StatStrip, type StatStripItem, type StatStripTone } from '@/components/ui/stat-strip';
import { SEVERITY_LETTER } from '@/components/riscos/risk-utils';
import { useLanguage } from '@/contexts/LanguageContext';

type SevKey = 'critico' | 'alto' | 'medio' | 'baixo';

/** Cor só onde exige ação; médios e baixos ficam neutros. */
const SEV_TONE: Record<SevKey, StatStripTone> = {
  critico: 'destructive',
  alto: 'warning',
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

  const trendLabel = (delta: number | null | undefined): string => {
    if (delta === null || delta === undefined) return t('riscosVisoes.matrix.severityKpiRow.semDados');
    if (delta === 0) return t('riscosVisoes.matrix.severityKpiRow.igualMes');
    const mes = t('riscosVisoes.matrix.severityKpiRow.trendMes');
    return delta > 0 ? `+${delta} ${mes}` : `${delta} ${mes}`;
  };

  const items: StatStripItem[] = sevs.map((sev) => {
    const label = t(`riscosVisoes.matrix.severityKpiRow.labels.${sev}`);
    return {
      key: sev,
      // A letra da faixa mantém a severidade legível sem depender da cor (WCAG 1.4.1).
      label: `${SEVERITY_LETTER[sev]} · ${label}`,
      value: counts[sev] ?? 0,
      tone: SEV_TONE[sev],
      hint: `${label} — ${t('riscosVisoes.matrix.severityKpiRow.vsMesAnterior')}: ${trendLabel(trends?.[sev]?.delta)}`,
      onClick: onSelect ? () => onSelect(sev) : undefined,
    };
  });

  return <StatStrip items={items} />;
}
