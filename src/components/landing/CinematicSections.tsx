import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import akurisLogo from '@/assets/akuris-logo.png';
import { DemoButton } from '@/components/public/PublicShell';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import dashboardArt from '@/assets/akuris-dashboard.png.asset.json';
import cymeLogo from '@/assets/parceiros/cyberme-logo.png.asset.json';
import mercuriusLogo from '@/assets/parceiros/mercurius-logo.png.asset.json';
import { FRAMEWORK_LOGOS } from '@/components/landing/FrameworkLogos';

const Accent = ({ text, word }: { text: string; word: string }) => {
  const i = text.indexOf(word);
  if (i < 0 || !word) return <>{text}</>;
  return <>{text.slice(0, i)}<span className="cine-accent">{word}</span>{text.slice(i + word.length)}</>;
};



const MARK_D = 'M40 228 L132 42 Q140 26 148 42 L240 228 Q190 186 140 186 Q90 186 40 228 Z';
function BrandMark() {
  return <svg className="cine-mark" viewBox="0 0 280 260">
    <path className="cine-mark-base" pathLength="1" d={MARK_D} />
    <path className="cine-mark-beam" pathLength="1" d={MARK_D} />
  </svg>;
}

/** Spotlight que segue o ponteiro nos cartões (CSS vars --mx/--my). */
function useSpotlight() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.cine-module, .cine-aud-grid article, .cine-hero');
      if (!el) return; const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, []);
}

export function HeroCinematic() {
  const { t } = useLanguage();
  useSpotlight();
  return <section className="cine-hero" aria-labelledby="cine-hero-title">
    <div className="cine-stage" aria-hidden="true"><div className="cine-glow" /><div className="cine-dots" /><BrandMark /></div>
    <div className="lp-container cine-hero-inner">
      <h1 id="cine-hero-title"><Accent text={t('site.cineTitle')} word={t('site.cineTitleAccent')} /></h1>
      <p className="cine-hero-lead">{t('site.cineLeadClear')}</p>
      <div className="cine-hero-actions"><DemoButton className="lp-btn cine-btn-outline">{t('site.cineDemo')}</DemoButton><a className="cine-link-btn" href="#como-funciona">{t('site.cineHowLink')} ↓</a></div>
    </div>
    <FrameworkMarquee />
  </section>;
}

export function AboutModules() {
  const { t } = useLanguage();
  const words = t('site.cineManifesto').split(' ');
  return <section className="cine-about cine-sec" id="produto" aria-labelledby="cine-about-title"><div className="lp-container">
    <div className="cine-manifesto">
      <h2 id="cine-about-title">{words.map((w, i) => <span key={i} style={{ ['--i' as string]: i }}>{w} </span>)}</h2>
      <p>{t('site.cineManifestoSide')}</p>
    </div>
    <ModuleThread />
  </div></section>;
}

function useActiveByCenter(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0; const mid = window.innerHeight / 2; let best = 0, dist = Infinity;
      refs.current.forEach((el, i) => { if (!el) return; const r = el.getBoundingClientRect(); const d = Math.abs(r.top + Math.min(r.height, 120) / 2 - mid); if (d < dist) { dist = d; best = i; } });
      setActive(best);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update(); window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [count]);
  return { refs, active, setActive };
}

const THREAD = ['Riscos', 'Controles', 'Gap', 'Privacidade', 'Auditorias', 'Continuidade'] as const;
function ModuleThread() {
  const { t } = useLanguage();
  const { refs, active } = useActiveByCenter(THREAD.length);
  const progress = active / (THREAD.length - 1);
  return <div className="cine-thread">
    <p className="cine-label">{t('site.cineThreadLabel')}</p>
    <div className="cine-thread-grid">
      <ol>{THREAD.map((k, i) => <li key={k} data-i={i} ref={el => { refs.current[i] = el; }} className={i === active ? 'is-active' : i < active ? 'is-past' : ''}>
        <span className="cine-thread-n">{String(i + 1).padStart(2, '0')}</span>
        <strong>{t(`site.cineMod${k}`)}</strong>
        <em>{t(`site.cineThread${k}`)}</em>
      </li>)}</ol>
      <div className="cine-thread-art" aria-hidden="true"><svg viewBox="0 0 200 600">
        <path className="cine-thread-base" d="M100 20 C 20 110, 180 190, 100 300 S 20 490, 100 580" />
        <path className="cine-thread-lit" pathLength="1" style={{ strokeDashoffset: 1 - progress }} d="M100 20 C 20 110, 180 190, 100 300 S 20 490, 100 580" />
        {THREAD.map((_, i) => <circle key={i} cx={100} cy={20 + i * 112} r={i <= active ? 5 : 3} className={i <= active ? 'on' : ''} />)}
      </svg></div>
    </div>
    <p className="cine-thread-more">{t('site.cineThreadMore')}</p>
  </div>;
}

export function FrameworkMarquee() {
  const { t } = useLanguage();
  return <div className="cine-marquee" id="frameworks" role="region" aria-label={t('site.cineMarqueeLeft')}>
    <p className="cine-marquee-side">{t('site.cineMarqueeLeft')}</p>
    <div className="cine-marquee-window"><div className="cine-marquee-track">{[...FRAMEWORK_LOGOS, ...FRAMEWORK_LOGOS].map(([name, logo], i) => <span key={i} aria-hidden={i >= FRAMEWORK_LOGOS.length}><i>{logo}</i>{name}</span>)}</div></div>
  </div>;
}

export function ProductPeek() {
  const { t } = useLanguage();
  return <section className="cine-sec ed-peek" aria-labelledby="cine-peek-title"><div className="lp-container ed-peek-grid">
    <div className="ed-peek-copy">
      <p className="cine-label">{t('site.cinePeekLabel')}</p>
      <h2 id="cine-peek-title" className="ed-h2">{t('site.cinePeekTitle')}</h2>
      <p className="ed-side">{t('site.cinePeekSub')}</p>
    </div>
    <div className="ed-peek-frame"><img src={dashboardArt.url} alt={t('site.cinePeekTitle')} loading="eager" decoding="async" width={1586} height={992} /></div>
  </div></section>;
}

export function Audience() {
  const { t } = useLanguage();
  const { refs, active, setActive } = useActiveByCenter(3);
  return <section className="cine-sec ed-aud" aria-labelledby="cine-aud-title"><div className="lp-container">
    <p className="cine-label">{t('site.cineAudLabel')}</p>
    <h2 id="cine-aud-title" className="sr-only">{t('site.cineAudTitle')}</h2>
    <ol>{[1, 2, 3].map((n, i) => <li key={n} ref={el => { refs.current[i] = el; }} onMouseEnter={() => setActive(i)} className={i === active ? 'is-active' : ''}>
      <p className="ed-quote">{t(`site.edAudQuote${n}`)}</p>
      <div className="ed-aud-meta"><strong>{t(`site.cineAud${n}`)}</strong><span>{t(`site.cineAud${n}Body`)}</span></div>
    </li>)}</ol>
  </div></section>;
}

export function PartnersStrip() {
  const { t } = useLanguage();
  return <section className="cine-sec ed-partners" aria-labelledby="cine-partners-title"><div className="lp-container">
    <p className="cine-label">{t('site.partnersLabel')}</p>
    <h2 id="cine-partners-title" className="ed-h2">{t('site.partnersTitle')}</h2>
    <ul className="ed-partners-logos">
      <li><a href={PARTNER_URLS.cyberme} target="_blank" rel="noopener noreferrer" className="ed-partners-link" aria-label="CyberME"><img src={cymeLogo.url} alt="CyberME" className="is-tall" loading="lazy" /></a><PartnerGeo map={GEO_EU} tone="cyan" label={t('site.partnersGeoEurope')} kicker={t('site.partnersOfficialReseller')} /></li>
      <li><a href={PARTNER_URLS.mercurius} target="_blank" rel="noopener noreferrer" className="ed-partners-link" aria-label="Mercurius"><img src={mercuriusLogo.url} alt="Mercurius" loading="lazy" /></a><PartnerGeo map={GEO_SA} tone="amber" label={t('site.partnersGeoBrChile')} kicker={t('site.partnersOfficialReseller')} /></li>
    </ul>
  </div></section>;
}

export function FaqCompact({ faqs }: { faqs: { question: string; answer: string }[] }) {
  const { t } = useLanguage();
  return <section className="cine-sec ed-faq" aria-labelledby="cine-faq-title"><div className="lp-container ed-faq-grid">
    <div className="ed-faq-head"><p className="cine-label">{t('site.cineFaqLabel')}</p><h2 id="cine-faq-title" className="ed-h2">{t('site.cineFaqTitle')}</h2></div>
    <div className="ed-faq-list">{faqs.map(f => <details key={f.question}><summary>{f.question}<i aria-hidden="true" /></summary><div><p>{f.answer}</p></div></details>)}</div>
  </div></section>;
}

export function GlowSteps() {
  const { t } = useLanguage();
  return <section className="cine-sec ed-steps" id="como-funciona" aria-labelledby="cine-steps-title"><div className="lp-container">
    <p className="cine-label">{t('site.cineStepsLabel')}</p>
    <h2 id="cine-steps-title" className="ed-h2">{t('site.cineStepsTitle')}</h2>
    <p className="ed-side ed-steps-sub">{t('site.cineStepsSub')}</p>
    <div className="ed-steps-line" aria-hidden="true"><i /></div>
    <ol>{[1, 2, 3].map(n => <li key={n} style={{ ['--i' as string]: n }}><span className="ed-num">0{n}</span><h3>{t(`site.cineStep${n}`)}</h3><p>{t(`site.cineStep${n}Body`)}</p></li>)}</ol>
  </div></section>;
}

export function CtaShield() {
  const { t } = useLanguage();
  return <section className="cine-sec ed-cta2" id="contato" aria-labelledby="ed-cta-title">
    <div className="lp-container">
      <div className="ed-steps-line" aria-hidden="true"><i /></div>
      <div className="ed-cta2-grid">
        <div>
          <p className="ed-cta2-label">{t('site.edCtaLabel2')}</p>
          <h2 id="ed-cta-title">{t('site.edCtaTitle2')}<br /><em>{t('site.edCtaAccent2')}</em></h2>
        </div>
        <div className="ed-cta2-side">
          <p>{t('site.edCtaSub2')}</p>
          <DemoButton className="ed-cta2-link">{t('site.cineDemo')}</DemoButton>
        </div>
      </div>
    </div>
  </section>;
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

/* Mini-mapas pontilhados: '.' vazio, 'o' terra, 'h' região de atuação, 'p' região + pulso */
const GEO_EU = [
  '......ooo.oo....',
  '.....oooooo.....',
  '..o..hhhh.......',
  '.oo.hhhhhhhh....',
  '....hhhhhhhhhh..',
  '...hhhhhhhhhhh..',
  '..hhhhhhhhhhhh..',
  '.phhhh.hhh.hh...',
  '.hhh....hh..h...',
  '.........h......',
];
const GEO_SA = [
  '..oooo......',
  '.ooooohhh...',
  'oooohhhhhhh.',
  '.oohhhhhhhhh',
  '..ohhhhpphhh',
  '..hhhhhhhhh.',
  '..phhhhhhh..',
  '..hhhhhhh...',
  '..hhoooo....',
  '..hhooo.....',
  '..hho.......',
  '..ph........',
  '..hh........',
  '...h........',
];
function PartnerGeo({ map, tone, label, kicker }: { map: string[]; tone: 'cyan' | 'amber'; label: string; kicker: string }) {
  const g = 9; const w = map[0].length * g; const h = map.length * g;
  return <div className={`ed-partners-geo is-${tone}`}>
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      {map.flatMap((row, y) => row.split('').map((c, x) => c === '.' ? null : (
        <g key={`${x}-${y}`}>
          <circle cx={x * g + g / 2} cy={y * g + g / 2} r={c === 'o' ? 1.3 : 2} className={c === 'o' ? 'geo-land' : 'geo-on'} style={{ animationDelay: `${(x + y) * 40}ms` }} />
          {c === 'p' && <circle cx={x * g + g / 2} cy={y * g + g / 2} r={2} className="geo-pulse" />}
        </g>
      )))}
    </svg>
    <span className="ed-partners-kicker">{kicker}</span>
    <span className="ed-partners-place">{label}</span>
  </div>;
}

const PARTNER_URLS = { cyberme: 'https://cyberme.pt', mercurius: 'https://mercurius.com.br' };
