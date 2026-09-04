import type { ReactNode } from 'react';
import logoImage from '@/assets/akuris-logo.png';
import { AuthProductPreview } from '@/components/auth/AuthProductPreview';
import { AkurisMarkPattern } from '@/components/identity/AkurisMarkPattern';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';

interface AuthShellProps {
  children: ReactNode;
  /** A prévia continua visível em todas as etapas para o fluxo parecer único. */
  showProductPreview?: boolean;
}

/**
 * Estrutura visual única para credenciais, recuperação, MFA e nova senha.
 *
 * A identidade vem do próprio produto (prévia, tipografia, linhas e marca),
 * não de cartões de vidro, halos ou ilustrações genéricas de segurança.
 */
export function AuthShell({ children, showProductPreview = true }: AuthShellProps) {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[hsl(230,25%,7%)] text-white lg:grid lg:grid-cols-[minmax(0,54%)_minmax(25rem,46%)]">
      <aside className="sidebar-gradient relative hidden min-h-screen overflow-hidden p-14 lg:flex lg:flex-col lg:justify-between">
        <AkurisMarkPattern opacity={0.03} />

        <img src={logoImage} alt="Akuris" className="relative z-10 h-9 w-fit object-contain auth-entra" />

        <div className="relative z-10 auth-entra">
          <h1 className="max-w-[14ch] text-[3.25rem] font-medium leading-[1.05] tracking-[-0.03em] text-white">
            {t('auth.platformTitle')}{' '}
            <span className="text-white/45">{t('auth.platformHighlight')}</span>
          </h1>

          {showProductPreview && (
            <div className="mt-12 ml-20 -mr-[13rem]" aria-hidden="true">
              <AuthProductPreview />
            </div>
          )}
        </div>

        <p className="relative z-10 text-[0.6875rem] text-white/25 auth-entra">
          {t('auth.previewNote')}
        </p>
      </aside>

      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-20 lg:px-14">
        <div className="absolute right-6 top-6">
          <LanguageSelector />
        </div>

        <img src={logoImage} alt="Akuris" className="mb-10 h-10 object-contain lg:hidden" />

        <div className="w-full max-w-sm auth-entra">{children}</div>

        <p className="absolute bottom-6 left-0 right-0 text-center text-micro text-white/25">
          © {new Date().getFullYear()} Akuris
        </p>
      </section>
    </main>
  );
}

