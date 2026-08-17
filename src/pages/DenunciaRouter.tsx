import React from 'react';
import { useAuth } from '@/components/AuthProvider';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteFallback } from '@/components/ui/route-fallback';

const DenunciaPublicLanding = React.lazy(() => import('@/pages/DenunciaPublicLanding'));
const Denuncia = React.lazy(() => import('@/pages/Denuncia'));

/** Detecta sessão persistida para decidir o esqueleto certo antes do auth resolver. */
function hasStoredSession(): boolean {
  try {
    return Object.keys(window.localStorage).some(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    );
  } catch {
    return false;
  }
}

/**
 * Switcher de `/denuncia`:
 * - Usuário NÃO autenticado → landing pública pedindo o slug da empresa.
 * - Usuário autenticado → módulo interno de gestão de denúncias.
 *
 * O caminho autenticado monta o Layout imediatamente (mesmo durante o loading da
 * sessão), para que o carregamento seja idêntico ao dos demais módulos — sidebar
 * e header preservados, apenas o conteúdo em Suspense interno do Layout.
 */
const DenunciaRouter: React.FC = () => {
  const { user, loading } = useAuth();

  const authenticatedShell = (
    <Layout>
      <ProtectedRoute moduleName="denuncia" fallbackToRoleCheck={false}>
        <Denuncia />
      </ProtectedRoute>
    </Layout>
  );

  if (loading) {
    return hasStoredSession() ? authenticatedShell : <RouteFallback />;
  }

  if (!user) {
    return (
      <React.Suspense fallback={<RouteFallback />}>
        <DenunciaPublicLanding />
      </React.Suspense>
    );
  }

  return authenticatedShell;
};

export default DenunciaRouter;
