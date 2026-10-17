import { useAuth } from '@/components/AuthProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { IconUsers, IconOrg, IconPlug, IconMessage, IconCard, IconMoney, IconPackage, IconBook, IconGlobe, IconFileText, IconMegaphone, IconChevronLeft } from '@/components/icons';
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
import { QuestionarioSegurancaCard } from '@/components/configuracoes/QuestionarioSegurancaCard';
import { TrustCenterTab } from '@/components/configuracoes/TrustCenterTab';
import { ContactRequests } from '@/components/configuracoes/ContactRequests';

import { ModuleLoadingSkeleton } from '@/components/ui/module-loading-skeleton';
import { ConfiguracoesVisaoGeral, type SecaoConfig } from '@/components/configuracoes/ConfiguracoesVisaoGeral';
const Configuracoes = () => {
  const { t } = useLanguage();
  const { profile, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const selectedUserId = searchParams.get('userId') || undefined;

  const userRole = profile?.role || 'user';
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || isSuperAdmin;

  const secoes: SecaoConfig[] = [
    { id: 'usuarios', grupo: 'conta', titulo: t('configGeral.page.tabUsuarios'), icon: IconUsers, palavras: 'mfa permissao perfil convite acesso senha' },
    ...(isAdmin ? [{ id: 'organizacao', grupo: 'conta' as const, titulo: t('configGeral.page.tabOrganizacao'), icon: IconOrg, palavras: 'logo empresa cnpj endereco slug contexto' }] : []),
    { id: 'assinatura', grupo: 'conta', titulo: t('configGeral.page.tabAssinatura'), icon: IconCard, palavras: 'plano creditos ia fatura' },
    ...(isAdmin ? [
      { id: 'integracoes', grupo: 'plataforma' as const, titulo: t('configGeral.page.tabIntegracoes'), icon: IconPlug, palavras: 'aws intune azure api webhook' },
      { id: 'denuncia', grupo: 'plataforma' as const, titulo: t('configGeral.page.tabDenuncia'), icon: IconMessage, palavras: 'whistleblowing etica comite canal' },
      { id: 'trust-center', grupo: 'plataforma' as const, titulo: t('trustCenter.tab'), icon: IconGlobe, palavras: 'questionario seguranca publico' },
    ] : []),
    ...(isSuperAdmin ? [
      { id: 'empresas', grupo: 'admin' as const, titulo: t('configGeral.page.tabEmpresas'), icon: IconOrg },
      { id: 'planos', grupo: 'admin' as const, titulo: t('configGeral.page.tabPlanos'), icon: IconPackage },
      { id: 'financeiro-ia', grupo: 'admin' as const, titulo: t('configGeral.page.tabFinanceiroIA'), icon: IconMoney },
      { id: 'novidades', grupo: 'admin' as const, titulo: t('configGeral.page.tabNovidades'), icon: IconMegaphone },
      { id: 'noticias', grupo: 'admin' as const, titulo: t('configGeral.page.tabNoticias'), icon: IconFileText },
      { id: 'traducoes', grupo: 'admin' as const, titulo: t('configGeral.page.tabTraducoes'), icon: IconGlobe },
      { id: 'blog', grupo: 'admin' as const, titulo: t('configGeral.page.tabBlog'), icon: IconBook },
      { id: 'solicitacoes-site', grupo: 'admin' as const, titulo: t('site.leads'), icon: IconMessage },
    ] : []),
  ];
  const allowedTabs = secoes.map((s) => s.id);
  const activeTab = rawTab && allowedTabs.includes(rawTab) ? rawTab : null;

  const selectSection = (tab: string | null) => {
    if (tab && !allowedTabs.includes(tab)) return;
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      if (tab) next.set('tab', tab); else next.delete('tab');
      next.delete('userId');
      return next;
    });
  };

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

  if (!activeTab) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('configGeral.page.headerTitle')} description={t('configGeral.page.headerDescription')} />
        <ConfiguracoesVisaoGeral empresaId={profile?.empresa_id || ''} secoes={secoes} isAdmin={isAdmin} onOpen={selectSection} />
      </div>
    );
  }

  const atual = secoes.find((s) => s.id === activeTab)!;
  const AtualIcon = atual.icon;
  const navTriggerClass = 'min-h-9 w-full justify-start gap-2 rounded-md px-3 text-left text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:hidden';
  const grupos: SecaoConfig['grupo'][] = ['conta', 'plataforma', 'admin'];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <button type="button" onClick={() => selectSection(null)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <IconChevronLeft className="h-3.5 w-3.5" aria-hidden />{t('configVisao.voltar')}
        </button>
        <div className="flex items-start gap-3">
          <AtualIcon className="h-6 w-6 text-foreground/80 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground">{atual.titulo}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t(`configVisao.desc.${atual.id}`)}</p>
          </div>
        </div>
      </header>

      <Tabs orientation="vertical" value={activeTab} onValueChange={selectSection} className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start">
        <div className="xl:hidden">
          <Select value={activeTab} onValueChange={selectSection}>
            <SelectTrigger className="w-full sm:max-w-xs" aria-label={t('configGeral.page.sectionPicker')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {secoes.map((s) => <SelectItem key={s.id} value={s.id}>{s.titulo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <aside className="hidden xl:block xl:sticky xl:top-0 space-y-5" aria-label={t('configGeral.page.headerTitle')}>
          {grupos.map((g) => {
            const lista = secoes.filter((s) => s.grupo === g);
            if (!lista.length) return null;
            return (
              <section key={g}>
                <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(`configVisao.grupos.${g}`)}</p>
                <TabsList showIndicator={false} className="grid h-auto w-full grid-cols-1 gap-0.5 overflow-visible border-0 bg-transparent p-0">
                  {lista.map((s) => {
                    const I = s.icon;
                    return <TabsTrigger key={s.id} className={navTriggerClass} value={s.id}><I className="h-4 w-4" />{s.titulo}</TabsTrigger>;
                  })}
                </TabsList>
              </section>
            );
          })}
        </aside>

        <div className="min-w-0">
        {isSuperAdmin && <TabsContent value="solicitacoes-site"><ContactRequests /></TabsContent>}

        {isSuperAdmin && (
          <TabsContent value="empresas">
            <GerenciamentoEmpresas />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="planos">
            <GerenciamentoPlanos />
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
            <IntegrationHub />
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

        {isAdmin && <TabsContent value="trust-center"><div className="space-y-6"><TrustCenterTab /><QuestionarioSegurancaCard /></div></TabsContent>}

        <TabsContent value="assinatura">
          <div className="space-y-6">
            <AssinaturaTab />
            {isSuperAdmin && (
              <CreditosIAManager />
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
            <GerenciamentoChangelog />
          </TabsContent>
        )}
        {isSuperAdmin && (
          <TabsContent value="noticias">
            <NoticiasTab />
          </TabsContent>
        )}
        {isSuperAdmin && (
          <TabsContent value="traducoes">
            <TraducaoFrameworksTab />
          </TabsContent>
        )}
        {isSuperAdmin && (
          <TabsContent value="blog">
            <BlogManager />
          </TabsContent>
        )}
        </div>
      </Tabs>
    </div>
  );
};

export default Configuracoes;
