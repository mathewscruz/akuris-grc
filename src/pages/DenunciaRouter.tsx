import React, { Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AkurisPulse } from '@/components/ui/AkurisPulse';

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <AkurisPulse size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <AkurisPulse size={48} />
          </div>
        }
      >
        <DenunciaPublicLanding />
      </Suspense>
    );
  }

  return (
    <Layout>
      <ProtectedRoute moduleName="denuncia" fallbackToRoleCheck={false}>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <AkurisPulse size={32} />
            </div>
          }
        >
          <Denuncia />
        </Suspense>
      </ProtectedRoute>
    </Layout>
  );
};

export default DenunciaRouter;
