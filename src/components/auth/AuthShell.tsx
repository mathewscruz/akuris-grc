import type { ReactNode } from 'react';
import logoImage from '@/assets/akuris-logo.png';
import { FrameworkBadge } from '@/components/frameworks/FrameworkBadge';

const SELOS = ['ISO/IEC 27001', 'SOC 2', 'LGPD', 'NIST CSF', 'PCI DSS'];
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
    <div className="min-h-dvh w-full bg-[hsl(230,25%,7%)] text-white">
    <main className="min-h-dvh w-full lg:grid lg:grid-cols-[minmax(0,54%)_minmax(25rem,46%)]">
      <aside className="sidebar-gradient relative hidden min-h-dvh overflow-hidden gap-10 p-[clamp(2rem,4vw,6rem)] lg:flex lg:flex-col lg:justify-between">
        <AkurisMarkPattern opacity={0.03} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(hsl(var(--primary))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_30%_40%,black,transparent_75%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-[48rem] rounded-full bg-primary/20 blur-3xl" />

        <img src={logoImage} alt="Akuris" className="relative z-10 h-9 w-fit object-contain auth-entra" />

        <div className="relative z-10 w-full max-w-[44rem] self-center auth-entra">
          <h1 className="mt-4 max-w-[16ch] text-[3.25rem] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
            {t('auth.splitTitle')}{' '}
            <span className="text-primary">{t('auth.splitHighlight')}</span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-white/70">{t('auth.splitBody')}</p>

          {showProductPreview && (
            <div className="mt-12 flex flex-wrap gap-6" aria-hidden="true">
              {SELOS.map((nome) => (
                <FrameworkBadge key={nome} name={nome} size="xl" className="auth-entra" />
              ))}
            </div>
          )}
        </div>

        <p className="relative z-10 text-xs text-white/70 auth-entra">
          {t('auth.splitFooter')}
        </p>
      </aside>

      <section className="relative flex min-h-dvh min-w-0 flex-col items-center justify-center px-6 py-24 lg:px-[clamp(2rem,4vw,6rem)]">
        <div className="absolute right-6 top-6">
          <LanguageSelector />
        </div>

        <img src={logoImage} alt="Akuris" className="mb-10 h-10 object-contain lg:hidden" />

        <div className="w-full max-w-[26rem] auth-entra">{children}</div>

        <p className="absolute bottom-6 left-0 right-0 text-center text-micro text-white/70">
          © {new Date().getFullYear()} Akuris
        </p>
      </section>
    </main>
    </div>
  );
}
