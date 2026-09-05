import { Link } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { PublicShell, DemoButton } from '@/components/public/PublicShell';
import { ProductScreens } from '@/components/landing/ProductScreens';
import { ProductStory } from '@/components/landing/ProductStory';
import { GapWalkthrough } from '@/components/landing/GapWalkthrough';
import { ModuleCatalog } from '@/components/landing/ModuleCatalog';
import { useLandingReveal } from '@/hooks/useLandingAnimations';
import { useLanguage } from '@/contexts/LanguageContext';
import { AKURIS_PATH } from '@/components/ui/AkurisPulse';
import { FrameworkGlyph } from '@/components/frameworks/FrameworkGlyph';
import { PublicMotionToggle } from '@/components/landing/PublicMotionToggle';
import { frameworksSeo } from '@/data/frameworks-seo';

export default function LandingPage() {
  const { t } = useLanguage();
  useLandingReveal();
  const faqs = [1, 2, 3, 4, 5, 6].map(n => ({ question: t(`publico.landing.faq.q${n}`), answer: t(`publico.landing.faq.a${n}`) }));
  return <PublicShell>
    <SEO title={t('site.seoTitle')} description={t('site.seoDescription')} canonical="/" jsonLd={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) }} />
    <section className="site-hero lp-container">
      <svg className="hero-signature" viewBox="0 0 80 80" aria-hidden="true"><path d={AKURIS_PATH} pathLength="1" /></svg>
      <div className="site-hero-grid"><div><h1><span>{t('site.heroLine1')}</span> <span className="hero-title-accent">{t('site.heroLine2')}</span></h1><p>{t('site.heroBody')}</p><div className="site-actions"><DemoButton /><a className="lp-btn lp-btn-ghost" href="#produto">{t('site.explore')} ↓</a></div><p className="site-muted">{t('site.heroNote')}</p><PublicMotionToggle /></div><div><ProductScreens autoplay /></div></div>
    </section>
    <GapWalkthrough />
    <ProductStory />
    <ModuleCatalog />
    <section className="site-section" id="frameworks"><div className="lp-container"><div className="site-heading" data-reveal><h2>{t('site.guidesTitle')}</h2><p>{t('site.guidesNote')}</p></div><div className="site-guides">{frameworksSeo.slice(0, 6).map(f => <Link to={'/frameworks/' + f.slug} key={f.slug} className="site-guide"><FrameworkGlyph nome={f.nome} size={25} /><strong>{f.nome}</strong><span aria-hidden="true">↗</span></Link>)}</div><div className="site-actions"><Link className="site-text-link" to="/frameworks">{t('site.allGuides')} →</Link></div></div></section>
    <section className="site-section" id="seguranca"><div className="lp-container"><div className="site-heading"><h2>{t('site.trustTitle')}</h2><p>{t('site.trustBody')}</p></div><div className="site-resource-links"><Link className="site-text-link" to="/seguranca">{t('site.trust')} →</Link><Link className="site-text-link" to="/migracao">{t('site.migration')} →</Link><Link className="site-text-link" to="/politica-privacidade">{t('publico.landing.footer.politica')} →</Link></div></div></section>
    <section className="site-section"><div className="lp-container"><div className="site-heading"><h2>{t('publico.landing.faq.eyebrow')}</h2></div><div className="lp-faq-list">{faqs.map(f => <details className="lp-faq" key={f.question}><summary>{f.question}<span className="plus" aria-hidden="true" /></summary><div className="body">{f.answer}</div></details>)}</div></div></section>
    <section className="site-cta lp-container" id="contato"><div><h2>{t('site.ctaTitle')}</h2><p>{t('site.ctaBody')}</p></div><DemoButton /></section>
  </PublicShell>;
}
