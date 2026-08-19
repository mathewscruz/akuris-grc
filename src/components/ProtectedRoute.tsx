import React from 'react';
import { IconWarning, IconLock } from '@/components/icons';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { decidirAcesso } from '@/lib/autorizacao';
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
  const { permissions, loading } = usePermissions();
  const { t } = useLanguage();
  const navigate = useNavigate();

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
  });

  if (!allowed) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <IconLock className="mx-auto h-8 w-8 text-destructive" />
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{t('protectedRoute.deniedTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('protectedRoute.deniedBody')}
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg">
                <IconWarning className="h-4 w-4 text-warning" />
                <p className="text-sm text-warning dark:text-warning">
                  {t('protectedRoute.deniedHint')}
                </p>
              </div>

              <Button 
                variant="outline" 
                onClick={() => navigate('/dashboard')}
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