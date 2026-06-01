import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { 
  Shield, 
  AlertTriangle, 
  FileCheck, 
  Lock, 
  Settings,
  ChevronDown,
  Database,
  FileText,
  Handshake,
  BookOpen,
  AlertCircle,
  HardDrive,
  MessageSquare,
  
  LogOut,
  LayoutDashboard,
  BarChart3,
  Server,
  FileKey,
  KeyRound,
  Key,
  ListTodo,
  KanbanSquare,
  FileBarChart,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  UserCog,
  BadgeCheck,
  LifeBuoy
} from 'lucide-react';
import {
  RiscosIcon,
  ControlesIcon,
  AtivosIcon,
  IncidentesIcon,
  GapAnalysisIcon,
  DueDiligenceIcon,
  DocumentosIcon,
  DenunciasIcon,
} from '@/components/icons';
import logoMini from '@/assets/akuris-logo.png';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
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
import { useSidebarFit } from '@/hooks/useSidebarFit';

type MenuItem = {
  title: string;
  url?: string;
  icon: any;
  moduleName?: string;
  subItems?: { title: string; url: string; icon: any; moduleName?: string }[];
};

type MenuSection = {
  id: string;
  label: string;
  items: MenuItem[];
};

const getMenuSections = (t: (key: string) => string): MenuSection[] => [
  {
    id: 'operation',
    label: t('sidebar.sectionOperation'),
    items: [
      { title: t('sidebar.dashboard'), url: '/dashboard', icon: LayoutDashboard, moduleName: 'dashboard' },
      { title: t('sidebar.actionPlans'), url: '/planos-acao', icon: ListTodo, moduleName: 'planos-acao' },
      { title: t('sidebar.projects'), url: '/projetos', icon: KanbanSquare, moduleName: 'projetos' },
    ],
  },
  {
    id: 'grc-core',
    label: t('sidebar.sectionGrcCore'),
    items: [
      {
        title: t('sidebar.riskManagement'),
        icon: RiscosIcon,
        subItems: [
          { title: t('sidebar.risks'), url: '/riscos', icon: RiscosIcon, moduleName: 'riscos' },
          { title: t('sidebar.riskAcceptance'), url: '/riscos/aceite', icon: ShieldCheck, moduleName: 'riscos' },
        ],
      },
      {
        title: t('sidebar.governance'),
        icon: FileCheck,
        subItems: [
          { title: t('sidebar.internalControls'), url: '/governanca', icon: ControlesIcon, moduleName: 'controles' },
          { title: t('sidebar.systems'), url: '/sistemas', icon: Server, moduleName: 'controles' },
        ],
      },
      { title: t('sidebar.gapAnalysis'), url: '/gap-analysis/frameworks', icon: GapAnalysisIcon, moduleName: 'gap-analysis' },
      {
        title: t('sidebar.assetManagement'),
        icon: AtivosIcon,
        subItems: [
          { title: t('sidebar.assets'), url: '/ativos', icon: HardDrive, moduleName: 'ativos' },
          { title: t('sidebar.licenses'), url: '/ativos/licencas', icon: FileKey, moduleName: 'ativos' },
          { title: t('sidebar.keys'), url: '/ativos/chaves', icon: Key, moduleName: 'ativos' },
        ],
      },
    ],
  },
  {
    id: 'compliance',
    label: t('sidebar.sectionCompliance'),
    items: [
      { title: t('sidebar.contracts'), url: '/contratos', icon: Handshake, moduleName: 'contratos' },
      { title: t('sidebar.documents'), url: '/documentos', icon: DocumentosIcon, moduleName: 'documentos' },
      { title: t('sidebar.privacy'), url: '/privacidade', icon: Shield, moduleName: 'dados' },
      {
        title: t('sidebar.security'),
        icon: Lock,
        subItems: [
          { title: t('sidebar.privilegedAccounts'), url: '/contas-privilegiadas', icon: UserCog, moduleName: 'contas-privilegiadas' },
          { title: t('sidebar.accessReview'), url: '/revisao-acessos', icon: UserCheck, moduleName: 'contas-privilegiadas' },
          { title: t('sidebar.incidents'), url: '/incidentes', icon: IncidentesIcon, moduleName: 'incidentes' },
        ],
      },
      {
        title: t('sidebar.compliance'),
        icon: BadgeCheck,
        subItems: [
          { title: t('sidebar.dueDiligence'), url: '/due-diligence', icon: DueDiligenceIcon, moduleName: 'due-diligence' },
          { title: t('sidebar.whistleblowing'), url: '/denuncia', icon: DenunciasIcon, moduleName: 'denuncia' },
        ],
      },
      { title: t('sidebar.businessContinuity'), url: '/continuidade', icon: LifeBuoy, moduleName: 'continuidade' },
    ],
  },
  {
    id: 'insights',
    label: t('sidebar.sectionInsights'),
    items: [
      { title: t('sidebar.reports'), url: '/relatorios', icon: FileBarChart, moduleName: 'relatorios' },
    ],
  },
];

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
  const fit = useSidebarFit();
  const isCompact = fit !== 'comfortable';
  const isDense = fit === 'dense';
  const itemH = isDense ? 'h-7' : isCompact ? 'h-8' : 'h-9';
  const iconSize = isDense ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const itemSpace = isDense ? 'space-y-0' : isCompact ? 'space-y-0.5' : 'space-y-1';
  const groupLabelCls = isDense
    ? 'text-[9px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40 px-3 mb-0'
    : isCompact
    ? 'text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40 px-3 mb-0.5'
    : 'text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40 px-3 mb-1';
  const contentPad = isCompact ? 'py-1' : 'py-2';
  const subWrapperCls = isDense ? 'space-y-0 mt-0.5 ml-4 pl-1.5' : 'space-y-1 mt-1 ml-6 pl-2';

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
      ? 'bg-primary text-primary-foreground font-semibold rounded-md shadow-sm'
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
      // Limpa preferências locais não-críticas
      try {
        window.localStorage.removeItem('akuris.focusMode');
      } catch {
        /* ignore */
      }

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
      toast.error(t('sidebar.signOutFailed') || 'Não foi possível encerrar a sessão. Tente novamente.');
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
        aria-label="Encerrando sessão"
      >
        <AkurisPulse size={80} />
      </div>
    )}
    <Sidebar
      className="transition-all duration-300 ease-out sidebar-gradient"
      collapsible="icon"
    >
      <SidebarHeader className={`border-b border-sidebar-border ${isDense ? 'h-12' : 'h-14'} overflow-hidden`}>
        <div className="flex items-center justify-center px-1 py-2 h-full">
          <img 
            key={`sidebar-logo-${logoUpdateKey}-${Date.now()}`}
            src={getLogoSrc()} 
            alt={getLogoAlt()} 
            className={`object-contain transition-all duration-300 ease-out ${
              isCollapsed ? 'h-10 w-10' : 'h-[52px] w-auto max-w-full'
            }`}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = logoMini;
            }}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className={`${contentPad} ${isDense ? 'overflow-hidden' : ''} transition-all duration-300 ease-out`}>
        {getVisibleSections().map((section) => (
          <SidebarGroup key={section.id}>
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
                            className={`w-full justify-between transition-colors duration-200 h-9 px-3 rounded-md group ${
                              hasActiveSubItem(item.subItems)
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-sidebar-accent/60'
                            }`}
                          >
                            <div className="flex items-center min-w-0">
                              <span className="relative flex-shrink-0 mr-3">
                                <item.icon
                                  className={`h-4 w-4 transition-colors duration-200 ${
                                    hasActiveSubItem(item.subItems) || openGroups.includes(item.title)
                                      ? 'text-primary'
                                      : ''
                                  }`}
                                />
                                {/* Dot indicator: filho ativo enquanto grupo está fechado */}
                                {hasActiveSubItem(item.subItems) && !openGroups.includes(item.title) && (
                                  <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                )}
                              </span>
                              {!isCollapsed && (
                                <span
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
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 flex-shrink-0 ${
                                  openGroups.includes(item.title) ? 'rotate-180 text-primary' : ''
                                }`}
                              />
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        {!isCollapsed && (
                          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                            <div className="space-y-1 mt-1 ml-6 pl-2 border-l-2 border-sidebar-border/30">
                              {item.subItems.map((subItem, idx) => {
                                const active = isActive(subItem.url);
                                return (
                                  <SidebarMenuButton
                                    key={subItem.title}
                                    asChild
                                    isActive={active}
                                    className="transition-colors duration-200 h-9 animate-fade-in opacity-0 [animation-fill-mode:forwards] data-[active=true]:bg-transparent"
                                    style={{ animationDelay: `${idx * 30}ms`, animationDuration: '220ms' }}
                                  >
                                    <NavLink
                                      to={subItem.url}
                                      end
                                      onMouseEnter={() => prefetchRoute(subItem.url)}
                                      className={`flex items-center w-full min-w-0 px-3 rounded-md transition-colors duration-200 ${
                                        active
                                          ? '!bg-primary !text-primary-foreground font-semibold shadow-sm hover:!bg-primary'
                                          : 'hover:bg-sidebar-accent/60 text-sidebar-foreground'
                                      }`}
                                    >
                                      <subItem.icon
                                        strokeWidth={1.5}
                                        className={`h-4 w-4 mr-3 flex-shrink-0 transition-colors duration-200 ${
                                          active ? '!text-primary-foreground' : ''
                                        }`}
                                      />
                                      <span className={`text-sm truncate ${active ? '!text-primary-foreground' : ''}`}>{subItem.title}</span>
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
                            className="transition-colors duration-200 h-9 min-w-0 px-3 data-[active=true]:bg-transparent"
                          >
                            <NavLink
                              to={item.url!}
                              end
                              onClick={handleNavClick}
                              onMouseEnter={() => prefetchRoute(item.url!)}
                              className={`flex items-center w-full min-w-0 px-3 rounded-md transition-colors duration-200 ${
                                active
                                  ? '!bg-primary !text-primary-foreground font-semibold shadow-sm hover:!bg-primary'
                                  : 'hover:bg-sidebar-accent/60 text-sidebar-foreground'
                              }`}
                            >
                              <div className="flex items-center min-w-0">
                                <item.icon
                                  className={`h-4 w-4 mr-3 flex-shrink-0 transition-colors duration-200 ${
                                    active ? '!text-primary-foreground' : ''
                                  }`}
                                />
                                {!isCollapsed && (
                                  <span
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

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {canAccess('configuracoes') && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="transition-colors duration-200 h-9">
                    <NavLink
                      to="/configuracoes"
                      onClick={handleNavClick}
                      className={({ isActive }) => `flex items-center w-full px-3 ${getNavCls({ isActive })}`}
                    >
                      <Settings
                        className={`h-4 w-4 mr-3 flex-shrink-0 transition-colors duration-200 ${
                          isActive('/configuracoes') ? 'text-primary-foreground' : ''
                        }`}
                      />
                      {!isCollapsed && (
                        <span
                          className={`text-sm font-medium transition-colors duration-200 truncate ${
                            isActive('/configuracoes') ? 'text-primary-foreground font-semibold' : ''
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

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className={`w-full text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors duration-200 h-9 px-3 ${
              isCollapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <LogOut className={`h-4 w-4 flex-shrink-0 ${!isCollapsed ? 'mr-3' : ''}`} />
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
