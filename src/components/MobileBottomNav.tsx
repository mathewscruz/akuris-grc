import { NavLink, useLocation } from 'react-router-dom';
import { IconMore } from '@/components/icons';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { getMenuSections } from '@/lib/navigation';
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

  // Mesma organização do menu lateral: um bloco por grupo.
  const moreSections = getMenuSections(t)
    .flatMap((section) => section.items)
    .filter((item) => item.url !== '/dashboard')
    .map((item) => ({
      title: item.subItems ? item.title : null,
      items: (item.subItems ?? [item as MobileNavItem]).filter(visible) as MobileNavItem[],
    }))
    .filter((g) => g.items.length > 0);
  const otherItems = moreSections.filter((g) => !g.title).flatMap((g) => g.items);
  const groupedSections = [
    ...moreSections.filter((g) => g.title),
    { title: t('sidebar.sectionInsights'), items: [...otherItems, { title: t('sidebar.settings'), url: '/configuracoes', icon: MODULE_ICON['/configuracoes'] }] },
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
              <div className="mt-4 space-y-4 pb-4">
                {groupedSections.map((group) => (
                  <section key={group.title ?? 'outros'}>
                    <p className="mb-2 px-1 text-micro font-semibold uppercase tracking-[0.08em] text-muted-foreground">{group.title}</p>
                    <div className="grid grid-cols-3 gap-3">
                      {group.items.map(item => (
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
                  </section>
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
