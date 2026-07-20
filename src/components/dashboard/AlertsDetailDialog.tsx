import { DialogShell } from "@/components/ui/dialog-shell";
import { AlertTriangle, Shield, FileWarning, Flame, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface AlertDetail {
  id: string;
  title: string;
  description?: string;
  type: 'risco' | 'denuncia' | 'controle' | 'incidente';
}

interface AlertsDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alertDetails: AlertDetail[];
  riscosAltos: number;
  denunciasPendentes: number;
  controlesVencendo: number;
  incidentesCriticos: number;
}

const AlertsDetailDialog = ({
  open,
  onOpenChange,
  alertDetails,
  riscosAltos,
  denunciasPendentes,
  controlesVencendo,
  incidentesCriticos
}: AlertsDetailDialogProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const getTypeConfig = (type: AlertDetail['type']) => {
    switch (type) {
      case 'risco':
        return { icon: AlertTriangle, label: t('alertsDialog.risk'), variant: 'destructive' as const, route: '/riscos' };
      case 'denuncia':
        return { icon: FileWarning, label: t('alertsDialog.complaint'), variant: 'warning' as const, route: '/denuncia' };
      case 'controle':
        return { icon: Shield, label: t('alertsDialog.control'), variant: 'secondary' as const, route: '/governanca?tab=controles' };
      case 'incidente':
        return { icon: Flame, label: t('alertsDialog.incident'), variant: 'destructive' as const, route: '/incidentes' };
    }
  };

  const handleNavigate = (type: AlertDetail['type']) => {
    const config = getTypeConfig(type);
    onOpenChange(false);
    navigate(config.route);
  };

  const groupedAlerts = {
    risco: alertDetails.filter(a => a.type === 'risco'),
    denuncia: alertDetails.filter(a => a.type === 'denuncia'),
    controle: alertDetails.filter(a => a.type === 'controle'),
    incidente: alertDetails.filter(a => a.type === 'incidente')
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={AlertTriangle}
      title={t('alertsDialog.title')}
      size="md"
      hideFooter
    >
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-destructive/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{riscosAltos}</p>
            <p className="text-xs text-muted-foreground">{t('alertsDialog.highRisks')}</p>
          </div>
          <div className="bg-warning/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-warning">{denunciasPendentes}</p>
            <p className="text-xs text-muted-foreground">{t('alertsDialog.complaints')}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-secondary-foreground">{controlesVencendo}</p>
            <p className="text-xs text-muted-foreground">{t('alertsDialog.controls')}</p>
          </div>
          <div className="bg-destructive/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{incidentesCriticos}</p>
            <p className="text-xs text-muted-foreground">{t('alertsDialog.incidents')}</p>
          </div>
        </div>

        <div>
          <div className="space-y-4">
            {groupedAlerts.risco.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    {t('alertsDialog.highCriticalRisks')}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => handleNavigate('risco')} className="text-xs">
                    {t('alertsDialog.viewAll')} <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {groupedAlerts.risco.slice(0, 5).map(alert => (
                    <div key={alert.id} className="p-3 bg-muted/50 rounded-lg border-l-4 border-destructive">
                      <p className="font-medium text-sm">{alert.title}</p>
                      {alert.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.description}</p>}
                    </div>
                  ))}
                  {groupedAlerts.risco.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">+{groupedAlerts.risco.length - 5} {t('alertsDialog.additionalRisks')}</p>
                  )}
                </div>
              </div>
            )}

            {groupedAlerts.denuncia.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileWarning className="h-4 w-4 text-warning" />
                    {t('alertsDialog.pendingComplaints')}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => handleNavigate('denuncia')} className="text-xs">
                    {t('alertsDialog.viewAll')} <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {groupedAlerts.denuncia.slice(0, 5).map(alert => (
                    <div key={alert.id} className="p-3 bg-muted/50 rounded-lg border-l-4 border-warning">
                      <p className="font-medium text-sm">{alert.title}</p>
                      {alert.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.description}</p>}
                    </div>
                  ))}
                  {groupedAlerts.denuncia.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">+{groupedAlerts.denuncia.length - 5} {t('alertsDialog.additionalComplaints')}</p>
                  )}
                </div>
              </div>
            )}

            {groupedAlerts.controle.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-secondary-foreground" />
                    {t('alertsDialog.expiringControls')}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => handleNavigate('controle')} className="text-xs">
                    {t('alertsDialog.viewAll')} <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {groupedAlerts.controle.slice(0, 5).map(alert => (
                    <div key={alert.id} className="p-3 bg-muted/50 rounded-lg border-l-4 border-secondary">
                      <p className="font-medium text-sm">{alert.title}</p>
                      {alert.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.description}</p>}
                    </div>
                  ))}
                  {groupedAlerts.controle.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">+{groupedAlerts.controle.length - 5} {t('alertsDialog.additionalControls')}</p>
                  )}
                </div>
              </div>
            )}

            {groupedAlerts.incidente.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Flame className="h-4 w-4 text-destructive" />
                    {t('alertsDialog.criticalIncidents')}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => handleNavigate('incidente')} className="text-xs">
                    {t('alertsDialog.viewAll')} <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {groupedAlerts.incidente.slice(0, 5).map(alert => (
                    <div key={alert.id} className="p-3 bg-muted/50 rounded-lg border-l-4 border-destructive">
                      <p className="font-medium text-sm">{alert.title}</p>
                      {alert.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.description}</p>}
                    </div>
                  ))}
                  {groupedAlerts.incidente.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">+{groupedAlerts.incidente.length - 5} {t('alertsDialog.additionalIncidents')}</p>
                  )}
                </div>
              </div>
            )}

            {alertDetails.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t('alertsDialog.noAlerts')}</p>
                <p className="text-sm">{t('alertsDialog.allGood')}</p>
              </div>
            )}
          </div>
        </div>
    </DialogShell>
  );
};

export default AlertsDetailDialog;
