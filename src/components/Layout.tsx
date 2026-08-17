import React from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/components/AuthProvider';
import { useBreadcrumb } from '@/hooks/useBreadcrumb';
import { LanguageSelector } from '@/components/LanguageSelector';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import UserProfile from '@/components/UserProfile';
import NotificationCenter from '@/components/NotificationCenter';
import PasswordChangeRequired from '@/components/PasswordChangeRequired';
import { CommandPalette, CommandPaletteButton } from '@/components/CommandPalette';
import { ThemeToggle } from '@/components/ThemeToggle';
import PageTransition from '@/components/PageTransition';
import TrialBanner from '@/components/TrialBanner';
import { AiCreditsExhaustedBanner } from '@/components/ui/ai-credits-banner';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { ModuleLoadingSkeleton } from '@/components/ui/module-loading-skeleton';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { InstallAppPrompt } from '@/components/pwa/InstallAppPrompt';
import { AkurIAChatbot } from '@/components/dashboard/AkurIAChatbot';
import { AkurIAActionListener } from '@/components/dashboard/akuria/AkurIAActionListener';

import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { prefetchAllRoutes } from '@/lib/route-prefetch';
import { useIsMobile } from '@/hooks/use-mobile';
import { differenceInDays, parseISO } from 'date-fns';
import { AlertTriangle, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import akurisLogo from '@/assets/akuris-logo.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { AkurisMarkPattern } from '@/components/identity/AkurisMarkPattern';
import { KpiDrillDownProvider } from '@/components/dashboard/KpiDrillDownProvider';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, loading, hasTemporaryPassword, checkTemporaryPassword, company, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbs = useBreadcrumb();
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  
  // Timeout de sessão por inatividade
  useInactivityTimeout();

  // Prefetch all module chunks during idle time after login,
  // so navigating into any module is instant on first click.
  React.useEffect(() => {
    if (user) prefetchAllRoutes();
  }, [user]);

  // Verificar se a empresa está inativa
  const isCompanyInactive = company && company.ativo === false;

  // Verificar se o trial expirou
  const isTrialExpired = React.useMemo(() => {
    if (!company) return false;
    if (company.status_licenca !== 'trial') return false;
    if (!company.data_inicio_trial) return false;
    
    const trialStartDate = parseISO(company.data_inicio_trial);
    const diasDecorridos = differenceInDays(new Date(), trialStartDate);
    return diasDecorridos >= 14;
  }, [company]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Tela de bloqueio para empresa inativa
  if (isCompanyInactive) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(216,60%,8%)] via-[hsl(216,45%,12%)] to-[hsl(216,60%,8%)] p-4 overflow-hidden">
        <AkurisMarkPattern opacity={0.06} />
        <div className="relative max-w-md w-full text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">{t('layout.blockedTitle')}</h1>
            <p className="text-muted-foreground">
              {t('layout.blockedDesc')}
            </p>
          </div>
          <div className="space-y-3">
            <a
              href="mailto:contato@akuris.com.br"
              className="block w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-lg font-medium transition-colors"
            >
              {t('layout.contactSupport')}
            </a>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => signOut()}
            >
              {t('layout.signOut')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Tela de bloqueio para trial expirado
  if (isTrialExpired) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(216,60%,8%)] via-[hsl(216,45%,12%)] to-[hsl(216,60%,8%)] p-4 overflow-hidden">
        <AkurisMarkPattern opacity={0.06} />
        <div className="relative max-w-md w-full text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
            <AlertTriangle className="h-8 w-8 text-warning" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">{t('layout.trialExpiredTitle')}</h1>
            <p className="text-muted-foreground">
              {t('layout.trialExpiredDesc')}
            </p>
          </div>
          <div className="space-y-3">
            <a
              href="mailto:comercial@akuris.com.br"
              className="block w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-lg font-medium transition-colors"
            >
              {t('layout.activateLicense')}
            </a>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => signOut()}
            >
              {t('layout.signOut')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <KpiDrillDownProvider>
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[hsl(var(--layout-shell))]">
        <AppSidebar />
        
        {/* Dialog modal obrigatório de troca de senha */}
        <PasswordChangeRequired 
          open={hasTemporaryPassword}
          onPasswordChanged={() => {
            checkTemporaryPassword();
          }}
        />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background rounded-2xl m-2 border border-[hsl(230,20%,20%)]/30">
          {/* Banner de Trial */}
          <TrialBanner />
          {/* Banner global — créditos de IA esgotados */}
          <AiCreditsExhaustedBanner />
          
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              {/* Mobile: logo, Desktop: sidebar trigger */}
              {isMobile ? (
                <img 
                  src={akurisLogo} 
                  alt="Akuris" 
                  className="h-7 cursor-pointer flex-shrink-0" 
                  onClick={() => navigate('/dashboard')} 
                />
              ) : (
                <SidebarTrigger />
              )}

              <Breadcrumb className="hidden sm:block">
                <BreadcrumbList>
                  {breadcrumbs.map((breadcrumb, index) => (
                    <div key={breadcrumb.path} className="flex items-center">
                      <BreadcrumbItem>
                        {index === breadcrumbs.length - 1 ? (
                          <BreadcrumbPage className="font-semibold">
                            {breadcrumb.title}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink 
                            className="cursor-pointer hover:text-primary"
                            onClick={() => navigate(breadcrumb.path)}
                          >
                            {breadcrumb.title}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                    </div>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
              <div className="hidden sm:flex"><CommandPaletteButton /></div>
              <LanguageSelector variant="app" />
              <ThemeToggle />
              <NotificationCenter />
              <UserProfile />
            </div>
          </header>

          <main className="min-w-0 flex-1 p-4 md:p-6 overflow-auto overflow-x-hidden w-full max-w-full pb-28 md:pb-24">
            <ErrorBoundary>
              <React.Suspense fallback={<ModuleLoadingSkeleton />}>
                <div className="min-w-0 max-w-full">
                  <PageTransition routeKey={location.pathname}>
                  {children}
                  </PageTransition>
                </div>
              </React.Suspense>
            </ErrorBoundary>
          </main>
        </div>
        
        {/* Onboarding Wizard */}
        <OnboardingWizard />
        
        {/* Command Palette (Cmd+K) */}
        <CommandPalette />
        
        {/* Bottom Navigation Mobile */}
        {isMobile && <MobileBottomNav />}

        {/* Convite para criar o atalho do Akuris no ecrã inicial */}
        <InstallAppPrompt />

        {/* AkurIA — assistente global em todas as páginas */}
        <AkurIAChatbot />
        <AkurIAActionListener />
      </div>
    </SidebarProvider>
    </KpiDrillDownProvider>
  );
};

export default Layout;
