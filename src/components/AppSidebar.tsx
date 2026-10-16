import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconChevronDown, SaidaIcon } from '@/components/icons';
import logoMini from '@/assets/akuris-logo.png';
import akurisMark from '@/assets/akuris-mark.png.asset.json';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { prefetchRoute } from '@/lib/route-prefetch';
import { useAutoFit } from '@/hooks/useSidebarFit';
import { MODULE_ICON } from '@/lib/module-icons';

import { getMenuSections } from '@/lib/navigation';

const ConfiguracoesNavIcon = MODULE_ICON['/configuracoes'];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { signOut, company, logoUpdateKey } = useAuth();
  const navigate = useNavigate();
  const { canAccess } = usePermissions();
  const { t } = useLanguage();
  const location = useLocation();
  const currentPath = location.pathname;
  const menuSections = getMenuSections(t);

  // All items flat (used for active-group lookup)
  const allItems = menuSections.flatMap((s) => s.items);

  // Function to get which group contains the active route
  const getActiveGroup = () => {
    for (const item of allItems) {
      if (item.subItems) {
        const hasActiveSubItem = item.subItems.some((subItem) => currentPath === subItem.url);
        if (hasActiveSubItem) {
          return item.title;
        }
      }
    }
    return null;
  };

  // Start with groups that contain active routes open
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLogoutOverlay, setShowLogoutOverlay] = useState(false);

  const isCollapsed = state === 'collapsed';
  const contentRef = useRef<HTMLDivElement>(null);
  const fit = useAutoFit(contentRef);
  const isCompact = fit !== 'comfortable';
  const isDense = fit === 'dense';
  /* Intervalo único entre itens: o mesmo em todo o menu, qualquer que seja
     o grupo. Só o "Sair" fica destacado, por viver no rodapé. */
  const itemGap = isDense ? 'gap-0' : isCompact ? 'gap-0.5' : 'gap-1';
  const [navIndicator, setNavIndicator] = useState({ top: 0, height: 0, visible: false });

  /* O marcador é um elemento único: quando muda o módulo, ele percorre a
     distância até ao novo item. Duas bordas independentes apenas piscariam
     (uma some, outra nasce) e não dariam continuidade à navegação. */
  React.useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const measure = () => {
      const active = content.querySelector<HTMLElement>('.akuris-nav-link[aria-current="page"]');
      if (!active) {
        setNavIndicator((current) => ({ ...current, visible: false }));
        return;
      }
      const contentRect = content.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const next = {
        top: activeRect.top - contentRect.top + content.scrollTop + activeRect.height * 0.22,
        height: activeRect.height * 0.56,
        visible: true,
      };
      setNavIndicator((current) =>
        Math.abs(current.top - next.top) < 0.5 &&
        Math.abs(current.height - next.height) < 0.5 &&
        current.visible
          ? current
          : next
      );
    };

    measure();
    const frame = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    const mo = new MutationObserver(measure);
    mo.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current', 'data-state'] });
    content.addEventListener('scroll', measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      content.removeEventListener('scroll', measure);
    };
  }, [currentPath, openGroups, isCollapsed, fit]);

  // Open group automatically when it contains the active route
  useEffect(() => {
    const activeGroup = getActiveGroup();
    if (activeGroup && !openGroups.includes(activeGroup)) {
      setOpenGroups([activeGroup]);
    }
  }, [currentPath]);

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups((prev) => {
      if (prev.includes(groupTitle)) {
        return prev.filter((title) => title !== groupTitle);
      }
      return [groupTitle];
    });
  };

  const isActive = (path: string) => currentPath === path;

  const closeMobile = () => { if (isMobile) setOpenMobile(false); };
  const railIcon = isDense ? 'h-4 w-4' : isCompact ? 'h-5 w-5' : 'h-[22px] w-[22px]';
  const labelCls = isMobile ? 'flex-1 text-left text-sm' : `w-full whitespace-normal break-normal hyphens-none text-center leading-tight ${isDense ? 'text-[10.5px]' : 'text-[11px]'}`;
  const railCls = (active: boolean) => isMobile
    ? `relative flex w-full min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50'}`
    :
    `relative flex w-full flex-col items-center justify-center ${isDense ? 'gap-0' : 'gap-1'} rounded-lg px-1 ${isDense ? 'py-0.5' : isCompact ? 'py-1.5' : 'py-2.5'} transition-colors duration-200 ${
      active
        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
        : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
    }`;

  const hasActiveSubItem = (subItems: any[]) => {
    return subItems.some((subItem) => currentPath === subItem.url);
  };

  // Função para fechar grupos ao navegar para item sem submenu
  const handleNavClick = () => {
    setOpenGroups([]);
  };

  // Active state em pílula (estilo Linear/Notion)
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? '!bg-primary !text-primary-foreground font-semibold rounded-md shadow-sm hover:!bg-primary'
      : 'hover:bg-sidebar-accent/60 text-sidebar-foreground rounded-md';

  const handleSignOut = () => {
    setShowLogoutConfirm(true);
  };

  const confirmSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    // Cobre a tela imediatamente — evita flash branco entre o dashboard e o /auth
    setShowLogoutOverlay(true);
    // Fecha o diálogo no mesmo frame para não competir com o overlay
    setShowLogoutConfirm(false);
    try {
      try {
        await signOut();
      } catch (err) {
        // Fallback: encerra apenas a sessão local se o servidor recusar (token expirado, etc.)
        logger.warn('signOut global falhou, tentando local', err);
        await supabase.auth.signOut({ scope: 'local' });
      }

      // Navegação SPA — sem hard reload, sem flash branco.
      // O overlay continua por cima até o /auth montar.
      navigate('/auth', { replace: true });
    } catch (error) {
      logger.error('Erro ao encerrar sessão', error);
      /* A reserva em português era código morto: a chave existe nas duas
         línguas, e se não existisse mostraria a frase em PT a quem tem a
         aplicação em EN. */
      toast.error(t('sidebar.signOutFailed'));
      setShowLogoutOverlay(false);
    } finally {
      setIsSigningOut(false);
    }
  };

  // Determina qual logo usar com cache busting melhorado
  const getLogoSrc = () => {
    if (company?.logo_url) {
      const hasTimestamp = company.logo_url.includes('?t=');
      return hasTimestamp ? company.logo_url : `${company.logo_url}?t=${Date.now()}`;
    }
    return logoMini;
  };

  const getLogoAlt = () => {
    return company?.nome || 'Akuris';
  };

  // Função para verificar se um item tem acesso
  const hasAccess = (item: any) => {
    if (!item.moduleName) return true;
    return canAccess(item.moduleName);
  };

  // Filtrar seções/itens do menu baseado nas permissões
  const getVisibleSections = () => {
    return menuSections
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => {
            if (item.subItems) {
              const visibleSubItems = item.subItems.filter(hasAccess);
              return visibleSubItems.length > 0;
            }
            return hasAccess(item);
          })
          .map((item) => {
            if (item.subItems) {
              return { ...item, subItems: item.subItems.filter(hasAccess) };
            }
            return item;
          }),
      }))
      .filter((section) => section.items.length > 0);
  };

  /* Todos os módulos partilham exactamente o mesmo ritmo vertical: uma única
     lista, sem divisórias entre grupos. A única separação mantida é a do
     "Sair", que continua no rodapé. */
  const menuItems = (() => {
    const items = getVisibleSections().flatMap((section) => section.items);
    if (canAccess('configuracoes')) {
      items.push({
        title: t('sidebar.settings'),
        url: '/configuracoes',
        icon: ConfiguracoesNavIcon,
        moduleName: 'configuracoes',
      });
    }
    return items;
  })();

  return (
    <>
    {showLogoutOverlay && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ backgroundColor: '#06060e' }}
        role="status"
        aria-live="polite"
        aria-label={t('residuos.geral.encerrandoSessao')}
      >
        <AkurisPulse size={80} />
      </div>
    )}
    <Sidebar className="sidebar-gradient" collapsible="offcanvas">
      <SidebarHeader className="mt-[calc(theme(spacing.2)+1px)] h-14 border-b border-sidebar-border p-0">
        <div className="flex h-full items-center justify-center">
          <img src={akurisMark.url} alt="Akuris" className={`${isDense ? 'h-8 w-8' : 'h-10 w-10'} rounded-xl object-contain`} />
        </div>
      </SidebarHeader>

      <SidebarContent ref={contentRef as any} className={`gap-0 px-2 ${isMobile ? 'overflow-y-auto py-3' : isDense ? 'overflow-y-auto [scrollbar-width:none] py-1' : 'overflow-hidden py-3'}`}>
        <ul className={`flex flex-col ${itemGap}`}>
          {menuItems.map((item) => {
                if (item.subItems) {
                  const active = hasActiveSubItem(item.subItems);
                  return (
                    <li key={item.title}>
                      {isMobile ? (
                        <Collapsible open={openGroups.includes(item.title)} onOpenChange={() => toggleGroup(item.title)}>
                          <CollapsibleTrigger asChild>
                            <button type="button" className={railCls(active)}>
                              <item.icon strokeWidth={1.5} className={`h-5 w-5 ${active ? 'text-primary' : ''}`} />
                              <span className={labelCls}>{item.title}</span>
                              <IconChevronDown className={`h-4 w-4 transition-transform ${openGroups.includes(item.title) ? 'rotate-180' : ''}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="ml-5 mt-1 space-y-1 border-l border-sidebar-border/40 pl-2">
                            {item.subItems.map((subItem) => (
                              <NavLink
                                key={subItem.title}
                                to={subItem.url}
                                end
                                onClick={closeMobile}
                                className={railCls(isActive(subItem.url))}
                              >
                                <subItem.icon strokeWidth={1.5} className="h-4 w-4 flex-shrink-0" />
                                <span className={labelCls}>{subItem.title}</span>
                              </NavLink>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      ) : (
                      <Popover
                        open={openGroups.includes(item.title)}
                        onOpenChange={(o) => setOpenGroups(o ? [item.title] : [])}
                      >
                        <PopoverTrigger asChild>
                          <button type="button" title={item.title} className={railCls(active)}>
                            {active && <span aria-hidden className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />}
                            <item.icon strokeWidth={1.5} className={`${railIcon} ${active ? 'text-primary' : ''}`} />
                            <span className={labelCls}>{isMobile ? item.title : (item.shortTitle ?? item.title)}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="right" align="start" sideOffset={10} className="w-60 p-1.5">
                          <p className="px-2.5 pb-1.5 pt-1 text-xs font-semibold text-muted-foreground">{item.title}</p>
                          {item.subItems.map((subItem) => {
                            const subActive = isActive(subItem.url);
                            return (
                              <NavLink
                                key={subItem.title}
                                to={subItem.url}
                                end
                                onMouseEnter={() => prefetchRoute(subItem.url)}
                                onClick={() => setOpenGroups([])}
                                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                                  subActive ? 'bg-primary/10 font-semibold text-primary' : 'text-foreground hover:bg-muted'
                                }`}
                              >
                                <subItem.icon strokeWidth={1.5} className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">{subItem.title}</span>
                              </NavLink>
                            );
                          })}
                        </PopoverContent>
                      </Popover>
                      )}
                    </li>
                  );
                }
                const active = isActive(item.url!);
                return (
                  <li key={item.title}>
                    <NavLink
                      to={item.url!}
                      end
                      title={item.title}
                      onClick={() => { handleNavClick(); closeMobile(); }}
                      onMouseEnter={() => prefetchRoute(item.url!)}
                      className={railCls(active)}
                    >
                      {active && <span aria-hidden className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />}
                      <item.icon strokeWidth={1.5} className={`${railIcon} ${active ? 'text-primary' : ''}`} />
                      <span className={labelCls}>{isMobile ? item.title : (item.shortTitle ?? item.title)}</span>
                    </NavLink>
                  </li>
                );
          })}
        </ul>
      </SidebarContent>

      <SidebarFooter className={`border-t border-sidebar-border ${isDense && !isMobile ? 'p-1' : 'p-2'} pb-[max(0.5rem,env(safe-area-inset-bottom))]`}>
        <button
          type="button"
          onClick={handleSignOut}
          aria-expanded={showLogoutConfirm}
          title={t('sidebar.logout')}
          className={railCls(showLogoutConfirm || isSigningOut)}
        >
          <SaidaIcon className={railIcon} />
          <span className={labelCls}>{t('sidebar.logout')}</span>
        </button>
      </SidebarFooter>

      <ConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={(o) => !isSigningOut && setShowLogoutConfirm(o)}
        title={t('sidebar.confirmLogout')}
        description={t('sidebar.confirmLogoutDesc')}
        confirmText={t('sidebar.logout')}
        cancelText={t('common.cancel')}
        variant="destructive"
        onConfirm={confirmSignOut}
        loading={isSigningOut}
      />
    </Sidebar>
    </>
  );
}
