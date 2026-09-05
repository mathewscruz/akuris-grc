/**
 * AlertsDetailDialog — a explicação do número de alertas críticos.
 *
 * Era uma segunda lista de coisas interessantes, e não a explicação do número.
 * O banner somava riscos CRÍTICOS + não conformidades críticas + incidentes
 * críticos + prazos vencidos; o diálogo listava riscos ALTOS, denúncias e
 * controlos a vencer. Numa base com 35 no banner, o diálogo mostrava 10 itens
 * — e desses, um só estava contado. As não conformidades e os planos
 * atrasados, que eram a maior parte do número, não tinham sequer um tipo onde
 * caber.
 *
 * O desenho agora impede a divergência: os grupos são gerados a partir de
 * `criticalBreakdown`, a mesma estrutura que produz o total. Um tipo novo de
 * alerta obriga a mexer nas duas pontas ao mesmo tempo.
 */
import { useEffect, useState } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { IconExternal, IconWarning, IconShield, IconBolt, IconTime, IconTarget } from '@/components/icons';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AnimatedMetricValue } from "@/components/ui/stat-strip";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AlertDetail } from "@/hooks/useDashboardStats";

interface CriticalBreakdown {
  riscosCriticos: number;
  naoConformidadesCriticas: number;
  incidentesCriticos: number;
  prazosVencidos: number;
}

interface AlertsDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alertDetails: AlertDetail[];
  /** As quatro parcelas que somam o número do banner. */
  breakdown: CriticalBreakdown;
}

/** Quantos itens de cada grupo cabem antes do "+N". */
const VISIVEIS = 5;

const AlertsDetailDialog = ({
  open,
  onOpenChange,
  alertDetails,
  breakdown,
}: AlertsDetailDialogProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [pages, setPages] = useState<Record<string, number>>({});
  useEffect(() => { if (!open) setPages({}); }, [open]);

  /*
    Uma só tabela para os quatro grupos: o resumo do topo, a lista de baixo e
    o destino do "ver todos" saem todos daqui. Antes eram três sítios
    diferentes a decidir o mesmo, e foi assim que passaram a discordar.
  */
  const grupos = [
    {
      tipo: 'risco' as const,
      total: breakdown.riscosCriticos,
      icone: IconWarning,
      titulo: t('alertsDialog.criticalRisks'),
      rotuloCurto: t('alertsDialog.risksShort'),
      rota: '/riscos?nivel=critico',
      borda: 'border-severity-critical',
      tinta: 'text-severity-critical',
      maisLabel: t('alertsDialog.additionalRisks'),
    },
    {
      tipo: 'gap' as const,
      total: breakdown.naoConformidadesCriticas,
      icone: IconTarget,
      titulo: t('alertsDialog.criticalGaps'),
      rotuloCurto: t('alertsDialog.gapsShort'),
      rota: '/gap-analysis',
      borda: 'border-severity-high',
      tinta: 'text-severity-high',
      maisLabel: t('alertsDialog.additionalGaps'),
    },
    {
      tipo: 'incidente' as const,
      total: breakdown.incidentesCriticos,
      icone: IconBolt,
      titulo: t('alertsDialog.criticalIncidents'),
      rotuloCurto: t('alertsDialog.incidentsShort'),
      rota: '/incidentes',
      borda: 'border-severity-critical',
      tinta: 'text-severity-critical',
      maisLabel: t('alertsDialog.additionalIncidents'),
    },
    {
      tipo: 'prazo' as const,
      total: breakdown.prazosVencidos,
      icone: IconTime,
      titulo: t('alertsDialog.overdueDeadlines'),
      rotuloCurto: t('alertsDialog.deadlinesShort'),
      rota: '/planos-acao',
      borda: 'border-severity-medium',
      tinta: 'text-severity-medium',
      maisLabel: t('alertsDialog.additionalDeadlines'),
    },
  ];

  const irPara = (rota: string) => {
    onOpenChange(false);
    navigate(rota);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconWarning}
      title={t('alertsDialog.title')}
      size="md"
      hideFooter
    >
      {/* As quatro parcelas, na mesma ordem em que aparecem em baixo. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {grupos.map((g) => (
          <div key={g.tipo} className="rounded-lg border border-border bg-card p-3 text-center">
            <p className={`text-2xl font-bold tabular-nums ${g.total > 0 ? g.tinta : 'text-muted-foreground'}`}>
              <AnimatedMetricValue value={g.total} />
            </p>
            <p className="text-micro text-muted-foreground">{g.rotuloCurto}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {grupos.map((g) => {
          const itens = alertDetails.filter((a) => a.type === g.tipo);
          if (itens.length === 0) return null;
          const Icone = g.icone;
          const page = Math.min(pages[g.tipo] ?? 0, Math.ceil(itens.length / VISIVEIS) - 1);
          return (
            <div key={g.tipo}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Icone className={`h-4 w-4 ${g.tinta}`} strokeWidth={1.5} />
                  {g.titulo}
                </h3>
<span className="text-xs tabular-nums text-muted-foreground">{g.total}</span>
              </div>
              <div className="space-y-2">
                {itens.slice(page * VISIVEIS, (page + 1) * VISIVEIS).map((alert) => (
                  <button type="button" key={`${alert.type}-${alert.id}`} onClick={() => irPara(alert.href ?? g.rota)} className={`block w-full p-3 text-left bg-card rounded-lg border border-border border-l-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${g.borda}`}>
                    <p className="font-medium text-sm">{alert.title}</p>
                    {alert.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.description}</p>
                    )}
                  </button>
                ))}
                {itens.length > VISIVEIS && (
                  <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="ghost" size="sm" disabled={page === 0} onClick={() => setPages(p => ({ ...p, [g.tipo]: page - 1 }))}>{t('experience.previous')}</Button>
                    <span className="text-xs text-muted-foreground tabular-nums">{t('experience.pageRange', { from: page * VISIVEIS + 1, to: Math.min((page + 1) * VISIVEIS, itens.length), total: itens.length })}</span>
                    <Button type="button" variant="ghost" size="sm" disabled={(page + 1) * VISIVEIS >= itens.length} onClick={() => setPages(p => ({ ...p, [g.tipo]: page + 1 }))}>{t('experience.next')}</Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {alertDetails.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <IconShield className="h-12 w-12 mx-auto mb-3 opacity-50" strokeWidth={1.5} />
            <p>{t('alertsDialog.noAlerts')}</p>
            <p className="text-sm">{t('experience.alertScope')}</p>
          </div>
        )}
      </div>
    </DialogShell>
  );
};

export default AlertsDetailDialog;
