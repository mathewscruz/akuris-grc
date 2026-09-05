import { useId } from 'react';
import { useDemoPlayback } from '@/hooks/useDemoPlayback';
import { PublicMotionToggle } from './PublicMotionToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProductScreens, screenKeys } from './ProductScreens';

export function ProductStory() {
  const { t } = useLanguage();
  const { root, visible, motion } = useDemoPlayback({ steps: 1, autoplay: false });
  const marker = useId().replace(/:/g, '');
  return <section className="site-section product-story" id="produto"><div className="lp-container">
    <div className="site-heading"><h2>{t('site.storyTitle')}</h2><p>{t('site.storyIntro')}</p><PublicMotionToggle /></div>
    <div className="story-flow" ref={root} data-animate={visible && motion}>
      <svg className="story-connections" aria-hidden="true" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <defs><marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#aa94ff" strokeWidth="1.5" /></marker></defs>
        {['M 460 240 H 540', 'M 750 460 V 500 H 250 V 540', 'M 460 760 H 540'].map((d, n) => <g key={d}><path d={d} className="story-wire" vectorEffect="non-scaling-stroke" markerEnd={'url(#' + marker + ')'} /><path d={d} className="story-signal" vectorEffect="non-scaling-stroke" style={{ animationDelay: n * -1.5 + 's' }} /></g>)}
      </svg>
      {screenKeys.map((key, n) => <article className="story-stage" id={'story-' + n} key={key}>
        <header><span className="story-number">0{n + 1}</span><div><h3>{t('site.' + key)}</h3><p>{t(`site.storyScreen${n + 1}`)}</p></div></header>
        <ProductScreens scene={n} compact />
      </article>)}
    </div>
    <p className="product-caption">{t('site.screenNote')}</p>
  </div></section>;
}
