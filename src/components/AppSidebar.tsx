import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconChevronDown, SaidaIcon } from '@/components/icons';
import logoMini from '@/assets/akuris-logo.png';
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
  const { state } = useSidebar();
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
  const itemH = isDense ? 'h-7' : isCompact ? 'h-8' : 'h-9';
  const iconSize = isDense ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const itemSpace = isDense ? 'space-y-0' : isCompact ? 'space-y-0.5' : 'space-y-1';
  const groupLabelCls = isDense
    ? 'text-xs font-semibold text-sidebar-foreground/40 px-3 mb-0'
    : isCompact
    ? 'text-xs font-semibold text-sidebar-foreground/40 px-3 mb-0.5'
    : 'text-xs font-semibold text-sidebar-foreground/40 px-3 mb-1';
  const contentPad = isCompact ? 'py-1' : 'py-2';
  const subWrapperCls = isDense ? 'space-y-0 mt-0.5 ml-4 pl-1.5' : 'space-y-1 mt-1 ml-6 pl-2';
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
    <Sidebar
      className="transition-ui duration-200 ease-out sidebar-gradient"
      collapsible="icon"
    >
      {/*
        O fio por baixo do logótipo tem de cair no MESMO y que o fio por baixo
        do cabeçalho, e não caía: os dois blocos têm a mesma altura (`h-14`),
        mas o painel de conteúdo flutua com `m-2` e uma borda de 1px, o que
        empurrava o cabeçalho ~8px para baixo. As duas linhas ficavam
        desencontradas na junção com a barra lateral.

        A margem de topo repete exactamente esse desvio — o espaçamento vem do
        `theme()`, para acompanhar a escala em vez de ser um número mágico.
      */}
      <SidebarHeader
        className={`mt-[calc(theme(spacing.2)+1px)] border-b border-sidebar-border ${isDense ? 'h-12' : 'h-14'} overflow-hidden`}
      >
        <div className="flex items-center justify-center px-1 py-2 h-full">
          <img 
            key={`sidebar-logo-${logoUpdateKey}-${Date.now()}`}
            src={getLogoSrc()} 
            alt={getLogoAlt()} 
            className={`object-contain transition-ui duration-200 ease-out ${
              isCollapsed ? 'h-10 w-10' : 'h-[52px] w-auto max-w-full'
            }`}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = logoMini;
            }}
          />
        </div>
      </SidebarHeader>

      <SidebarContent
        ref={contentRef as any}
        className={`relative ${contentPad} ${isCompact ? 'overflow-hidden gap-0' : ''} transition-ui duration-200 ease-out`}
      >
        <span
          aria-hidden="true"
          className="akuris-sidebar-indicator"
          style={{
            height: navIndicator.height,
            opacity: navIndicator.visible ? 1 : 0,
            transform: `translate3d(0, ${navIndicator.top}px, 0)`,
          }}
        />
        {getVisibleSections().map((section) => (
          <SidebarGroup key={section.id} className={isDense ? 'py-0' : isCompact ? 'py-1' : ''}>
            {!isCollapsed && (
              <SidebarGroupLabel className={groupLabelCls}>
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className={itemSpace}>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {item.subItems ? (
                      <Collapsible
                        open={openGroups.includes(item.title)}
                        onOpenChange={() => toggleGroup(item.title)}
                      >
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className={`w-full justify-between transition-colors duration-200 ${itemH} px-3 rounded-md group ${
                              hasActiveSubItem(item.subItems)
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-sidebar-accent/60'
                            }`}
                          >
                            <div className="flex items-center min-w-0">
                              <span className="relative flex-shrink-0 mr-3">
                                <item.icon
                                  className={`${iconSize} transition-colors duration-200 ${
                                    hasActiveSubItem(item.subItems) || openGroups.includes(item.title)
                                      ? 'text-primary'
                                      : ''
                                  }`}
                                />
                                {/* Dot indicator: filho ativo enquanto grupo está fechado */}
                                {hasActiveSubItem(item.subItems) && !openGroups.includes(item.title) && (
                                  <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                )}
                              </span>
                              {!isCollapsed && (
                                <span
                                  title={item.title}
                                  className={`text-sm font-medium transition-colors duration-200 truncate ${
                                    hasActiveSubItem(item.subItems)
                                      ? 'text-primary font-semibold'
                                      : openGroups.includes(item.title)
                                      ? 'text-primary'
                                      : ''
                                  }`}
                                >
                                  {item.title}
                                </span>
                              )}
                            </div>
                            {!isCollapsed && (
                              <IconChevronDown
                                className={`${iconSize} transition-transform duration-200 flex-shrink-0 ${
                                  openGroups.includes(item.title) ? 'rotate-180 text-primary' : ''
                                }`}
                              />
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        {!isCollapsed && (
                          <CollapsibleContent>
                            <div className={`${subWrapperCls} border-l-2 border-sidebar-border/30`}>
                              {item.subItems.map((subItem, idx) => {
                                const active = isActive(subItem.url);
                                return (
                                  <SidebarMenuButton
                                    key={subItem.title}
                                    asChild
                                    isActive={active}
                                    className={`transition-colors duration-200 ${itemH} animate-fade-in opacity-0 [animation-fill-mode:forwards] data-[active=true]:bg-transparent`}
                                    style={{ animationDelay: `${idx * 30}ms`, animationDuration: '220ms' }}
                                  >
                                    <NavLink
                                      to={subItem.url}
                                      end
                                      onMouseEnter={() => prefetchRoute(subItem.url)}
                                      className={`akuris-nav-link flex items-center w-full min-w-0 px-3 rounded-md ${
                                        active
                                          ? '!bg-primary !text-primary-foreground font-semibold shadow-sm hover:!bg-primary'
                                          : 'hover:bg-sidebar-accent/60 text-sidebar-foreground'
                                      }`}
                                    >
                                      <subItem.icon
                                        strokeWidth={1.5}
                                        className={`${iconSize} mr-3 flex-shrink-0 transition-colors duration-200 ${
                                          active ? '!text-primary-foreground' : ''
                                        }`}
                                      />
                                      <span title={subItem.title} className={`text-sm truncate ${active ? '!text-primary-foreground' : ''}`}>{subItem.title}</span>
                                    </NavLink>
                                  </SidebarMenuButton>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    ) : (
                      (() => {
                        const active = isActive(item.url!);
                        return (
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            className={`transition-colors duration-200 ${itemH} min-w-0 px-2.5 data-[active=true]:bg-transparent`}
                          >
                            <NavLink
                              to={item.url!}
                              end
                              onClick={handleNavClick}
                              onMouseEnter={() => prefetchRoute(item.url!)}
                              className={`akuris-nav-link flex items-center w-full min-w-0 px-3 rounded-md ${
                                active
                                  ? '!bg-primary !text-primary-foreground font-semibold shadow-sm hover:!bg-primary'
                                  : 'hover:bg-sidebar-accent/60 text-sidebar-foreground'
                              }`}
                            >
                              <div className="flex items-center min-w-0">
                                <item.icon
                                  className={`${iconSize} mr-3 flex-shrink-0 transition-colors duration-200 ${
                                    active ? '!text-primary-foreground' : ''
                                  }`}
                                />
                                {!isCollapsed && (
                                  <span
                                    title={item.title}
                                    className={`text-sm font-medium transition-colors duration-200 truncate ${
                                      active ? '!text-primary-foreground font-semibold' : ''
                                    }`}
                                  >
                                    {item.title}
                                  </span>
                                )}
                              </div>
                            </NavLink>
                          </SidebarMenuButton>
                        );
                      })()
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup className={`mt-auto ${isDense ? 'py-0 border-t border-sidebar-border/30 pt-1' : isCompact ? 'py-1' : ''}`}>
          <SidebarGroupContent>
            <SidebarMenu className={itemSpace}>
              {canAccess('configuracoes') && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/configuracoes')} className={`transition-colors duration-200 ${itemH} data-[active=true]:bg-transparent`}>
                    <NavLink
                      to="/configuracoes"
                      onClick={handleNavClick}
                      className={`akuris-nav-link flex items-center w-full px-3 ${getNavCls({ isActive: isActive('/configuracoes') })}`}
                    >
                      <ConfiguracoesNavIcon
                        className={`${iconSize} mr-3 flex-shrink-0 transition-colors duration-200 ${
                          isActive('/configuracoes') ? '!text-primary-foreground' : ''
                        }`}
                      />
                      {!isCollapsed && (
                        <span
                          className={`text-sm font-medium transition-colors duration-200 truncate ${
                            isActive('/configuracoes') ? '!text-primary-foreground font-semibold' : ''
                          }`}
                        >
                          {t('sidebar.settings')}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={`border-t border-sidebar-border ${isDense ? 'p-2' : 'p-3'}`}>
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            aria-expanded={showLogoutConfirm}
            className={`w-full text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors duration-200 ${itemH} px-3 ${
              isCollapsed ? 'justify-center' : 'justify-start'
            } ${showLogoutConfirm || isSigningOut ? '!bg-primary !text-primary-foreground hover:!bg-primary' : ''}`}
          >
            <SaidaIcon className={`${iconSize} flex-shrink-0 ${!isCollapsed ? 'mr-3' : ''}`} />
            {!isCollapsed && (
              <span className="text-sm font-medium truncate">
                {t('sidebar.logout')}
              </span>
            )}
          </Button>
        </div>
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
