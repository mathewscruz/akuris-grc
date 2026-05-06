import { Skeleton } from '@/components/ui/skeleton';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/components/AuthProvider';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MultiDimensionalRadar } from '@/components/dashboard/MultiDimensionalRadar';
import { RecentActivities } from '@/components/dashboard/RecentActivities';
import { RiskScoreTimeline } from '@/components/dashboard/RiskScoreTimeline';
import AlertsDetailDialog from '@/components/dashboard/AlertsDetailDialog';
import { UpcomingExpirations } from '@/components/dashboard/UpcomingExpirations';


import { useTrendData } from '@/components/dashboard/TrendIndicators';
import { HeroScoreBanner } from '@/components/dashboard/HeroScoreBanner';
import { KPIPills, type KpiKey } from '@/components/dashboard/KPIPills';
import { KpiDrillDownDrawer, type DrillDownKey } from '@/components/dashboard/KpiDrillDownDrawer';
import { useAtivosStats } from '@/hooks/useAtivosStats';
import { useControlesStats } from '@/hooks/useControlesStats';
import { useIncidentesStats } from '@/hooks/useIncidentesStats';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useContratosStats } from '@/hooks/useContratosStats';
import { useDocumentosStats } from '@/hooks/useDocumentosStats';
import { useGapAnalysisStats } from '@/hooks/useGapAnalysisStats';
import { useRiscosStats } from '@/hooks/useRiscosStats';
import { usePlanosAcaoStats } from '@/hooks/usePlanosAcaoStats';
import { useDueDiligenceStats } from '@/hooks/useDueDiligenceStats';
import { useDenunciasStats } from '@/hooks/useDenunciasStats';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRadarChartData } from '@/hooks/useRadarChartData';
import { useGrcMaturityScore } from '@/hooks/useGrcMaturityScore';
import { useQueryClient } from '@tanstack/react-query';

export default function Dashboard() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false);

  // Toast de boas-vindas pós-login: só dispara quando o dashboard já montou
  // (sinalizado pelo Auth.tsx via sessionStorage), evitando "vazar" sobre o overlay.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('akuris_show_login_toast') === '1') {
        sessionStorage.removeItem('akuris_show_login_toast');
        // Import dinâmico para evitar adicionar import no topo se já não existir.
        import('sonner').then(({ toast }) => {
          toast.success(t('auth.loginSuccess'));
        });
      }
    } catch { /* ignore */ }
  }, [t]);
  const [drillKey, setDrillKey] = useState<DrillDownKey | null>(null);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('akuris.focusMode') === '1';
  });
  useEffect(() => {
    try {
      window.localStorage.setItem('akuris.focusMode', isFocusMode ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [isFocusMode]);
  const queryClient = useQueryClient();
  
  const ativosStats = useAtivosStats();
  const controlesStats = useControlesStats();
  const incidentesStats = useIncidentesStats();
  const contratosStats = useContratosStats();
  const documentosStats = useDocumentosStats();
  const gapStats = useGapAnalysisStats();
  const riscosStats = useRiscosStats();
  const planosStats = usePlanosAcaoStats();
  const ddStats = useDueDiligenceStats();
  const denunciasStats = useDenunciasStats();
  const { data: dashboardData, isLoading: dashboardLoading, dataUpdatedAt } = useDashboardStats();
  const { data: trends } = useTrendData();
  const { data: radarData } = useRadarChartData();
  const maturity = useGrcMaturityScore();

  const isLoading = ativosStats.isLoading || controlesStats.isLoading || incidentesStats.isLoading || dashboardLoading;

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['ativos-stats'] });
    queryClient.invalidateQueries({ queryKey: ['controles-stats'] });
    queryClient.invalidateQueries({ queryKey: ['incidentes-stats'] });
    queryClient.invalidateQueries({ queryKey: ['contratos-stats'] });
    queryClient.invalidateQueries({ queryKey: ['documentos-stats'] });
    queryClient.invalidateQueries({ queryKey: ['gap-analysis-stats'] });
    queryClient.invalidateQueries({ queryKey: ['trend-data'] });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AkurisPulse size={48} />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  const activeIncidents = (incidentesStats.data?.abertos || 0) + (incidentesStats.data?.investigacao || 0);

  return (
    <TooltipProvider>
      <div className="space-y-5 animate-fade-in w-full max-w-full overflow-x-hidden">
        {/* Header contextual com saudação, Modo Foco e timestamp */}
        <DashboardHeader
          userName={profile?.nome || 'Usuário'}
          criticalCount={dashboardData?.criticalAlerts || 0}
          dataUpdatedAt={dataUpdatedAt}
          isFocusMode={isFocusMode}
          onToggleFocus={() => setIsFocusMode((v) => !v)}
          onRefresh={handleRefreshAll}
        />

        {/* Hero Score Banner */}
        <HeroScoreBanner
          maturity={maturity}
          criticalAlerts={dashboardData?.criticalAlerts || 0}
          activeControls={controlesStats.data?.ativos || 0}
          complianceScore={
            (gapStats.data?.totalFrameworks || 0) > 0 && (gapStats.data?.assessmentsInProgress || 0) > 0
              ? gapStats.data!.averageCompliance
              : null
          }
          userName={profile?.nome || 'Usuário'}
        />

        {/* KPI Pills — escondidos em Modo Foco */}
        {!isFocusMode && (
          <KPIPills
            ativos={ativosStats.data?.total || 0}
            activeIncidents={activeIncidents}
            incidentsThisMonth={incidentesStats.data?.mes || 0}
            activeContracts={contratosStats.data?.ativos || 0}
            contractsExpiring={contratosStats.data?.vencendo30Dias || 0}
            contractsExpired={contratosStats.data?.vencidos || 0}
            activeDocs={documentosStats.data?.ativos || 0}
            docsExpiring={documentosStats.data?.vencendo30Dias || 0}
            docsPending={documentosStats.data?.pendentesAprovacao || 0}
            totalRiscos={riscosStats.data?.total || 0}
            riscosCriticos={riscosStats.data?.criticos || 0}
            riscosAltos={riscosStats.data?.altos || 0}
            planosPendentes={planosStats.data?.pendentes || 0}
            planosAtrasados={planosStats.data?.atrasados || 0}
            ddAtivos={ddStats.data?.activeAssessments || 0}
            ddExpirados={ddStats.data?.expiredAssessments || 0}
            denunciasAbertas={(denunciasStats.data?.novas || 0) + (denunciasStats.data?.em_andamento || 0)}
            denunciasNovas={denunciasStats.data?.novas || 0}
            onPillClick={(key: KpiKey) => setDrillKey(key as DrillDownKey)}
          />
        )}

        <KpiDrillDownDrawer
          open={!!drillKey}
          onOpenChange={(o) => !o && setDrillKey(null)}
          kpiKey={drillKey}
        />


        {/* Vencimentos + Radar + Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 w-full">
          <div className="min-w-0"><UpcomingExpirations /></div>
          <div className="min-w-0"><MultiDimensionalRadar /></div>
          <div className="min-w-0 md:col-span-2 xl:col-span-1"><RiskScoreTimeline /></div>
        </div>

        {/* Atividades Recentes full width */}
        <RecentActivities />

        {/* Dialog de alertas */}
        <AlertsDetailDialog
          open={alertsDialogOpen}
          onOpenChange={setAlertsDialogOpen}
          alertDetails={dashboardData?.alertDetails || []}
          riscosAltos={dashboardData?.riscosAltos || 0}
          denunciasPendentes={dashboardData?.denunciasPendentes || 0}
          controlesVencendo={dashboardData?.controlesVencendo || 0}
          incidentesCriticos={dashboardData?.incidentesCriticos || 0}
        />
      </div>
    </TooltipProvider>
  );
}
