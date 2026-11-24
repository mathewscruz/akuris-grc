import { SEO } from '@/components/SEO';
import { PublicShell } from '@/components/public/PublicShell';
import { HeroCinematic, AboutModules, FrameworkMarquee, GlowSteps, CtaShield, LandingFooter } from '@/components/landing/CinematicSections';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LandingPage() {
  const { t } = useLanguage();
  return <PublicShell cinematic>
    <SEO title={t('site.seoTitle')} description={t('site.seoDescription')} canonical="/" />
    <HeroCinematic />
    <AboutModules />
    <FrameworkMarquee />
    <GlowSteps />
    <CtaShield />
    <LandingFooter />
  </PublicShell>;
}
