import { NavLink, useLocation } from 'react-router-dom';
import { IconMore } from '@/components/icons';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { MODULE_ICON } from '@/lib/module-icons';
import { usePermissions } from '@/hooks/usePermissions';

type MobileNavItem = {
  title: string;
  url: string;
  icon: (typeof MODULE_ICON)[string];
  moduleName?: string;
};

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { t } = useLanguage();
  const { canAccess } = usePermissions();

  if (!isMobile) return null;

  // Ativos possui destinos irmãos no mesmo menu; a rota raiz não deve ficar
  // destacada ao mesmo tempo que Licenças ou Chaves.
  const isActive = (url: string) => location.pathname === url
    || (url !== '/ativos' && location.pathname.startsWith(url + '/'));

  const visible = (item: MobileNavItem) => !item.moduleName || canAccess(item.moduleName);

  const mainNavItems: MobileNavItem[] = [
    { title: t('sidebar.dashboard'), url: '/dashboard', icon: MODULE_ICON['/dashboard'], moduleName: 'dashboard' },
    { title: t('sidebar.risks'), url: '/riscos', icon: MODULE_ICON['/riscos'], moduleName: 'riscos' },
    { title: t('sidebar.internalControls'), url: '/governanca', icon: MODULE_ICON['/governanca'], moduleName: 'controles' },
    { title: t('sidebar.documents'), url: '/documentos', icon: MODULE_ICON['/documentos'], moduleName: 'documentos' },
  ].filter(visible);

  const moreNavItems: MobileNavItem[] = [
    { title: t('sidebar.actionPlans'), url: '/planos-acao', icon: MODULE_ICON['/planos-acao'], moduleName: 'planos-acao' },
    { title: t('sidebar.projects'), url: '/projetos', icon: MODULE_ICON['/projetos'], moduleName: 'projetos' },
    { title: t('sidebar.contracts'), url: '/contratos', icon: MODULE_ICON['/contratos'], moduleName: 'contratos' },
    { title: t('sidebar.assets'), url: '/ativos', icon: MODULE_ICON['/ativos'], moduleName: 'ativos' },
    { title: t('sidebar.licenses'), url: '/ativos/licencas', icon: MODULE_ICON['/ativos/licencas'], moduleName: 'ativos' },
    { title: t('sidebar.keys'), url: '/ativos/chaves', icon: MODULE_ICON['/ativos/chaves'], moduleName: 'ativos' },
    { title: t('sidebar.gapAnalysis'), url: '/gap-analysis/frameworks', icon: MODULE_ICON['/gap-analysis'], moduleName: 'gap-analysis' },
    { title: t('sidebar.systems'), url: '/sistemas', icon: MODULE_ICON['/sistemas'], moduleName: 'controles' },
    { title: t('sidebar.privilegedAccounts'), url: '/contas-privilegiadas', icon: MODULE_ICON['/contas-privilegiadas'], moduleName: 'contas-privilegiadas' },
    { title: t('sidebar.accessReview'), url: '/revisao-acessos', icon: MODULE_ICON['/revisao-acessos'], moduleName: 'contas-privilegiadas' },
    { title: t('sidebar.incidents'), url: '/incidentes', icon: MODULE_ICON['/incidentes'], moduleName: 'incidentes' },
    { title: t('sidebar.privacy'), url: '/privacidade', icon: MODULE_ICON['/privacidade'], moduleName: 'dados' },
    { title: t('sidebar.dueDiligence'), url: '/due-diligence', icon: MODULE_ICON['/due-diligence'], moduleName: 'due-diligence' },
    { title: t('sidebar.whistleblowing'), url: '/denuncia', icon: MODULE_ICON['/denuncia'], moduleName: 'denuncia' },
    { title: t('sidebar.businessContinuity'), url: '/continuidade', icon: MODULE_ICON['/continuidade'], moduleName: 'continuidade' },
    { title: t('sidebar.reports'), url: '/relatorios', icon: MODULE_ICON['/relatorios'], moduleName: 'relatorios' },
    { title: t('sidebar.settings'), url: '/configuracoes', icon: MODULE_ICON['/configuracoes'] },
  ].filter(visible);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-14 px-1">
          {mainNavItems.map(item => (
            <NavLink
              key={item.url}
              to={item.url}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            >
              <item.icon className={`h-5 w-5 transition-colors ${isActive(item.url) ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-micro font-medium ${isActive(item.url) ? 'text-primary' : 'text-muted-foreground'}`}>
                {item.title}
              </span>
            </NavLink>
          ))}
          
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
                aria-label={t('notifications.moreModules')}
              >
                <IconMore className="h-5 w-5 text-muted-foreground" />
                <span className="text-micro font-medium text-muted-foreground">{t('notifications.more')}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[82dvh] overflow-y-auto pb-safe">
              <SheetHeader>
                <SheetTitle>{t('notifications.moreModules')}</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 mt-4 pb-4">
                {moreNavItems.map(item => (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-colors ${
                      isActive(item.url) ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground'
                    }`}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-xs font-medium text-center">{item.title}</span>
                  </NavLink>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
      <div className="h-14 md:hidden" />
    </>
  );
}
