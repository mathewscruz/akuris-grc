import React from 'react';
import { IconWarning, IconLock } from '@/components/icons';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { decidirAcesso, chaveDePlano, SEMPRE_PERMITIDOS } from '@/lib/autorizacao';
import { useRotaInicial } from '@/hooks/useRotaInicial';
interface ProtectedRouteProps {
  children: React.ReactNode;
  moduleName: string;
  action?: 'access' | 'create' | 'read' | 'update' | 'delete';
  fallbackToRoleCheck?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  moduleName,
  action = 'access',
  fallbackToRoleCheck = true,
}) => {
  const { profile } = useAuth();
  const { permissions, modulosDoPlano, loading } = usePermissions();
  const { t } = useLanguage();
  const navigate = useNavigate();
  /* O botão de saída não pode apontar para um módulo que esta empresa não
     comprou — daria um ciclo de "acesso negado" a apontar para si próprio. */
  const { rota: rotaInicial } = useRotaInicial();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <AkurisPulse size={32} />
      </div>
    );
  }

  // A decisao vive em `lib/autorizacao` para poder ser testada, e porque a
  // regra mudou: havendo registo de permissao para o modulo, e ele que decide.
  // Antes era `hasPermission() || hasRoleAccess()`, e o `||` fazia o papel
  // reconceder o que o administrador tinha revogado explicitamente.
  const allowed = decidirAcesso({
    papel: profile?.role,
    modulo: moduleName,
    acao: action,
    permissao: permissions.find((p) => p.module_name === moduleName),
    usarPapelComoReserva: fallbackToRoleCheck,
    /* O teto do plano da empresa. Sem isto, digitar a URL de um módulo não
       comprado continuava a entrar — o recorte seria só de menu. */
    modulosDoPlano,
  });

  /*
    Negado por permissão e negado por plano não são a mesma coisa.

    «Entre em contacto com o administrador» é conselho útil quando falta uma
    permissão — e conselho inútil quando o módulo não foi comprado: o
    administrador da empresa não consegue conceder o que não está no plano.
  */
  const foraDoPlano =
    modulosDoPlano !== null &&
    !SEMPRE_PERMITIDOS.has(moduleName) &&
    !modulosDoPlano.includes(chaveDePlano(moduleName));

  if (!allowed) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <IconLock className="mx-auto h-8 w-8 text-destructive" />
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {t(foraDoPlano ? 'protectedRoute.planTitle' : 'protectedRoute.deniedTitle')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(foraDoPlano ? 'protectedRoute.planBody' : 'protectedRoute.deniedBody')}
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg">
                <IconWarning className="h-4 w-4 text-warning" />
                <p className="text-sm text-warning dark:text-warning">
                  {t(foraDoPlano ? 'protectedRoute.planHint' : 'protectedRoute.deniedHint')}
                </p>
              </div>

              <Button 
                variant="outline" 
                onClick={() => navigate(rotaInicial)}
                className="w-full"
              >
                {t('protectedRoute.backToDashboard')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};