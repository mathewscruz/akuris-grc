import { useEffect, useRef, useState } from 'react';
import heroSkyline from '@/assets/landing-hero-skyline.jpg';
import { DemoButton } from '@/components/public/PublicShell';
import { useLanguage } from '@/contexts/LanguageContext';
import { AKURIS_PATH } from '@/components/ui/AkurisPulse';

/** Cinematic hero: monochrome photo, violet light, glowing Akuris mark outline. */
export function HeroCinematic() {
  const { t } = useLanguage();
  return <section className="cine-hero" aria-labelledby="cine-hero-title">
    <img className="cine-hero-photo" src={heroSkyline} alt="" width={1920} height={1088} fetchPriority="high" />
    <div className="cine-hero-tint" aria-hidden="true" />
    <div className="cine-particles" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ ['--i' as string]: i, top: `${(i * 37) % 90 + 4}%` }} />)}</div>
    <svg className="cine-hero-mark" viewBox="0 0 80 80" aria-hidden="true"><path d={AKURIS_PATH} pathLength="1" /></svg>
    <div className="lp-container cine-hero-inner">
      <p className="cine-eyebrow">{t('site.cineEyebrow')}</p>
      <h1 id="cine-hero-title">{t('site.cineTitle')}</h1>
      <p className="cine-hero-lead">{t('site.heroBody')}</p>
      <div className="site-actions"><DemoButton className="lp-btn cine-btn-outline" /><a className="lp-btn lp-btn-ghost" href="#produto">{t('site.explore')} ↓</a></div>
    </div>
    <p className="cine-hero-aside">{t('site.cineAside')}</p>
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

export function AboutCounters() {
  const { t } = useLanguage();
  const stats = [
    { v: 29, s: '+', label: t('site.cineStatFrameworks') },
    { v: 82, s: '', label: t('site.cineStatRisks') },
    { v: 8, s: '', label: t('site.cineStatDomains') },
  ];
  return <section className="cine-about" aria-labelledby="cine-about-title"><div className="lp-container" data-reveal>
    <p className="cine-label">{t('site.cineAboutLabel')}</p>
    <h2 id="cine-about-title">{t('site.cineAboutTitle')}</h2>
    <p className="cine-about-body">{t('site.cineAboutBody')}</p>
    <dl className="cine-stats">{stats.map(s => <div key={s.label}><dt><Counter value={s.v} suffix={s.s} /></dt><dd>{s.label}</dd></div>)}</dl>
  </div></section>;
}

const MARQUEE = ['ISO 27001', 'SOC 2', 'LGPD', 'RGPD', 'NIS2', 'DORA', 'NIST CSF', 'ISO 27701', 'PCI DSS', 'BACEN', 'ISO 22301', 'COBIT'];
export function FrameworkMarquee() {
  const { t } = useLanguage();
  return <section className="cine-marquee" aria-label={t('site.cineMarqueeLabel')}>
    <div className="cine-marquee-track">{[...MARQUEE, ...MARQUEE].map((f, i) => <span key={i} aria-hidden={i >= MARQUEE.length}>{f}</span>)}</div>
  </section>;
}

export function GlowSteps() {
  const { t } = useLanguage();
  return <section className="cine-steps" aria-labelledby="cine-steps-title"><div className="lp-container" data-reveal>
    <p className="cine-label">{t('site.cineStepsLabel')}</p>
    <h2 id="cine-steps-title">{t('site.cineStepsTitle')}</h2>
    <ol>{[1, 2, 3].map(n => <li key={n}><span className="cine-step-dot">{n}</span><h3>{t(`site.cineStep${n}`)}</h3><p>{t(`site.cineStep${n}Body`)}</p></li>)}</ol>
  </div></section>;
}
