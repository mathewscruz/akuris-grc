import { Skeleton } from '@/components/ui/skeleton';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/components/AuthProvider';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { FrameworksOverviewCard } from '@/components/dashboard/FrameworksOverviewCard';
import { RecentActivities } from '@/components/dashboard/RecentActivities';
import { RiskScoreTimeline } from '@/components/dashboard/RiskScoreTimeline';
import AlertsDetailDialog from '@/components/dashboard/AlertsDetailDialog';
import { GrcHealthBreakdown } from '@/components/dashboard/GrcHealthBreakdown';


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
import { useRiscosStats } from '@/hooks/useRiscosStats';
import { usePlanosAcaoStats } from '@/hooks/usePlanosAcaoStats';
import { useDueDiligenceStats } from '@/hooks/useDueDiligenceStats';
import { useDenunciasStats } from '@/hooks/useDenunciasStats';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGrcMaturityScore } from '@/hooks/useGrcMaturityScore';
import { useQueryClient } from '@tanstack/react-query';

export default function Dashboard() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false);

  // O toast de boas-vindas é disparado em /auth (Auth.tsx) antes do redirect
  // para o dashboard. Não disparamos aqui para evitar reaparecer ao navegar
  // de volta para o dashboard a partir de outras páginas.
  const [drillKey, setDrillKey] = useState<DrillDownKey | null>(null);
  const queryClient = useQueryClient();
  
  const ativosStats = useAtivosStats();
  const controlesStats = useControlesStats();
  const incidentesStats = useIncidentesStats();
  const contratosStats = useContratosStats();
  const documentosStats = useDocumentosStats();
  const riscosStats = useRiscosStats();
  const planosStats = usePlanosAcaoStats();
  const ddStats = useDueDiligenceStats();
  const denunciasStats = useDenunciasStats();
  const { data: dashboardData, isLoading: dashboardLoading, dataUpdatedAt } = useDashboardStats();
  const { data: trends } = useTrendData();
  const maturity = useGrcMaturityScore();

  // Todos os indicadores exibidos têm de entrar no estado de carregamento —
  // caso contrário a página renderiza `|| 0` para os que ainda não chegaram e
  // o utilizador vê zeros que depois saltam para o valor real.
  const isLoading =
    ativosStats.isLoading ||
    controlesStats.isLoading ||
    incidentesStats.isLoading ||
    contratosStats.isLoading ||
    documentosStats.isLoading ||
    riscosStats.isLoading ||
    planosStats.isLoading ||
    ddStats.isLoading ||
    denunciasStats.isLoading ||
    dashboardLoading;

  // Esta lista tem de cobrir *todas* as queries que alimentam o dashboard.
  // Faltar uma faz o botão "atualizar" mostrar dados antigos sem qualquer aviso.
  const DASHBOARD_QUERY_KEYS = [
    'dashboard-stats',
    'ativos-stats',
    'controles-stats',
    'incidentes-stats',
    'contratos-stats',
    'documentos-stats',
    'riscos-stats',
    'planos-acao-stats',
    'due-diligence-stats',
    'denuncias-stats',
    'gap-analysis-stats',
    // Era 'trend-data', chave que não existe — o `TrendIndicators` usa
    // 'trend-indicators'. E faltavam as dos cartões de frameworks e
    // maturidade: o botão "atualizar" mostrava dados antigos sem aviso.
    // (o radar deriva destes hooks, não tem chave própria.)
    'trend-indicators',
    'frameworks-overview',
    'maturity-trend',
    'recent-activities',
  ] as const;

  const handleRefreshAll = () => {
    DASHBOARD_QUERY_KEYS.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
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
        {/* Header contextual com título, refresh e timestamp */}
        <DashboardHeader
          userName={profile?.nome || 'Usuário'}
          criticalCount={dashboardData?.criticalAlerts || 0}
          dataUpdatedAt={dataUpdatedAt}
          onRefresh={handleRefreshAll}
        />

        {/* Hero Score Banner */}
        <HeroScoreBanner
          maturity={maturity}
          criticalAlerts={dashboardData?.criticalAlerts || 0}
          criticalBreakdown={dashboardData?.criticalBreakdown}
          activeControls={controlesStats.data?.ativos || 0}
          userName={profile?.nome || 'Usuário'}
          onAlertsClick={() => setAlertsDialogOpen(true)}
        />

        {/* KPI Pills */}
        <KPIPills
          ativos={ativosStats.data?.total || 0}
            activeIncidents={activeIncidents}
            incidentsThisMonth={incidentesStats.data?.mes || 0}
            activeContracts={contratosStats.data?.ativos || 0}
            contractsExpiring={contratosStats.data?.vencendo30Dias || 0}
            contractsExpired={contratosStats.data?.vencidos || 0}
            activeDocs={documentosStats.data?.ativos || 0}
            totalDocs={documentosStats.data?.total || 0}
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

        <KpiDrillDownDrawer
          open={!!drillKey}
          onOpenChange={(o) => !o && setDrillKey(null)}
          kpiKey={drillKey}
        />


        {/* Saúde do GRC (radar) + Frameworks + Evolução dos Riscos */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 w-full">
          <div className="min-w-0"><GrcHealthBreakdown /></div>
          <div className="min-w-0"><FrameworksOverviewCard /></div>
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
