import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GerenciamentoEmpresas from '@/components/configuracoes/GerenciamentoEmpresas';
import { GerenciamentoPlanos } from '@/components/configuracoes/GerenciamentoPlanos';
import { CreditosIAManager } from '@/components/configuracoes/CreditosIAManager';
import { FinanceiroIATab } from '@/components/configuracoes/FinanceiroIATab';
import GerenciamentoChangelog from '@/components/configuracoes/GerenciamentoChangelog';
import NoticiasTab from '@/components/configuracoes/NoticiasTab';
import { TraducaoFrameworksTab } from '@/components/configuracoes/TraducaoFrameworksTab';
import BlogManager from '@/components/configuracoes/BlogManager';
import { ContactRequests } from '@/components/configuracoes/ContactRequests';

/** Área exclusiva da equipe Akuris (super-admin), separada das Configurações do cliente. */
export const ADMIN_AKURIS_TABS = ['empresas', 'planos', 'creditos-ia', 'financeiro-ia', 'novidades', 'noticias', 'traducoes', 'blog', 'solicitacoes-site'] as const;

export default function AdminAkuris() {
  const { t } = useLanguage();
  const { profile, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  if (loading) return null;
  if (profile?.role !== 'super_admin') return <Navigate to="/configuracoes" replace />;
  const raw = params.get('tab');
  const tab = raw && (ADMIN_AKURIS_TABS as readonly string[]).includes(raw) ? raw : 'empresas';
  const label: Record<string, string> = {
    empresas: t('configGeral.page.tabEmpresas'),
    planos: t('configGeral.page.tabPlanos'),
    'creditos-ia': t('adminAkuris.creditos'),
    'financeiro-ia': t('configGeral.page.tabFinanceiroIA'),
    novidades: t('configGeral.page.tabNovidades'),
    noticias: t('configGeral.page.tabNoticias'),
    traducoes: t('configGeral.page.tabTraducoes'),
    blog: t('configGeral.page.tabBlog'),
    'solicitacoes-site': t('site.leads'),
  };
  return (
    <div className="space-y-6">
      <PageHeader title={t('adminAkuris.title')} description={t('adminAkuris.description')} />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          {ADMIN_AKURIS_TABS.map((id) => <TabsTrigger key={id} value={id}>{label[id]}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="empresas"><GerenciamentoEmpresas /></TabsContent>
        <TabsContent value="planos"><GerenciamentoPlanos /></TabsContent>
        <TabsContent value="creditos-ia"><CreditosIAManager /></TabsContent>
        <TabsContent value="financeiro-ia"><FinanceiroIATab /></TabsContent>
        <TabsContent value="novidades"><GerenciamentoChangelog /></TabsContent>
        <TabsContent value="noticias"><NoticiasTab /></TabsContent>
        <TabsContent value="traducoes"><TraducaoFrameworksTab /></TabsContent>
        <TabsContent value="blog"><BlogManager /></TabsContent>
        <TabsContent value="solicitacoes-site"><ContactRequests /></TabsContent>
      </Tabs>
    </div>
  );
}
