import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import heroSkyline from '@/assets/landing-hero-skyline.jpg';
import akurisLogo from '@/assets/akuris-logo.png';
import { DemoButton } from '@/components/public/PublicShell';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProductScreens } from '@/components/landing/ProductScreens';
import { FRAMEWORK_LOGOS } from '@/components/landing/FrameworkLogos';
import { IconBriefcase, IconDatabase, IconFolder, IconKey, IconMegaphone, IconServer, IconTarget, IconUserCheck, IconShieldCheck, IconRefresh, IconFileText, IconChart, IconLock, IconArrowRight, IconUsers, IconBolt, IconSettings, } from '@/components/icons';

const Accent = ({ text, word }: { text: string; word: string }) => {
  const i = text.indexOf(word);
  if (i < 0 || !word) return <>{text}</>;
  return <>{text.slice(0, i)}<span className="cine-accent">{word}</span>{text.slice(i + word.length)}</>;
};

function NeonShield({ check = false, className }: { check?: boolean; className?: string }) {
  return <svg className={className} viewBox="0 0 200 240" aria-hidden="true">
    <path className="cine-draw" pathLength="1" d="M100 8 18 40v66c0 58 36 100 82 124 46-24 82-66 82-124V40L100 8Z" />
    <path className="cine-draw cine-draw-2" pathLength="1" d="M100 34 42 57v50c0 44 26 76 58 94 32-18 58-50 58-94V57l-58-23Z" />
    {check && <path className="cine-draw cine-draw-3" pathLength="1" d="m66 120 24 24 46-50" />}
  </svg>;
}

function LightTrails({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
    {[0, 1, 2, 3, 4].map(i => <path key={i} pathLength="1" style={{ animationDelay: `${i * .35}s` }} d={`M0 ${300 - i * 8} C 260 ${280 - i * 18}, 520 ${200 - i * 22}, 800 ${40 + i * 20}`} />)}
  </svg>;
}

const Vertical = ({ lines, className }: { lines: string[]; className: string }) =>
  <div className={`cine-vtext ${className}`} aria-hidden="true">{lines.map(l => <span key={l}>{l}</span>)}<i /></div>;

export function HeroCinematic() {
  const { t } = useLanguage();
  const benefits: [ReactNode, string][] = [[<IconChart strokeWidth={1.5} />, t('site.cineBenA')], [<IconRefresh strokeWidth={1.5} />, t('site.cineBenB')], [<IconFileText strokeWidth={1.5} />, t('site.cineBenC')]];
  return <section className="cine-hero" aria-labelledby="cine-hero-title">
    <img className="cine-hero-photo" src={heroSkyline} alt="" width={1920} height={1088} fetchPriority="high" />
    <div className="cine-hero-tint" aria-hidden="true" />
    <div className="cine-particles" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ left: `${(i * 47) % 96 + 2}%`, top: `${(i * 37) % 80 + 4}%`, animationDelay: `${(i * .37) % 4}s` }} />)}</div>
    <LightTrails className="cine-trails" />
    <NeonShield className="cine-hero-shield" />
    <Vertical className="cine-v-mid" lines={t('site.cineVMid').split('|')} />
    <Vertical className="cine-v-top" lines={t('site.cineVTop').split('|')} />
    <Vertical className="cine-v-bottom" lines={t('site.cineVBottom').split('|')} />
    <div className="lp-container cine-hero-inner">
      <h1 id="cine-hero-title">{t('site.cineTitle')}</h1>
      <p className="cine-hero-lead">{t('site.cineLeadClear')}</p>
      <div className="cine-hero-actions"><DemoButton className="lp-btn cine-btn-outline">{t('site.cineDemo')}</DemoButton><a className="cine-link-btn" href="#como-funciona">{t('site.cineHowLink')} ↓</a></div>
      <ul className="cine-benefits">{benefits.map(([icon, label]) => <li key={label}>{icon}<span>{label}</span></li>)}</ul>
    </div>
    <FrameworkMarquee />
  </section>;
}

function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const start = performance.now();
      const tick = (now: number) => { const p = Math.min(1, (now - start) / 1400); setN(Math.round(value * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el); return () => io.disconnect();
  }, [value]);
  return <span ref={ref}>{n}{suffix && <em>{suffix}</em>}</span>;
}

export function AboutModules() {
  const { t } = useLanguage();
  const stats = [[29, '+', 'cineStat1'], [15, '', 'cineStat2'], [82, '', 'cineStat3'], [3, '', 'cineStat4']] as const;
  const modules: [ReactNode, string][] = [
    [<IconShieldCheck strokeWidth={1.5} />, 'Riscos'], [<IconSettings strokeWidth={1.5} />, 'Controles'], [<IconChart strokeWidth={1.5} />, 'Gap'],
    [<IconLock strokeWidth={1.5} />, 'Privacidade'], [<IconFileText strokeWidth={1.5} />, 'Auditorias'], [<IconRefresh strokeWidth={1.5} />, 'Continuidade'],
  ];
  return <section className="cine-about cine-sec" id="produto" aria-labelledby="cine-about-title"><div className="lp-container" data-reveal>
    <p className="cine-label cine-label-lines">{t('site.cineAboutLabel')}</p>
    <h2 id="cine-about-title"><Accent text={t('site.cineAboutTitle')} word={t('site.cineAboutAccent')} /></h2>
    <p className="cine-about-body">{t('site.cineAboutBody')}</p>
    <dl className="cine-stats">{stats.map(([v, s, k]) => <div key={k}><dt><Counter value={v} suffix={s} /></dt><dd>{t('site.' + k)}</dd></div>)}</dl>
    <div className="cine-modules">{modules.map(([icon, k]) => <Link to="/auth" key={k} className="cine-module">
      <span className="cine-module-icon">{icon}</span>
      <span><strong>{t(`site.cineMod${k}`)}</strong><span>{t(`site.cineMod${k}Body`)}</span></span>
      <span className="cine-module-arrow"><IconArrowRight strokeWidth={1.5} /></span>
    </Link>)}</div>
    <ModuleChips />
    <p className="cine-tagline-lines">{t('site.cineTagline')}</p>
  </div></section>;
}

export function FrameworkMarquee() {
  const { t } = useLanguage();
  return <div className="cine-marquee" id="frameworks" role="region" aria-label={t('site.cineMarqueeLeft')}>
    <p className="cine-marquee-side">{t('site.cineMarqueeLeft')}</p>
    <div className="cine-marquee-window"><div className="cine-marquee-track">{[...FRAMEWORK_LOGOS, ...FRAMEWORK_LOGOS].map(([name, logo], i) => <span key={i} aria-hidden={i >= FRAMEWORK_LOGOS.length}><i>{logo}</i>{name}</span>)}</div></div>
  </div>;
}

function ModuleChips() {
  const { t } = useLanguage();
  const chips: [ReactNode, string][] = [[<IconServer strokeWidth={1.5} />, 'Ativos'], [<IconBriefcase strokeWidth={1.5} />, 'Contratos'], [<IconUsers strokeWidth={1.5} />, 'Fornecedores'], [<IconBolt strokeWidth={1.5} />, 'Incidentes'], [<IconMegaphone strokeWidth={1.5} />, 'Denuncias'], [<IconFolder strokeWidth={1.5} />, 'Documentos'], [<IconTarget strokeWidth={1.5} />, 'Projetos'], [<IconFileText strokeWidth={1.5} />, 'Planos'], [<IconKey strokeWidth={1.5} />, 'Acessos'], [<IconDatabase strokeWidth={1.5} />, 'Dados']];
  return <div className="cine-chips"><p>{t('site.cineChipsTitle')}</p><ul>{chips.map(([icon, k]) => <li key={k}>{icon}{t('site.cineChip' + k)}</li>)}</ul></div>;
}

export function ProductPeek() {
  const { t } = useLanguage();
  return <section className="cine-sec cine-peek" aria-labelledby="cine-peek-title"><div className="lp-container" data-reveal>
    <p className="cine-label">{t('site.cinePeekLabel')}</p>
    <h2 id="cine-peek-title" className="cine-h2">{t('site.cinePeekTitle')}</h2>
    <p className="cine-sub">{t('site.cinePeekSub')}</p>
    <div className="cine-product-frame"><ProductScreens autoplay /></div>
  </div></section>;
}

export function Audience() {
  const { t } = useLanguage();
  const items: [ReactNode, number][] = [[<IconShieldCheck strokeWidth={1.5} />, 1], [<IconUserCheck strokeWidth={1.5} />, 2], [<IconChart strokeWidth={1.5} />, 3]];
  return <section className="cine-sec cine-audience" aria-labelledby="cine-aud-title"><div className="lp-container" data-reveal>
    <p className="cine-label">{t('site.cineAudLabel')}</p>
    <h2 id="cine-aud-title" className="cine-h2">{t('site.cineAudTitle')}</h2>
    <div className="cine-aud-grid">{items.map(([icon, n]) => <article key={n}><span className="cine-module-icon">{icon}</span><h3>{t(`site.cineAud${n}`)}</h3><p>{t(`site.cineAud${n}Body`)}</p></article>)}</div>
  </div></section>;
}

export function FaqCompact({ faqs }: { faqs: { question: string; answer: string }[] }) {
  const { t } = useLanguage();
  return <section className="cine-sec cine-faq" aria-labelledby="cine-faq-title"><div className="lp-container" data-reveal>
    <p className="cine-label">{t('site.cineFaqLabel')}</p>
    <h2 id="cine-faq-title" className="cine-h2">{t('site.cineFaqTitle')}</h2>
    <div className="cine-faq-list">{faqs.map(f => <details key={f.question}><summary>{f.question}<span aria-hidden="true">+</span></summary><p>{f.answer}</p></details>)}</div>
  </div></section>;
}

export function GlowSteps() {
  const { t } = useLanguage();
  return <section className="cine-steps cine-sec" id="como-funciona" aria-labelledby="cine-steps-title"><div className="lp-container" data-reveal>
    <p className="cine-label">{t('site.cineStepsLabel')}</p>
    <h2 id="cine-steps-title">{t('site.cineStepsTitle')}</h2>
    <p className="cine-steps-sub">{t('site.cineStepsSub')}</p>
    <ol>{[1, 2, 3].map(n => <li key={n}><span className="cine-step-dot">{n}</span><h3>{t(`site.cineStep${n}`)}</h3><p>{t(`site.cineStep${n}Body`)}</p></li>)}</ol>
  </div></section>;
}

export function CtaShield() {
  const { t } = useLanguage();
  const items: [ReactNode, string, string][] = [[<IconBolt strokeWidth={1.5} />, 'cineCtaB1', 'cineCtaB1Body'], [<IconChart strokeWidth={1.5} />, 'cineCtaB2', 'cineCtaB2Body'], [<IconUsers strokeWidth={1.5} />, 'cineCtaB3', 'cineCtaB3Body']];
  return <section className="lp-container cine-cta-wrap cine-sec" id="contato"><div className="cine-cta" data-reveal>
    <div className="cine-cta-copy">
      <p className="cine-label cine-label-bar">{t('site.cineCtaLabel')}</p>
      <h2><Accent text={t('site.cineCtaTitle')} word={t('site.cineCtaAccent')} /></h2>
      <p>{t('site.cineCtaBody')}</p>
      <DemoButton className="lp-btn cine-btn-solid">{t('site.cineDemo')}</DemoButton>
    </div>
    <div className="cine-cta-art"><LightTrails className="cine-cta-waves" /><NeonShield check className="cine-cta-shield" /></div>
    <ul className="cine-cta-list">{items.map(([icon, a, b]) => <li key={a}>{icon}<span><strong>{t('site.' + a)}</strong><span>{t('site.' + b)}</span></span></li>)}</ul>
  </div></section>;
}

const Social = ({ d, label, href }: { d: string; label: string; href: string }) =>
  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg></a>;

export function LandingFooter() {
  const { t } = useLanguage();
  return <footer className="cine-footer lp-container">
    <div className="cine-footer-top">
      <div className="cine-footer-brand"><Link to="/" aria-label="Akuris"><img src={akurisLogo} alt="Akuris" width="134" height="40" /></Link><p>{t('site.cineFooterTag1')}<br />{t('site.cineFooterTag2')}</p></div>
      <nav aria-label={t('site.cineFootProduct')}><strong>{t('site.cineFootProduct')}</strong><Link to="/#produto">{t('site.cineFootFeatures')}</Link><Link to="/frameworks">Frameworks</Link><Link to="/migracao">{t('site.migration')}</Link></nav>
      <nav aria-label={t('site.cineFootResources')}><strong>{t('site.cineFootResources')}</strong><Link to="/blog">Blog</Link><Link to="/frameworks">{t('site.guides')}</Link><Link to="/seguranca">{t('site.trust')}</Link></nav>
      <nav aria-label={t('site.cineFootCompany')}><strong>{t('site.cineFootCompany')}</strong><Link to="/solucoes/canal-de-denuncias">{t('site.channel')}</Link><a href="mailto:contato@akuris.com.br">{t('site.cineFootContact')}</a></nav>
      <div className="cine-footer-social">
        <Social label="LinkedIn" href="https://www.linkedin.com/company/akuris" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.5c0-1.3-.02-3-1.83-3-1.83 0-2.1 1.43-2.1 2.9V21h-4V9Z" />
        <Social label="YouTube" href="https://www.youtube.com/@akuris" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.6.5-4.8.5-4.8s0-3.2-.5-4.8ZM9.75 15.02V8.98L15.5 12l-5.75 3.02Z" />
        <Social label="X" href="https://x.com/akuris" d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.36 5.77L17.75 3Zm-1.08 16.2h1.7L7.42 4.73H5.6l11.07 14.47Z" />
        <span className="cine-footer-lang"><LanguageSelector variant="dark" /></span>
      </div>
    </div>
    <div className="cine-footer-bottom"><p>© {new Date().getFullYear()} Akuris. {t('site.cineRights')}</p><nav aria-label="Legal"><Link to="/politica-privacidade">{t('site.cinePrivacy')}</Link><Link to="/seguranca">{t("site.trust")}</Link><Link to="/politica-privacidade#cookies">Cookies</Link></nav></div>
  </footer>;
}
