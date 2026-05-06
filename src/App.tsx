import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/components/AuthProvider';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteFallback } from '@/components/ui/route-fallback';
import { DocGenProvider } from '@/contexts/DocGenContext';


// Lazy-loaded pages
const Auth = React.lazy(() => import('@/pages/Auth'));
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Ativos = React.lazy(() => import('@/pages/Ativos'));
const AtivosLicencas = React.lazy(() => import('@/pages/AtivosLicencas'));
const AtivosChaves = React.lazy(() => import('@/pages/AtivosChaves'));
const Riscos = React.lazy(() => import('@/pages/Riscos').then(m => ({ default: m.Riscos })));
const RiscosAceite = React.lazy(() => import('@/pages/RiscosAceite'));
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
const DenunciaRouter = React.lazy(() => import('@/pages/DenunciaRouter'));
const DenunciaExternaRedirect = React.lazy(() => import('@/pages/DenunciaExternaRedirect'));
const DenunciaMenu = React.lazy(() => import('@/pages/DenunciaMenu'));
const DenunciaFormulario = React.lazy(() => import('@/pages/DenunciaFormulario'));
const DenunciaConsulta = React.lazy(() => import('@/pages/DenunciaConsulta'));
const Configuracoes = React.lazy(() => import('@/pages/Configuracoes'));
const NotFound = React.lazy(() => import('@/pages/NotFound'));
const LandingPage = React.lazy(() => import('@/pages/LandingPage'));
const PoliticaPrivacidade = React.lazy(() => import('@/pages/PoliticaPrivacidade'));
const PlanosAcao = React.lazy(() => import('@/pages/PlanosAcao'));
const Relatorios = React.lazy(() => import('@/pages/Relatorios'));

const Registro = React.lazy(() => import('@/pages/Registro'));
const Planos = React.lazy(() => import('@/pages/Planos'));
const DefinirSenha = React.lazy(() => import('@/pages/DefinirSenha'));

const isNetworkError = (error: unknown): boolean => {
  if (!navigator.onLine) return true;
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  if (error instanceof Error && error.message.includes('NetworkError')) return true;
  return false;
};

const queryClient = new QueryClient({
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
            <Route path="/denuncia/externa/:token" element={<Suspense fallback={<RouteFallback />}><DenunciaExternaRedirect /></Suspense>} />
            <Route path="/:empresa/denuncia" element={<Suspense fallback={<RouteFallback />}><DenunciaMenu /></Suspense>} />
            <Route path="/:empresa/denuncia/registrar" element={<Suspense fallback={<RouteFallback />}><DenunciaFormulario /></Suspense>} />
            <Route path="/:empresa/denuncia/consulta" element={<Suspense fallback={<RouteFallback />}><DenunciaConsulta /></Suspense>} />
            <Route path="/404" element={<Suspense fallback={<RouteFallback />}><NotFound /></Suspense>} />
            <Route path="/" element={<Suspense fallback={<RouteFallback />}><LandingPage /></Suspense>} />
            <Route path="/politica-privacidade" element={<Suspense fallback={<RouteFallback />}><PoliticaPrivacidade /></Suspense>} />
            <Route path="/registro" element={<Suspense fallback={<RouteFallback />}><Registro /></Suspense>} />
            <Route path="/planos" element={<Suspense fallback={<RouteFallback />}><Planos /></Suspense>} />
            <Route path="/checkout-success" element={<Navigate to="/dashboard" replace />} />
            <Route path="/review/:token" element={<Suspense fallback={<RouteFallback />}><ReviewExterna /></Suspense>} />

            {/* Rotas autenticadas - Layout traz seu próprio Suspense interno para preservar sidebar/header */}
            <Route path="/dashboard" element={
              <Layout>
                <ProtectedRoute moduleName="dashboard" fallbackToRoleCheck={false}>
                  <Dashboard />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/planos-acao" element={
              <Layout>
                <ProtectedRoute moduleName="planos-acao">
                  <PlanosAcao />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/relatorios" element={
              <Layout>
                <ProtectedRoute moduleName="relatorios" fallbackToRoleCheck={false}>
                  <Relatorios />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/ativos" element={
              <Layout>
                <ProtectedRoute moduleName="ativos" fallbackToRoleCheck={false}>
                  <Ativos />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/ativos/licencas" element={
              <Layout>
                <ProtectedRoute moduleName="ativos" fallbackToRoleCheck={false}>
                  <AtivosLicencas />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/ativos/chaves" element={
              <Layout>
                <ProtectedRoute moduleName="ativos" fallbackToRoleCheck={false}>
                  <AtivosChaves />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/riscos" element={
              <Layout>
                <ProtectedRoute moduleName="riscos" fallbackToRoleCheck={false}>
                  <Riscos />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/riscos/aceite" element={
              <Layout>
                <ProtectedRoute moduleName="riscos" fallbackToRoleCheck={false}>
                  <RiscosAceite />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/continuidade" element={
              <Layout>
                <ProtectedRoute moduleName="continuidade" fallbackToRoleCheck={false}>
                  <Continuidade />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/gap-analysis" element={
              <Navigate to="/gap-analysis/frameworks" replace />
            } />
            <Route path="/gap-analysis/frameworks" element={
              <Layout>
                <ProtectedRoute moduleName="gap-analysis" fallbackToRoleCheck={false}>
                  <GapAnalysisFrameworks />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/gap-analysis/framework/:frameworkId" element={
              <Layout>
                <ProtectedRoute moduleName="gap-analysis" fallbackToRoleCheck={false}>
                  <GapAnalysisFrameworkDetail />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/gap-analysis/avaliacao-aderencia" element={<Navigate to="/gap-analysis/frameworks" replace />} />
            <Route path="/governanca" element={
              <Layout>
                <ProtectedRoute moduleName="controles" fallbackToRoleCheck={false}>
                  <Governanca />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/sistemas" element={
              <Layout>
                <ProtectedRoute moduleName="controles" fallbackToRoleCheck={false}>
                  <Sistemas />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/controles" element={<Navigate to="/governanca?tab=controles" replace />} />
            <Route path="/auditorias" element={<Navigate to="/governanca?tab=auditorias" replace />} />
            <Route path="/contratos" element={
              <Layout>
                <ProtectedRoute moduleName="contratos" fallbackToRoleCheck={false}>
                  <Contratos />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/documentos" element={
              <Layout>
                <ProtectedRoute moduleName="documentos" fallbackToRoleCheck={false}>
                  <Documentos />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/contas-privilegiadas" element={
              <Layout>
                <ProtectedRoute moduleName="contas-privilegiadas" fallbackToRoleCheck={false}>
                  <ContasPrivilegiadas />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/incidentes" element={
              <Layout>
                <ProtectedRoute moduleName="incidentes" fallbackToRoleCheck={false}>
                  <Incidentes />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/privacidade" element={
              <Layout>
                <ProtectedRoute moduleName="dados" fallbackToRoleCheck={false}>
                  <Privacidade />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/dados" element={<Navigate to="/privacidade" replace />} />
            <Route path="/due-diligence" element={
              <Layout>
                <ProtectedRoute moduleName="due-diligence" fallbackToRoleCheck={false}>
                  <DueDiligence />
                </ProtectedRoute>
              </Layout>
            } />
            <Route path="/revisao-acessos" element={
              <Layout>
                <ProtectedRoute moduleName="contas-privilegiadas" fallbackToRoleCheck={false}>
                  <RevisaoAcessos />
                </ProtectedRoute>
              </Layout>
            } />
            {/* `/denuncia` é dual: público (landing) ou autenticado (módulo). */}
            <Route path="/denuncia" element={
              <Suspense fallback={<RouteFallback />}>
                <DenunciaRouter />
              </Suspense>
            } />
            <Route path="/configuracoes" element={
              <Layout>
                <ProtectedRoute moduleName="configuracoes" fallbackToRoleCheck={false}>
                  <Configuracoes />
                </ProtectedRoute>
              </Layout>
            } />
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
