/**
 * SeverityKpiRow — 4 cards Críticos/Altos/Médios/Baixos com tendência vs mês anterior.
 */
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

type SevKey = 'critico' | 'alto' | 'medio' | 'baixo';

const SEV_BORDER: Record<SevKey, string> = {
  critico: 'border-l-destructive',
  alto: 'border-l-warning',
  medio: 'border-l-warning/60',
  baixo: 'border-l-success',
};

interface ItemTrend {
  delta: number | null; // riscos a mais/menos vs 30d (null = sem dado)
}

interface Props {
  counts: Record<SevKey, number>;
  trends?: Partial<Record<SevKey, ItemTrend>>;
}

export function SeverityKpiRow({ counts, trends }: Props) {
  const { t } = useLanguage();
  const items: SevKey[] = ['critico', 'alto', 'medio', 'baixo'];

  const trendLabel = (delta: number | null | undefined): string => {
    if (delta === null || delta === undefined) return t('riscosVisoes.matrix.severityKpiRow.semDados');
    if (delta === 0) return t('riscosVisoes.matrix.severityKpiRow.igualMes');
    const mes = t('riscosVisoes.matrix.severityKpiRow.trendMes');
    return delta > 0 ? `+${delta} ${mes}` : `${delta} ${mes}`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {items.map((sev) => (
        <div
          key={sev}
          className={cn(
            'flex items-center justify-between bg-card border border-border border-l-[3px] rounded-lg px-[18px] py-[14px]',
            SEV_BORDER[sev],
          )}
        >
          <div>
            <div className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
              {t(`riscosVisoes.matrix.severityKpiRow.labels.${sev}`)}
            </div>
            <div className="text-[28px] font-semibold tabular-nums leading-none mt-1.5">
              {counts[sev] ?? 0}
            </div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div>{t('riscosVisoes.matrix.severityKpiRow.vsMesAnterior')}</div>
            <div className="text-foreground/80 font-medium mt-0.5">{trendLabel(trends?.[sev]?.delta)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
