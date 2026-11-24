import { SEO } from '@/components/SEO';
import { PublicShell } from '@/components/public/PublicShell';
import { HeroCinematic, AboutModules, ProductPeek, GlowSteps, Audience, PartnersStrip, FaqCompact, CtaShield, LandingFooter } from '@/components/landing/CinematicSections';
import { useLandingReveal } from '@/hooks/useLandingAnimations';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LandingPage() {
  const { t } = useLanguage();
  useLandingReveal();
  const faqs = [1, 2, 3, 4, 5, 6].map(n => ({ question: t(`publico.landing.faq.q${n}`), answer: t(`publico.landing.faq.a${n}`) }));
  return <PublicShell cinematic>
    <SEO title={t('site.seoTitle')} description={t('site.seoDescription')} canonical="/" jsonLd={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) }} />
    <HeroCinematic />
    <AboutModules />
    <ProductPeek />
    <GlowSteps />
    <Audience />
    <PartnersStrip />
    <FaqCompact faqs={faqs} />
    <CtaShield />
    <LandingFooter />
  </PublicShell>;
}
