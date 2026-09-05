import { ModuleLoadingSkeleton } from '@/components/ui/module-loading-skeleton';
import { QueryError } from '@/components/ui/query-error';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/components/AuthProvider';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { FrameworksOverviewCard } from '@/components/dashboard/FrameworksOverviewCard';
import { RecentActivities } from '@/components/dashboard/RecentActivities';
import { RiskScoreTimeline } from '@/components/dashboard/RiskScoreTimeline';
import { GrcHealthBreakdown } from '@/components/dashboard/GrcHealthBreakdown';
import { DashboardMeta, type KpiKey } from '@/components/dashboard/DashboardMeta';
import { KpiDrillDownDrawer, type DrillDownKey } from '@/components/dashboard/KpiDrillDownDrawer';
import { useAtivosStats } from '@/hooks/useAtivosStats';
import { useControlesStats } from '@/hooks/useControlesStats';
import { useIncidentesStats } from '@/hooks/useIncidentesStats';
import { useContratosStats } from '@/hooks/useContratosStats';
import { useDocumentosStats } from '@/hooks/useDocumentosStats';
import { useRiscosStats } from '@/hooks/useRiscosStats';
import { usePlanosAcaoStats } from '@/hooks/usePlanosAcaoStats';
import { useDueDiligenceStats } from '@/hooks/useDueDiligenceStats';
import { useDenunciasStats } from '@/hooks/useDenunciasStats';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDashboardLive } from '@/hooks/useDashboardLive';

/**
 * Painel — o estado do GRC, e o que fazer a seguir.
 *
 * A página foi remontada sobre três regras, todas medidas no que estava no ar:
 *
 *  1. **Nada decorativo.** O banner de topo tinha gradiente, padrão de marca,
 *     dois glows desfocados e um chevron de canto — quatro camadas para
 *     mostrar dois números, ocupando 246px (27% do ecrã) antes do primeiro
 *     dado accionável. O próprio `index.css` já mandava o contrário: "os
 *     planos são todos brancos e separados por fio de borda".
 *
 *  2. **Um número herói por painel.** O 50 da maturidade aparecia no gauge E
 *     como título da Saúde do GRC, a 200px de distância. Passa a aparecer uma
 *     vez, à frente dos oito domínios que o explicam.
 *
 *  3. **Toda métrica termina num verbo.** A página inteira tinha UMA frase
 *     accionável ("Ver todos"). Os números que exigem decisão existiam, mas
 *     viviam em `title` — ou seja, num tooltip, que não se vê, não se navega
 *     por teclado e não existe no telemóvel.
 *
 * A ordem responde a três perguntas, por esta ordem: o que arde agora
 * (alertas), para onde vai a carteira e o que está atribuído a mim, e como
 * está cada domínio.
 */
export default function Dashboard() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  // O toast de boas-vindas é disparado em /auth (Auth.tsx) antes do redirect
  // para o dashboard. Não disparamos aqui para evitar reaparecer ao navegar
  // de volta para o dashboard a partir de outras páginas.
  const [drillKey, setDrillKey] = useState<DrillDownKey | null>(null);

  /*
    O painel atualiza-se sozinho.

    Substitui o botão "atualizar" e o carimbo "Atualizado às HH:MM": subscreve
    as tabelas de onde saem estes números e reconsulta o que ficou velho. Ver
    `useDashboardLive` — e a migration que põe as tabelas na publicação de
    Realtime, sem a qual a subscrição liga e nunca recebe nada.
  */
  useDashboardLive();

  const ativosStats = useAtivosStats();
  const controlesStats = useControlesStats();
  const incidentesStats = useIncidentesStats();
  const contratosStats = useContratosStats();
  const documentosStats = useDocumentosStats();
  const riscosStats = useRiscosStats();
  const planosStats = usePlanosAcaoStats();
  const ddStats = useDueDiligenceStats();
  const denunciasStats = useDenunciasStats();

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
    denunciasStats.isLoading;

  if (isLoading) {
    return <ModuleLoadingSkeleton statCards={4} />;
  }

  const metricQueries = [ativosStats, controlesStats, incidentesStats, contratosStats, documentosStats, riscosStats, planosStats, ddStats, denunciasStats];
  if (metricQueries.some(query => query.isError)) return <QueryError onRetry={() => metricQueries.forEach(query => void query.refetch())} />;

  /*
     `emCurso`, e não a soma à mão.

     Era `abertos + investigacao` e deixava de fora os CONTIDOS. Um
     incidente contido não está resolvido — ainda há trabalho por fazer.
     Medido nesta base: 3 resolvidos, 1 contido e 1 em investigação, e a
     primeira linha do painel anunciava «1 incidente aberto» quando eram
     dois por fechar. `isIncidenteEmCurso` já diz exactamente isto.
  */
  const activeIncidents = incidentesStats.data?.emCurso || 0;

  return (
    <TooltipProvider>
      <div className="space-y-5 animate-fade-in w-full max-w-full overflow-x-hidden flex flex-1 flex-col">
        <DashboardHeader />

        {/*
          Saudação e contexto, em texto corrido.

          Era uma faixa de oito pílulas com moldura, rolável, ocupando uma banda
          inteira da página para dizer o tamanho do parque. A forma prometia
          decisão e o conteúdo não tinha nenhuma — ninguém age sobre "8
          documentos". Continua clicável; muda o peso, não a função.
        */}
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground">
            {t('dashboard_v3.hello', { name: profile?.nome || 'Usuário' })}
          </p>

          <DashboardMeta
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
            denunciasAbertas={
              (denunciasStats.data?.novas || 0) + (denunciasStats.data?.em_andamento || 0)
            }
            denunciasNovas={denunciasStats.data?.novas || 0}
            onPillClick={(key: KpiKey) => setDrillKey(key as DrillDownKey)}
          />
        </div>


        <KpiDrillDownDrawer
          open={!!drillKey}
          onOpenChange={(o) => !o && setDrillKey(null)}
          kpiKey={drillKey}
        />


        {/* Para onde vai a carteira · o que está por avaliar */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 lg:gap-5 w-full">
          <div className="min-w-0 xl:col-span-2">
            <RiskScoreTimeline />
          </div>
          <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
            <FrameworksOverviewCard />
          </div>
        </div>

        {/* Como está cada domínio, do pior para o melhor */}
        <GrcHealthBreakdown />

        {/* O último bloco come o espaço que sobra, em vez de deixar uma faixa
            de fundo vazia por baixo. */}
        <RecentActivities className="flex-1 min-h-[16rem]" />

      </div>
    </TooltipProvider>
  );
}
