import { NavLink, useLocation } from 'react-router-dom';
import { IconMore } from '@/components/icons';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { MODULE_ICON } from '@/lib/module-icons';

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { t } = useLanguage();

  if (!isMobile) return null;

  const isActive = (url: string) => location.pathname === url || location.pathname.startsWith(url + '/');

  const mainNavItems = [
    { title: t('sidebar.dashboard'), url: '/dashboard', icon: MODULE_ICON['/dashboard'] },
    { title: t('sidebar.risks'), url: '/riscos', icon: MODULE_ICON['/riscos'] },
    { title: t('sidebar.internalControls'), url: '/governanca', icon: MODULE_ICON['/governanca'] },
    { title: t('sidebar.documents'), url: '/documentos', icon: MODULE_ICON['/documentos'] },
  ];

  const moreNavItems = [
    { title: t('sidebar.actionPlans'), url: '/planos-acao', icon: MODULE_ICON['/planos-acao'] },
    { title: t('sidebar.contracts'), url: '/contratos', icon: MODULE_ICON['/contratos'] },
    { title: t('sidebar.assets'), url: '/ativos', icon: MODULE_ICON['/ativos'] },
    { title: t('sidebar.gapAnalysis'), url: '/gap-analysis/frameworks', icon: MODULE_ICON['/gap-analysis'] },
    { title: t('sidebar.security'), url: '/contas-privilegiadas', icon: MODULE_ICON['/contas-privilegiadas'] },
    { title: t('sidebar.incidents'), url: '/incidentes', icon: MODULE_ICON['/incidentes'] },
    { title: t('sidebar.privacy'), url: '/privacidade', icon: MODULE_ICON['/privacidade'] },
    { title: t('sidebar.dueDiligence'), url: '/due-diligence', icon: MODULE_ICON['/due-diligence'] },
    { title: t('sidebar.compliance'), url: '/denuncia', icon: MODULE_ICON['/denuncia'] },
    
    { title: t('sidebar.reports'), url: '/relatorios', icon: MODULE_ICON['/relatorios'] },
    { title: t('sidebar.settings'), url: '/configuracoes', icon: MODULE_ICON['/configuracoes'] },
  ];

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
              <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full">
                <IconMore className="h-5 w-5 text-muted-foreground" />
                <span className="text-micro font-medium text-muted-foreground">{t('notifications.more')}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="pb-safe">
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
