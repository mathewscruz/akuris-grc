import React, { Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteFallback } from '@/components/ui/route-fallback';

const DenunciaPublicLanding = React.lazy(() => import('@/pages/DenunciaPublicLanding'));
const Denuncia = React.lazy(() => import('@/pages/Denuncia'));

/**
 * Switcher de `/denuncia`:
 * - Usuário NÃO autenticado → landing pública pedindo o slug da empresa.
 * - Usuário autenticado → módulo interno de gestão de denúncias.
 *
 * Resolve o C1 do QA (acesso público a `/denuncia` caía em 404 / loop de auth).
 */
const DenunciaRouter: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteFallback />;
  }

  if (!user) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <DenunciaPublicLanding />
      </Suspense>
    );
  }

  return (
    <Layout>
      <ProtectedRoute moduleName="denuncia" fallbackToRoleCheck={false}>
        <Suspense fallback={<RouteFallback />}>
          <Denuncia />
        </Suspense>
      </ProtectedRoute>
    </Layout>
  );
};

export default DenunciaRouter;
