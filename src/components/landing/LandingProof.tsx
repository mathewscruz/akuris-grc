import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { FrameworkGlyph } from '@/components/frameworks/FrameworkGlyph';
import { PUBLIC_MODULES } from '@/lib/public-modules';
import { RiscosIcon, ControlesIcon, DocumentosIcon, DashboardIcon } from '@/components/icons';
import { useMotionAllowed } from '@/lib/motion-preferences';
import { useDemoPlayback } from '@/hooks/useDemoPlayback';
import { ProductScreens, screenKeys } from './ProductScreens';

/** Valores reais do produto: catálogo global de frameworks e biblioteca de riscos. */
export const LANDING_STATS = { frameworks: 29, riscos: 82 } as const;
const TRUST_FRAMEWORKS = ['ISO/IEC 27001', 'SOC 2', 'LGPD', 'GDPR', 'NIST CSF', 'PCI DSS', 'BACEN 4.893', 'ISO/IEC 27701', 'DORA', 'NIS2'];

function CountUp({ value }: { value: number }) {
  const motion = useMotionAllowed();
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(motion ? 0 : value);
  useEffect(() => {
    if (!motion || !ref.current || typeof IntersectionObserver === 'undefined') { setShown(value); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (now: number) => { const p = Math.min(1, (now - start) / 1200); setShown(Math.round(value * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, motion]);
  return <dt ref={ref}>{shown}</dt>;
}

export function TrustStrip() {
  const { t } = useLanguage();
  const list = TRUST_FRAMEWORKS.map(nome => <li key={nome}><FrameworkGlyph nome={nome} size={22} /><span>{nome}</span></li>);
  return <section className="lp-container site-trust" aria-label={t('site.trustLabel')} data-reveal>
    <p>{t('site.trustLabel')}</p>
    <div className="site-marquee"><ul>{list}</ul><ul aria-hidden="true">{list}</ul></div>
    <dl className="site-stats">
      <div><CountUp value={LANDING_STATS.frameworks} /><dd>{t('site.statFrameworks')}</dd></div>
      <div><CountUp value={LANDING_STATS.riscos} /><dd>{t('site.statRisks')}</dd></div>
      <div><CountUp value={PUBLIC_MODULES.length} /><dd>{t('site.statModules')}</dd></div>
    </dl>
  </section>;
}

export function HowItWorks() {
  const { t } = useLanguage();
  const icons = [RiscosIcon, ControlesIcon, DocumentosIcon, DashboardIcon];
  const { tick, select, root, interaction } = useDemoPlayback({ steps: 4, interval: 4200 });
  return <section className="site-section site-how" id="produto"><div className="lp-container">
    <div className="site-heading" data-reveal><h2>{t('site.howTitle')}</h2><p>{t('site.howBody')}</p></div>
    <div className="site-how-grid" ref={root} {...interaction} data-reveal>
      <ol style={{ ['--how-progress' as string]: `${(tick / 3) * 100}%` }}>
        {screenKeys.map((key, i) => { const Icon = icons[i]; return <li key={key} className={tick === i ? 'is-active' : tick > i ? 'is-done' : ''}>
          <button type="button" onClick={() => select(i)} aria-pressed={tick === i}>
            <span className="site-how-num">0{i + 1}</span><Icon size={22} />
            <span><strong>{t('site.' + key)}</strong><small>{t(`site.storyScreen${i + 1}`)}</small></span>
          </button>
        </li>; })}
      </ol>
      <div className="site-how-screen"><ProductScreens scene={tick} compact allowZoom={false} /></div>
    </div>
  </div></section>;
}
