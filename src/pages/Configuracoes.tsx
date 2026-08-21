import { useAuth } from '@/components/AuthProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { IconUsers, IconOrg, IconPlug, IconMessage, IconCard, IconMoney, IconPackage, IconBook, IconGlobe, IconFileText, IconMegaphone, IconBolt } from '@/components/icons';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import GerenciamentoEmpresas from '@/components/configuracoes/GerenciamentoEmpresas';
import { IntegrationHub } from '@/components/configuracoes/IntegrationHub';
import { ConfiguracoesDenuncia } from '@/components/denuncia/ConfiguracoesDenuncia';
import { CategoriasDenuncia } from '@/components/denuncia/CategoriasDenuncia';
import { CanalMarcaEComite } from '@/components/denuncia/CanalMarcaEComite';
import { CanalConsultoria } from '@/components/denuncia/CanalConsultoria';
import { AssinaturaTab } from '@/components/configuracoes/AssinaturaTab';
import { CreditosIAManager } from '@/components/configuracoes/CreditosIAManager';
import { UsersAccessTab } from '@/components/configuracoes/UsersAccessTab';
import { OrganizacaoTab } from '@/components/configuracoes/OrganizacaoTab';
import { FinanceiroIATab } from '@/components/configuracoes/FinanceiroIATab';
import { GerenciamentoPlanos } from '@/components/configuracoes/GerenciamentoPlanos';
import GerenciamentoChangelog from '@/components/configuracoes/GerenciamentoChangelog';
import NoticiasTab from '@/components/configuracoes/NoticiasTab';
import BlogManager from '@/components/configuracoes/BlogManager';
import { TraducaoFrameworksTab } from '@/components/configuracoes/TraducaoFrameworksTab';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
const Configuracoes = () => {
  const { t } = useLanguage();
  const { profile, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'usuarios';
  const selectedUserId = searchParams.get('userId') || undefined;

  const userRole = profile?.role || 'user';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AkurisPulse size={48} className="mb-4" />
          <p className="text-muted-foreground">{t('configGeral.page.loading')}</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || isSuperAdmin;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('configGeral.page.headerTitle')}
        description={t('configGeral.page.headerDescription')}
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {isSuperAdmin && (
            <TabsTrigger value="empresas" className="flex items-center gap-2">
              <IconOrg className="h-4 w-4" />
              {t('configGeral.page.tabEmpresas')}
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="planos" className="flex items-center gap-2">
              <IconPackage className="h-4 w-4" />
              {t('configGeral.page.tabPlanos')}
            </TabsTrigger>
          )}
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <IconUsers className="h-4 w-4" />
            {t('configGeral.page.tabUsuarios')}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="organizacao" className="flex items-center gap-2">
              <IconOrg className="h-4 w-4" />
              {t('configGeral.page.tabOrganizacao')}
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="integracoes" className="flex items-center gap-2">
              <IconPlug className="h-4 w-4" />
              {t('configGeral.page.tabIntegracoes')}
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="denuncia" className="flex items-center gap-2">
              <IconMessage className="h-4 w-4" />
              {t('configGeral.page.tabDenuncia')}
            </TabsTrigger>
          )}
          <TabsTrigger value="assinatura" className="flex items-center gap-2">
            <IconCard className="h-4 w-4" />
            {t('configGeral.page.tabAssinatura')}
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="financeiro-ia" className="flex items-center gap-2">
              <IconMoney className="h-4 w-4" />
              {t('configGeral.page.tabFinanceiroIA')}
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="novidades" className="flex items-center gap-2">
              <IconMegaphone className="h-4 w-4" />
              {t('configGeral.page.tabNovidades')}
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="noticias" className="flex items-center gap-2">
              <IconFileText className="h-4 w-4" />
              {t('configGeral.page.tabNoticias')}
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="traducoes" className="flex items-center gap-2">
              <IconGlobe className="h-4 w-4" />
              {t('configGeral.page.tabTraducoes')}
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="blog" className="flex items-center gap-2">
              <IconBook className="h-4 w-4" />
              {t('configGeral.page.tabBlog')}
            </TabsTrigger>
          )}
        </TabsList>

        {isSuperAdmin && (
          <TabsContent value="empresas">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconOrg className="h-5 w-5" />
                  {t('configGeral.page.empresasCardTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GerenciamentoEmpresas />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="planos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconPackage className="h-5 w-5" />
                  {t('configGeral.page.planosCardTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GerenciamentoPlanos />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="usuarios">
          <UsersAccessTab 
            userRole={userRole} 
            isAdmin={isAdmin} 
            selectedUserId={selectedUserId} 
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="organizacao">
            <OrganizacaoTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="integracoes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconPlug className="h-5 w-5" />
                  {t('configGeral.page.integracoesCardTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <IntegrationHub />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="denuncia">
            <div className="space-y-6">
              <ConfiguracoesDenuncia />
              {/* Marca, prazos legais, QR e comité de ética: o que faz do
                  canal um produto que se revende. */}
              <CanalMarcaEComite />
              <CanalConsultoria />
              <CategoriasDenuncia />
            </div>
          </TabsContent>
        )}

        <TabsContent value="assinatura">
          <div className="space-y-6">
            <AssinaturaTab />
            {isSuperAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconBolt className="h-5 w-5" />
                    {t('configGeral.page.creditosIACardTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CreditosIAManager />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        {isSuperAdmin && (
          <TabsContent value="financeiro-ia">
            <FinanceiroIATab />
          </TabsContent>
        )}
        {isSuperAdmin && (
          <TabsContent value="novidades">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconMegaphone className="h-5 w-5" />
                  {t('configGeral.page.novidadesCardTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GerenciamentoChangelog />
              </CardContent>
            </Card>
          </TabsContent>
        )}
        {isSuperAdmin && (
          <TabsContent value="noticias">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconFileText className="h-5 w-5" />
                  {t('configGeral.page.noticiasCardTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NoticiasTab />
              </CardContent>
            </Card>
          </TabsContent>
        )}
        {isSuperAdmin && (
          <TabsContent value="traducoes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconGlobe className="h-5 w-5" />
                  {t('configGeral.page.traducoesCardTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TraducaoFrameworksTab />
              </CardContent>
            </Card>
          </TabsContent>
        )}
        {isSuperAdmin && (
          <TabsContent value="blog">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconBook className="h-5 w-5" />
                  {t('configGeral.page.blogCardTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BlogManager />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Configuracoes;