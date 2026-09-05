import { useAuth } from '@/components/AuthProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

import { ModuleLoadingSkeleton } from '@/components/ui/module-loading-skeleton';
import { useEffect, useState } from 'react';
const Configuracoes = () => {
  const { t } = useLanguage();
  const { profile, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'usuarios';
  const selectedUserId = searchParams.get('userId') || undefined;

  const userRole = profile?.role || 'user';
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || isSuperAdmin;
  const customerTabs = ['usuarios', 'organizacao', 'integracoes', 'denuncia', 'assinatura'];
  const platformTabs = ['empresas', 'planos', 'financeiro-ia', 'novidades', 'noticias', 'traducoes', 'blog'];
  const allowedTabs = isSuperAdmin
    ? [...customerTabs, ...platformTabs]
    : isAdmin
      ? customerTabs
      : ['usuarios', 'assinatura'];
  const defaultTab = allowedTabs.includes(requestedTab) ? requestedTab : 'usuarios';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => setActiveTab(defaultTab), [defaultTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <ModuleLoadingSkeleton showTable={false} />
          <p className="text-muted-foreground">{t('configGeral.page.loading')}</p>
        </div>
      </div>
    );
  }

  const navTriggerClass = 'min-h-10 w-full justify-start gap-2 rounded-md px-3 text-left data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:hidden';
  const tabLabels: Record<string, string> = {
    usuarios: t('configGeral.page.tabUsuarios'),
    organizacao: t('configGeral.page.tabOrganizacao'),
    integracoes: t('configGeral.page.tabIntegracoes'),
    denuncia: t('configGeral.page.tabDenuncia'),
    assinatura: t('configGeral.page.tabAssinatura'),
    empresas: t('configGeral.page.tabEmpresas'),
    planos: t('configGeral.page.tabPlanos'),
    'financeiro-ia': t('configGeral.page.tabFinanceiroIA'),
    novidades: t('configGeral.page.tabNovidades'),
    noticias: t('configGeral.page.tabNoticias'),
    traducoes: t('configGeral.page.tabTraducoes'),
    blog: t('configGeral.page.tabBlog'),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('configGeral.page.headerTitle')}
        description={t('configGeral.page.headerDescription')}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="grid gap-6 xl:grid-cols-[224px_minmax(0,1fr)] xl:items-start">
        <div className="rounded-lg border bg-card p-3 md:hidden">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t('configGeral.page.sectionPicker')}
          </label>
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full" aria-label={t('configGeral.page.sectionPicker')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedTabs.map((tab) => (
                <SelectItem key={tab} value={tab}>{tabLabels[tab]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <aside className="hidden gap-3 md:grid md:grid-cols-2 xl:sticky xl:top-0 xl:grid-cols-1" aria-label={t('configGeral.page.headerTitle')}>
          <section aria-labelledby="config-company-tabs" className="min-w-0 rounded-lg border bg-card p-3">
            <p id="config-company-tabs" className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('configGeral.page.groupCompany')}
            </p>
            <TabsList showIndicator={false} className="grid h-auto w-full grid-cols-2 gap-1 overflow-visible border-0 bg-transparent p-0 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-1">
              <TabsTrigger className={navTriggerClass} value="usuarios"><IconUsers />{t('configGeral.page.tabUsuarios')}</TabsTrigger>
              {isAdmin && <TabsTrigger className={navTriggerClass} value="organizacao"><IconOrg />{t('configGeral.page.tabOrganizacao')}</TabsTrigger>}
              {isAdmin && <TabsTrigger className={navTriggerClass} value="integracoes"><IconPlug />{t('configGeral.page.tabIntegracoes')}</TabsTrigger>}
              {isAdmin && <TabsTrigger className={navTriggerClass} value="denuncia"><IconMessage />{t('configGeral.page.tabDenuncia')}</TabsTrigger>}
              <TabsTrigger className={navTriggerClass} value="assinatura"><IconCard />{t('configGeral.page.tabAssinatura')}</TabsTrigger>
            </TabsList>
          </section>

          {isSuperAdmin && (
            <section aria-labelledby="config-platform-tabs" className="min-w-0 rounded-lg border bg-muted/20 p-3">
              <p id="config-platform-tabs" className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('configGeral.page.groupPlatform')}
              </p>
              <TabsList showIndicator={false} className="grid h-auto w-full grid-cols-2 gap-1 overflow-visible border-0 bg-transparent p-0 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-1">
                <TabsTrigger className={navTriggerClass} value="empresas"><IconOrg />{t('configGeral.page.tabEmpresas')}</TabsTrigger>
                <TabsTrigger className={navTriggerClass} value="planos"><IconPackage />{t('configGeral.page.tabPlanos')}</TabsTrigger>
                <TabsTrigger className={navTriggerClass} value="financeiro-ia"><IconMoney />{t('configGeral.page.tabFinanceiroIA')}</TabsTrigger>
                <TabsTrigger className={navTriggerClass} value="novidades"><IconMegaphone />{t('configGeral.page.tabNovidades')}</TabsTrigger>
                <TabsTrigger className={navTriggerClass} value="noticias"><IconFileText />{t('configGeral.page.tabNoticias')}</TabsTrigger>
                <TabsTrigger className={navTriggerClass} value="traducoes"><IconGlobe />{t('configGeral.page.tabTraducoes')}</TabsTrigger>
                <TabsTrigger className={navTriggerClass} value="blog"><IconBook />{t('configGeral.page.tabBlog')}</TabsTrigger>
              </TabsList>
            </section>
          )}
        </aside>

        <div className="min-w-0">

        {isSuperAdmin && (
          <TabsContent value="empresas">
            <GerenciamentoEmpresas />
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
        </div>
      </Tabs>
    </div>
  );
};

export default Configuracoes;
