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
import { DialogShell } from "@/components/ui/dialog-shell";
import { IconExternal, IconWarning, IconShield, IconBolt, IconTime, IconTarget } from '@/components/icons';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
              {g.total}
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
          return (
            <div key={g.tipo}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Icone className={`h-4 w-4 ${g.tinta}`} strokeWidth={1.5} />
                  {g.titulo}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => irPara(g.rota)} className="text-xs">
                  {t('alertsDialog.viewAll')} <IconExternal className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="space-y-2">
                {itens.slice(0, VISIVEIS).map((alert) => (
                  <div key={alert.id} className={`p-3 bg-card rounded-lg border-l-4 ${g.borda}`}>
                    <p className="font-medium text-sm">{alert.title}</p>
                    {alert.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.description}</p>
                    )}
                  </div>
                ))}
                {itens.length > VISIVEIS && (
                  <button
                    type="button"
                    onClick={() => irPara(g.rota)}
                    className="w-full rounded-md py-1.5 text-xs text-muted-foreground transition-ui hover:bg-accent hover:text-accent-foreground"
                  >
                    +{itens.length - VISIVEIS} {g.maisLabel}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {alertDetails.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <IconShield className="h-12 w-12 mx-auto mb-3 opacity-50" strokeWidth={1.5} />
            <p>{t('alertsDialog.noAlerts')}</p>
            <p className="text-sm">{t('alertsDialog.allGood')}</p>
          </div>
        )}
      </div>
    </DialogShell>
  );
};

export default AlertsDetailDialog;
