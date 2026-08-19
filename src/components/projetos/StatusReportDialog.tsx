import React, { useState } from 'react';
import { IconFile } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
;
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { StatStrip } from '@/components/ui/stat-strip';
import { useLanguage } from '@/contexts/LanguageContext';

interface StatusReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  projetoNome: string;
}

interface Report {
  saude?: 'verde' | 'amarelo' | 'vermelho';
  headline?: string;
  resumo_executivo?: string;
  riscos?: string[];
  proximas_acoes?: string[];
  recomendacao_gestor?: string;
}

interface Metrics {
  total: number; concluidas: number; atrasadas: number; bloqueadas: number; slaViolado: number; progressoMedio: number;
}

const saudeTone: Record<string, 'success' | 'warning' | 'destructive'> = {
  verde: 'success', amarelo: 'warning', vermelho: 'destructive',
};

export const StatusReportDialog: React.FC<StatusReportDialogProps> = ({ open, onOpenChange, projetoId, projetoNome }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const handleGerar = async () => {
    setLoading(true);
    setReport(null);
    setMetrics(null);
    const { data, error } = await invokeEdgeFunction<{ report: Report; metrics: Metrics }>('projeto-status-report', {
      body: { projetoId },
      isAiCall: true,
    });
    setLoading(false);
    if (error || !data) return;
    setReport(data.report ?? null);
    setMetrics(data.metrics ?? null);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconFile}
      title={t('projetos.statusReport.title', { nome: projetoNome })}
      description={t('projetos.statusReport.description')}
      size="lg"
      hideFooter
    >
        {!report && !loading && (
          <Button onClick={handleGerar} className="w-full">
            {t('projetos.statusReport.generate')}
          </Button>
        )}

        {loading && <div className="flex justify-center py-12"><AkurisPulse size={56} /></div>}

        {report && metrics && (
          <div className="space-y-5">
            <StatStrip
              items={[
                { key: 'total', label: t('projetos.statusReport.statTasks'), value: metrics.total },
                { key: 'concluidas', label: t('projetos.statusReport.statDone'), value: metrics.concluidas },
                { key: 'atrasadas', label: t('projetos.statusReport.statOverdue'), value: metrics.atrasadas, tone: 'destructive' },
                { key: 'progresso', label: t('projetos.statusReport.statProgress'), value: `${metrics.progressoMedio}%` },
              ]}
            />

            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                {report.saude && <StatusBadge tone={saudeTone[report.saude] ?? 'info'}>{t('projetos.statusReport.health', { value: report.saude })}</StatusBadge>}
                {report.headline && <span className="font-semibold text-lg">{report.headline}</span>}
              </div>
              {report.resumo_executivo && <p className="text-sm leading-relaxed">{report.resumo_executivo}</p>}
            </div>

            {report.riscos && report.riscos.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">{t('projetos.statusReport.risks')}</h3>
                <ul className="space-y-1 text-sm list-disc pl-5">
                  {report.riscos.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {report.proximas_acoes && report.proximas_acoes.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">{t('projetos.statusReport.nextActions')}</h3>
                <ul className="space-y-1 text-sm list-disc pl-5">
                  {report.proximas_acoes.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}

            {report.recomendacao_gestor && (
              <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
                <p className="text-xs text-primary font-semibold mb-1">{t('projetos.statusReport.managerRecommendation')}</p>
                <p className="text-sm">{report.recomendacao_gestor}</p>
              </div>
            )}

            <Button variant="outline" onClick={handleGerar} className="w-full">
              {t('projetos.statusReport.regenerate')}
            </Button>
          </div>
        )}
    </DialogShell>
  );
};
