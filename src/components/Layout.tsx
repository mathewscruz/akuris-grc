import React from 'react';
import { IconWarning, IconLock } from '@/components/icons';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/components/AuthProvider';
import { useBreadcrumb } from '@/hooks/useBreadcrumb';
import { useRotaInicial } from '@/hooks/useRotaInicial';
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
  /* O logótipo leva ao início de QUEM está: um cliente só-canal não tem painel. */
  const { rota: rotaInicial } = useRotaInicial();
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
          <IconLock className="mx-auto h-8 w-8 text-destructive" />
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
          <IconWarning className="mx-auto h-8 w-8 text-warning" />
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
      {/*
        `h-screen` e não `min-h-screen`: com altura mínima, o casco crescia com
        o conteúdo, o documento inteiro rolava e o cabeçalho subia com ele. Com
        altura FIXA, quem rola é o `main` — e o cabeçalho, que é irmão dele,
        fica onde está. Era isto que faltava para o cabeçalho ser fixo; um
        `sticky` não resolvia, porque o painel tem `overflow-hidden` e um
        ancestral com overflow quebra o sticky dos descendentes.

        `overflow-hidden` no casco impede a barra de rolagem dupla.
      */}
      <div className="h-screen supports-[height:100dvh]:h-[100dvh] overflow-hidden flex w-full bg-[hsl(var(--layout-shell))]">
        <AppSidebar />
        
        {/* Dialog modal obrigatório de troca de senha */}
        <PasswordChangeRequired 
          open={hasTemporaryPassword}
          onPasswordChanged={() => {
            checkTemporaryPassword();
          }}
        />
        
        <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden bg-background rounded-lg m-2 border border-[hsl(230,20%,20%)]/30">
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
                  onClick={() => navigate(rotaInicial)} 
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

          {/*
            Coluna flex, para uma página poder esticar o seu último bloco até
            ao fim do ecrã. Sem esta cadeia, `flex-1` numa página não tem
            contra o que crescer e o conteúdo curto deixa uma faixa de fundo
            vazia por baixo. Páginas que não pedem nada continuam a ter a
            altura do seu conteúdo.
          */}
          {/* No telemóvel a barra inferior fixa come 56px, e por isso o `pb-28`
              fica. No desktop essa barra não existe: os 96px reservados eram
              para o botão flutuante do assistente, que é `fixed` e passa por
              cima do conteúdo a rolar de qualquer maneira — só protegiam os
              últimos 96px da página, à custa de uma faixa vazia em todas. */}
          <main className="min-w-0 flex-1 flex flex-col p-4 md:p-6 overflow-auto overflow-x-hidden w-full max-w-full pb-28 md:pb-10">
            <ErrorBoundary>
              <React.Suspense fallback={<ModuleLoadingSkeleton />}>
                <div className="min-w-0 max-w-full flex flex-1 flex-col">
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
