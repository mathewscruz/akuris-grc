/**
 * SlaCell — pílula compacta de SLA para a tabela: no prazo / atenção / vencido.
 */
import { StatusBadge } from '@/components/ui/status-badge';
import { slaFromRevisao, type SlaStatus } from '@/components/riscos/risk-utils';

const TONE: Record<SlaStatus, { tone: any; label: string }> = {
  no_prazo: { tone: 'success', label: 'No prazo' },
  atencao: { tone: 'warning', label: 'Atenção' },
  vencido: { tone: 'destructive', label: 'Vencido' },
  sem_revisao: { tone: 'neutral', label: '—' },
};

export function SlaCell({ dataProximaRevisao }: { dataProximaRevisao?: string | null }) {
  const sla = slaFromRevisao(dataProximaRevisao);
  const cfg = TONE[sla];
  if (sla === 'sem_revisao') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <StatusBadge size="sm" tone={cfg.tone}>
      {cfg.label}
    </StatusBadge>
  );
}
