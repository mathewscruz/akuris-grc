import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import { avisoDeConsultaFalhada, descreveErro } from '@/lib/erro-de-consulta';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/components/AuthProvider';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { InicioDoCliente } from '@/components/InicioDoCliente';
import Layout from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteFallback } from '@/components/ui/route-fallback';
import { DocGenProvider } from '@/contexts/DocGenContext';
import { installStatsInvalidation } from '@/lib/stats-invalidation';
import { seguirEscritas } from '@/lib/atualizar-apos-escrita';



// Lazy-loaded pages
const Auth = React.lazy(() => import('@/pages/Auth'));
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Ativos = React.lazy(() => import('@/pages/Ativos'));
const AtivosLicencas = React.lazy(() => import('@/pages/AtivosLicencas'));
const AtivosChaves = React.lazy(() => import('@/pages/AtivosChaves'));
const Riscos = React.lazy(() => import('@/pages/Riscos').then(m => ({ default: m.Riscos })));
const Continuidade = React.lazy(() => import('@/pages/Continuidade'));
const GapAnalysisFrameworks = React.lazy(() => import('@/pages/GapAnalysisFrameworks'));
const GapAnalysisFrameworkDetail = React.lazy(() => import('@/pages/GapAnalysisFrameworkDetail'));
const Contratos = React.lazy(() => import('@/pages/Contratos'));
const Governanca = React.lazy(() => import('@/pages/Governanca'));
const Sistemas = React.lazy(() => import('@/pages/Sistemas'));
const Documentos = React.lazy(() => import('@/pages/Documentos'));
const ContasPrivilegiadas = React.lazy(() => import('@/pages/ContasPrivilegiadas'));
const Incidentes = React.lazy(() => import('@/pages/Incidentes'));
const Privacidade = React.lazy(() => import('@/pages/Privacidade'));
const DueDiligence = React.lazy(() => import('@/pages/DueDiligence'));
const Assessment = React.lazy(() => import('@/pages/Assessment'));
const RevisaoAcessos = React.lazy(() => import('@/pages/RevisaoAcessos'));
const ReviewExterna = React.lazy(() => import('@/pages/ReviewExterna'));
const Denuncia = React.lazy(() => import('@/pages/Denuncia'));
import DenunciaRouter from '@/pages/DenunciaRouter';
const DenunciaExternaRedirect = React.lazy(() => import('@/pages/DenunciaExternaRedirect'));
const DenunciaMenu = React.lazy(() => import('@/pages/DenunciaMenu'));
const DenunciaFormulario = React.lazy(() => import('@/pages/DenunciaFormulario'));
const DenunciaConsulta = React.lazy(() => import('@/pages/DenunciaConsulta'));
const Configuracoes = React.lazy(() => import('@/pages/Configuracoes'));
const NotFound = React.lazy(() => import('@/pages/NotFound'));
const LandingPage = React.lazy(() => import('@/pages/LandingPage'));
const PoliticaPrivacidade = React.lazy(() => import('@/pages/PoliticaPrivacidade'));
const PlanosAcao = React.lazy(() => import('@/pages/PlanosAcao'));
const Projetos = React.lazy(() => import('@/pages/Projetos'));
const ProjetoDetalhe = React.lazy(() => import('@/pages/ProjetoDetalhe'));
const MinhasTarefas = React.lazy(() => import('@/pages/MinhasTarefas'));
const ProjetoTemplates = React.lazy(() => import('@/pages/ProjetoTemplates'));
const Relatorios = React.lazy(() => import('@/pages/Relatorios'));
const FrameworkSEO = React.lazy(() => import('@/pages/FrameworkSEO'));
const Blog = React.lazy(() => import('@/pages/Blog'));
const BlogPost = React.lazy(() => import('@/pages/BlogPost'));

const PlanosAssinatura = React.lazy(() => import('@/pages/PlanosAssinatura'));
const DefinirSenha = React.lazy(() => import('@/pages/DefinirSenha'));

const isNetworkError = (error: unknown): boolean => {
  if (!navigator.onLine) return true;
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  if (error instanceof Error && error.message.includes('NetworkError')) return true;
  return false;
};

/*
  Uma consulta que falha tem de o dizer.

  Nenhum dos ecrãs de lista lê o `isError` da sua consulta -- só o `data`, que
  cai no `[]` por omissão. Quando a consulta rebenta (rede, RLS, coluna
  renomeada), a tabela mostra o ESTADO VAZIO: "Nenhum documento cadastrado --
  comece criando documentos". Num produto de compliance isto é o pior erro
  possível: o auditor conclui que a empresa não tem política nenhuma, quando na
  verdade a leitura falhou.

  Tratar isto ecrã a ecrã seriam catorze sítios e um esquecimento garantido no
  próximo. Aqui apanha-se no sítio por onde todas passam. O ecrã continua a
  mostrar o que sabe; o aviso é que deixa de faltar.
*/
const queryCache = new QueryCache({
  onError: (error, query) => {
    logger.error('Consulta falhou', {
      chave: JSON.stringify(query.queryKey),
      erro: descreveErro(error),
    });
    const aviso = avisoDeConsultaFalhada(query.queryKey);
    toast.error(aviso.titulo, { id: aviso.id, description: aviso.descricao });
  },
});

const queryClient = new QueryClient({
  queryCache,
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      retry: (failureCount, error) => {
        // Only retry on network errors, max 2 times
        if (!isNetworkError(error)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

// Faixas de estatística acompanham qualquer criação/edição/eliminação (Envio 14 · 3).
installStatsInvalidation(queryClient);

// E qualquer escrita na base manda o ecrã reler-se: 114 dos 172 ficheiros que
// escrevem nunca invalidavam nada, e quem gravava tinha de sair e voltar para
// ver o que fez. Ver `lib/atualizar-apos-escrita.ts`.
seguirEscritas(() => { queryClient.invalidateQueries(); });


function AssessmentLinkRedirect() {
  const { token } = useParams<{ token: string }>();
  return <Navigate to={`/assessment/${token ?? ''}`} replace />;
}

/**
 * Um único casco autenticado para toda a navegação interna.
 *
 * Antes cada rota criava o seu próprio Layout. Navegar desmontava sidebar,
 * cabeçalho, onboarding e providers visuais, repetindo consultas e estados
 * globais. O Outlet troca apenas o conteúdo do módulo.
 */
function AuthenticatedShell() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function App() {
  return (
    <LanguageProvider>
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <DocGenProvider>
          <ErrorBoundary>
          <Routes>
            {/* Rotas públicas com Suspense individual (não tem sidebar para preservar) */}
            <Route path="/auth" element={<Suspense fallback={<RouteFallback />}><Auth /></Suspense>} />
            <Route path="/definir-senha" element={<Suspense fallback={<RouteFallback />}><DefinirSenha /></Suspense>} />
            <Route path="/assessment/:token" element={<Suspense fallback={<RouteFallback />}><Assessment /></Suspense>} />
            {/* Compatibilidade: links antigos enviados por e-mail */}
            <Route path="/due-diligence/responder/:token" element={<AssessmentLinkRedirect />} />
            <Route path="/dd/responder/:token" element={<AssessmentLinkRedirect />} />
            <Route path="/denuncia/externa/:token" element={<Suspense fallback={<RouteFallback />}><DenunciaExternaRedirect /></Suspense>} />
            <Route path="/:empresa/denuncia" element={<Suspense fallback={<RouteFallback />}><DenunciaMenu /></Suspense>} />
            <Route path="/:empresa/denuncia/registrar" element={<Suspense fallback={<RouteFallback />}><DenunciaFormulario /></Suspense>} />
            <Route path="/:empresa/denuncia/consulta" element={<Suspense fallback={<RouteFallback />}><DenunciaConsulta /></Suspense>} />
            <Route path="/404" element={<Suspense fallback={<RouteFallback />}><NotFound /></Suspense>} />
            <Route path="/" element={<Suspense fallback={<RouteFallback />}><LandingPage /></Suspense>} />
            <Route path="/politica-privacidade" element={<Suspense fallback={<RouteFallback />}><PoliticaPrivacidade /></Suspense>} />
            <Route path="/blog" element={<Suspense fallback={<RouteFallback />}><Blog /></Suspense>} />
            <Route path="/blog/:slug" element={<Suspense fallback={<RouteFallback />}><BlogPost /></Suspense>} />
            <Route path="/frameworks/:slug" element={<Suspense fallback={<RouteFallback />}><FrameworkSEO /></Suspense>} />
            <Route path="/registro" element={<Navigate to="/auth" replace />} />
            <Route path="/planos" element={<Suspense fallback={<RouteFallback />}><PlanosAssinatura /></Suspense>} />
            <Route path="/checkout-success" element={<Navigate to="/dashboard" replace />} />
            <Route path="/review/:token" element={<Suspense fallback={<RouteFallback />}><ReviewExterna /></Suspense>} />

            {/* Rotas autenticadas - Layout traz seu próprio Suspense interno para preservar sidebar/header */}
            {/*
              O painel deixou de ser o início de toda a gente.

              Quem compra só o canal de denúncia não tem painel de GRC; mandá-lo
              para aqui dava-lhe um cartão de "acesso negado" como primeira tela
              do produto. `InicioDoCliente` desvia para o primeiro módulo que a
              pessoa consegue mesmo abrir, e todos os pontos de entrada
              (login, checkout, logótipo) continuam a apontar para `/dashboard`.
            */}
            <Route element={<AuthenticatedShell />}>
              <Route path="/dashboard" element={
                <InicioDoCliente>
                  <ProtectedRoute moduleName="dashboard" fallbackToRoleCheck={false}><Dashboard /></ProtectedRoute>
                </InicioDoCliente>
              } />
              <Route path="/planos-acao" element={<ProtectedRoute moduleName="planos-acao"><PlanosAcao /></ProtectedRoute>} />
              <Route path="/projetos" element={<ProtectedRoute moduleName="projetos"><Projetos /></ProtectedRoute>} />
              <Route path="/projetos/minhas-tarefas" element={<ProtectedRoute moduleName="projetos"><MinhasTarefas /></ProtectedRoute>} />
              <Route path="/projetos/templates" element={<ProtectedRoute moduleName="projetos"><ProjetoTemplates /></ProtectedRoute>} />
              <Route path="/projetos/:id" element={<ProtectedRoute moduleName="projetos"><ProjetoDetalhe /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute moduleName="relatorios" fallbackToRoleCheck={false}><Relatorios /></ProtectedRoute>} />
              <Route path="/ativos" element={<ProtectedRoute moduleName="ativos" fallbackToRoleCheck={false}><Ativos /></ProtectedRoute>} />
              <Route path="/ativos/licencas" element={<ProtectedRoute moduleName="ativos" fallbackToRoleCheck={false}><AtivosLicencas /></ProtectedRoute>} />
              <Route path="/ativos/chaves" element={<ProtectedRoute moduleName="ativos" fallbackToRoleCheck={false}><AtivosChaves /></ProtectedRoute>} />
              <Route path="/riscos" element={<ProtectedRoute moduleName="riscos" fallbackToRoleCheck={false}><Riscos /></ProtectedRoute>} />
              <Route path="/continuidade" element={<ProtectedRoute moduleName="continuidade" fallbackToRoleCheck={false}><Continuidade /></ProtectedRoute>} />
              <Route path="/gap-analysis/frameworks" element={<ProtectedRoute moduleName="gap-analysis" fallbackToRoleCheck={false}><GapAnalysisFrameworks /></ProtectedRoute>} />
              <Route path="/gap-analysis/framework/:frameworkId" element={<ProtectedRoute moduleName="gap-analysis" fallbackToRoleCheck={false}><GapAnalysisFrameworkDetail /></ProtectedRoute>} />
              <Route path="/governanca" element={<ProtectedRoute moduleName="controles" fallbackToRoleCheck={false}><Governanca /></ProtectedRoute>} />
              <Route path="/governanca/controles" element={<ProtectedRoute moduleName="controles" fallbackToRoleCheck={false}><Governanca /></ProtectedRoute>} />
              <Route path="/governanca/auditorias" element={<ProtectedRoute moduleName="controles" fallbackToRoleCheck={false}><Governanca /></ProtectedRoute>} />
              <Route path="/sistemas" element={<ProtectedRoute moduleName="controles" fallbackToRoleCheck={false}><Sistemas /></ProtectedRoute>} />
              <Route path="/contratos" element={<ProtectedRoute moduleName="contratos" fallbackToRoleCheck={false}><Contratos /></ProtectedRoute>} />
              <Route path="/documentos" element={<ProtectedRoute moduleName="documentos" fallbackToRoleCheck={false}><Documentos /></ProtectedRoute>} />
              <Route path="/contas-privilegiadas" element={<ProtectedRoute moduleName="contas-privilegiadas" fallbackToRoleCheck={false}><ContasPrivilegiadas /></ProtectedRoute>} />
              <Route path="/incidentes" element={<ProtectedRoute moduleName="incidentes" fallbackToRoleCheck={false}><Incidentes /></ProtectedRoute>} />
              <Route path="/privacidade" element={<ProtectedRoute moduleName="dados" fallbackToRoleCheck={false}><Privacidade /></ProtectedRoute>} />
              <Route path="/due-diligence" element={<ProtectedRoute moduleName="due-diligence" fallbackToRoleCheck={false}><DueDiligence /></ProtectedRoute>} />
              <Route path="/revisao-acessos" element={<ProtectedRoute moduleName="contas-privilegiadas" fallbackToRoleCheck={false}><RevisaoAcessos /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute moduleName="configuracoes" fallbackToRoleCheck={false}><Configuracoes /></ProtectedRoute>} />
            </Route>

            {/* Redirecionamentos legados não precisam montar o casco antes de navegar. */}
            <Route path="/riscos/aceite" element={<Navigate to="/riscos?view=aceite" replace />} />
            <Route path="/gap-analysis" element={<Navigate to="/gap-analysis/frameworks" replace />} />
            <Route path="/gap-analysis/avaliacao-aderencia" element={<Navigate to="/gap-analysis/frameworks" replace />} />
            <Route path="/controles" element={<Navigate to="/governanca/controles" replace />} />
            <Route path="/auditorias" element={<Navigate to="/governanca/auditorias" replace />} />
            <Route path="/dados" element={<Navigate to="/privacidade" replace />} />

            {/* `/denuncia` é dual: público (landing) ou autenticado (módulo). */}
            <Route path="/denuncia" element={<DenunciaRouter />} />
            <Route path="*" element={<Suspense fallback={<RouteFallback />}><NotFound /></Suspense>} />
          </Routes>
          </ErrorBoundary>
          </DocGenProvider>
        </Router>
        
        <SonnerToaster />
      </AuthProvider>
    </QueryClientProvider>
    </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
