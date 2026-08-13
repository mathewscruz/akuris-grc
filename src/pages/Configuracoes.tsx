import { useAuth } from '@/components/AuthProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Users, Building2, Plug, MessageSquare, CreditCard, Landmark, DollarSign, Package, Newspaper, BookOpen, Languages } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import GerenciamentoEmpresas from '@/components/configuracoes/GerenciamentoEmpresas';
import { IntegrationHub } from '@/components/configuracoes/IntegrationHub';
import { ConfiguracoesDenuncia } from '@/components/denuncia/ConfiguracoesDenuncia';
import { CategoriasDenuncia } from '@/components/denuncia/CategoriasDenuncia';
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

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          {isSuperAdmin && (
            <TabsTrigger value="empresas" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabEmpresas')}</span>
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="planos" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabPlanos')}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabUsuarios')}</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="organizacao" className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabOrganizacao')}</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="integracoes" className="flex items-center gap-2">
              <Plug className="h-4 w-4" />
              <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabIntegracoes')}</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="denuncia" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabDenuncia')}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="assinatura" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabAssinatura')}</span>
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="financeiro-ia" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabFinanceiroIA')}</span>
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="novidades" className="flex items-center gap-2">
              <AkurisAIIcon className="h-4 w-4" />
              <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabNovidades')}</span>
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="noticias" className="flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabNoticias')}</span>
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="traducoes" className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabTraducoes')}</span>
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="blog" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden min-[1800px]:inline">{t('configGeral.page.tabBlog')}</span>
            </TabsTrigger>
          )}
        </TabsList>

        {isSuperAdmin && (
          <TabsContent value="empresas">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
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
                  <Package className="h-5 w-5" />
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
                  <Plug className="h-5 w-5" />
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
                    <AkurisAIIcon className="h-5 w-5" />
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
                  <AkurisAIIcon className="h-5 w-5" />
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
                  <Newspaper className="h-5 w-5" />
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
                  <Languages className="h-5 w-5" />
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
                  <BookOpen className="h-5 w-5" />
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