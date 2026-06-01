import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { FileText, Sparkles } from 'lucide-react';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { StatCard } from '@/components/ui/stat-card';

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Status Report — {projetoNome}</DialogTitle>
          <DialogDescription>Resumo executivo gerado por IA com base nas tarefas, prazos e SLAs. Consome 1 crédito.</DialogDescription>
        </DialogHeader>

        {!report && !loading && (
          <Button onClick={handleGerar} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />Gerar relatório
          </Button>
        )}

        {loading && <div className="flex justify-center py-12"><AkurisPulse size={56} /></div>}

        {report && metrics && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard title="Tarefas" value={metrics.total} />
              <StatCard title="Concluídas" value={metrics.concluidas} />
              <StatCard title="Atrasadas" value={metrics.atrasadas} />
              <StatCard title="Progresso" value={`${metrics.progressoMedio}%`} />
            </div>

            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                {report.saude && <StatusBadge tone={saudeTone[report.saude] ?? 'info'} size="md">Saúde: {report.saude}</StatusBadge>}
                {report.headline && <span className="font-semibold text-lg">{report.headline}</span>}
              </div>
              {report.resumo_executivo && <p className="text-sm leading-relaxed">{report.resumo_executivo}</p>}
            </div>

            {report.riscos && report.riscos.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Riscos</h3>
                <ul className="space-y-1 text-sm list-disc pl-5">
                  {report.riscos.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {report.proximas_acoes && report.proximas_acoes.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Próximas ações</h3>
                <ul className="space-y-1 text-sm list-disc pl-5">
                  {report.proximas_acoes.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}

            {report.recomendacao_gestor && (
              <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">Recomendação ao gestor</p>
                <p className="text-sm">{report.recomendacao_gestor}</p>
              </div>
            )}

            <Button variant="outline" onClick={handleGerar} className="w-full">
              <Sparkles className="h-4 w-4 mr-2" />Regenerar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
