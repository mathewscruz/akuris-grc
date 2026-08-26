import React from 'react';
import { IconWarning, IconLock } from '@/components/icons';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

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
  const { user, profile, refetchProfile } = useAuth();
  const { permissions, modulosDoPlano, loading, erroAoLer, refetchPermissions } = usePermissions();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  /*
    O terceiro caso, que faltava: NÃO SE SABE.

    Com o backend fora do ar, a leitura das permissões falha e devolve
    lista vazia; o perfil falha e fica `null`. As duas coisas juntas dão
    exactamente o mesmo resultado de uma permissão revogada — e o ecrã
    dizia «Você não tem permissão para acessar este módulo. Entre em
    contato com o administrador para solicitar acesso.»

    Medido: com o contentor do REST parado, um super admin em /ativos via
    esse texto. Num produto de GRC, «acesso negado» lê-se como incidente
    de autorização; a pessoa abre um pedido que ninguém pode atender,
    porque não há nada para conceder.

    A porta continua fechada — quem não sabe se pode, não passa. Muda o
    que se diz, e passa a haver um botão que resolve: tentar de novo.
  */
  const naoSeSabe = erroAoLer || (!!user && !profile);

  if (!allowed && naoSeSabe) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <IconWarning className="mx-auto h-8 w-8 text-warning" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{t('protectedRoute.indisponivelTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('protectedRoute.indisponivelBody')}</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg">
                <IconWarning className="h-4 w-4 text-warning" />
                <p className="text-sm text-warning dark:text-warning">{t('protectedRoute.indisponivelHint')}</p>
              </div>
              {/* Relê as TRÊS coisas que a queda derrubou.

                  Medido: com só `refetchPermissions()`, o botão devolvia
                  a página e todos os contadores ficavam a zero — porque
                  o perfil também tinha falhado, `empresa_id` continuava
                  indefinido, e cada consulta do módulo filtrava por um
                  inquilino que não existe. Recuperar meio caminho é
                  trocar um ecrã que mente por uma página que mente. */}
              <Button
                onClick={async () => {
                  await refetchProfile();
                  await refetchPermissions();
                  queryClient.invalidateQueries();
                }}
                className="w-full"
              >
                {t('protectedRoute.tentarNovamente')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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