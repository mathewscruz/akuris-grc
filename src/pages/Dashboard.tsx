import { ModuleLoadingSkeleton } from '@/components/ui/module-loading-skeleton';
import { QueryError } from '@/components/ui/query-error';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/components/AuthProvider';
import { IndiceTile, RiscosTile, PlanosTile, IncidentesTile, ContratosTile, ConformidadeTile, AtividadeTile } from '@/components/dashboard/bento/tiles';
import { DashboardGreetingHeader } from '@/components/dashboard/bento/DashboardGreetingHeader';
import { usePermissions } from '@/hooks/usePermissions';
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
  const { canAccess } = usePermissions();

  // O toast de boas-vindas é disparado em /auth (Auth.tsx) antes do redirect
  // para o dashboard. Não disparamos aqui para evitar reaparecer ao navegar
  // de volta para o dashboard a partir de outras páginas.
  const [drillKey, setDrillKey] = useState<DrillDownKey | null>(null);
  const [periodo, setPeriodo] = useState(30);

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
      <div className="w-full max-w-full flex-1 space-y-6 overflow-x-hidden animate-fade-in">
        <DashboardGreetingHeader nome={(profile?.nome || '').split(' ')[0]} periodo={periodo} onPeriodo={setPeriodo} />

        <KpiDrillDownDrawer open={!!drillKey} onOpenChange={(o) => !o && setDrillKey(null)} kpiKey={drillKey} />

        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {canAccess('dashboard') !== false && <IndiceTile delay={0} />}
          {canAccess('riscos') && <RiscosTile delay={60} />}
          {(canAccess('planos-acao') || canAccess('incidentes')) && (
            <div className="flex min-w-0 flex-col gap-5 [&>section]:h-auto">
              {canAccess('planos-acao') && <PlanosTile delay={120} className="flex-1"
                pendentes={planosStats.data?.pendentes || 0}
                atrasados={planosStats.data?.atrasados || 0}
                concluidos={planosStats.data?.concluidos || 0} />}
              {canAccess('incidentes') && <IncidentesTile delay={180} className="flex-1"
                emCurso={activeIncidents}
                criticos={incidentesStats.data?.criticosEmCurso || 0}
                altos={incidentesStats.data?.altosEmCurso || 0}
                medios={incidentesStats.data?.mediosEmCurso || 0}
                baixos={incidentesStats.data?.baixosEmCurso || 0} />}
            </div>
          )}
          {canAccess('gap-analysis') && <ConformidadeTile delay={240} />}
          {canAccess('contratos') && <ContratosTile delay={300} />}
          <AtividadeTile delay={360} dias={periodo} />
        </div>
      </div>
    </TooltipProvider>
  );
}
