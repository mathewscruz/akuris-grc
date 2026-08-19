/**
 * SlaCell — pílula compacta de SLA para a tabela: no prazo / atenção / vencido.
 */
import { StatusBadge } from '@/components/ui/status-badge';
import { slaFromRevisao, type SlaStatus } from '@/components/riscos/risk-utils';
import { useLanguage } from '@/contexts/LanguageContext';

const TONE: Record<SlaStatus, { tone: any; key: string }> = {
  no_prazo: { tone: 'success', key: 'riscosVisoes.table.slaCell.noPrazo' },
  atencao: { tone: 'warning', key: 'riscosVisoes.table.slaCell.atencao' },
  vencido: { tone: 'destructive', key: 'riscosVisoes.table.slaCell.vencido' },
  sem_revisao: { tone: 'neutral', key: 'riscosVisoes.table.slaCell.semRevisao' },
};

export function SlaCell({ dataProximaRevisao }: { dataProximaRevisao?: string | null }) {
  const { t } = useLanguage();
  const sla = slaFromRevisao(dataProximaRevisao);
  const cfg = TONE[sla];
  if (sla === 'sem_revisao') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <StatusBadge tone={cfg.tone}>
      {t(cfg.key)}
    </StatusBadge>
  );
}
