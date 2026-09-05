import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDemoPlayback } from '@/hooks/useDemoPlayback';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { IconExpand } from '@/components/icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RiscosIcon, ControlesIcon, DocumentosIcon, DashboardIcon } from '@/components/icons';
import logo from '@/assets/akuris-logo.png';
import { ProductSceneContent } from './ProductSceneContent';
import './product-scenes.css';

export const screenKeys = ['risksScreen', 'controlsScreen', 'evidenceScreen', 'dashboardScreen'] as const;
const icons = [RiscosIcon, ControlesIcon, DocumentosIcon, DashboardIcon];

/** Production presentation primitives, isolated from auth, queries and writes.
 * This is explicitly a demonstration, not a recording or a customer workspace. */
export function ProductScreens({ scene: controlledScene, autoplay = false, compact = false, allowZoom = true }: { scene?: number; autoplay?: boolean; compact?: boolean; allowZoom?: boolean }) {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(false);
  const controlled = controlledScene !== undefined;
  const { tick, setTick, playing, setPlaying, running, motion, root, select, interaction } = useDemoPlayback({ steps: controlled ? 4 : 16, autoplay: autoplay || controlled, loop: !controlled });
  const scene = controlledScene ?? Math.floor(tick / 4);
  const beat = tick % 4;
  useEffect(() => { if (controlled) setTick(0); }, [controlledScene, controlled, setTick]);
  const active = (n: number) => select(n * 4 + 3);
  return <div className={'product-film ' + (compact ? 'product-film-compact' : '')} ref={root} {...interaction}>
    <div className="product-app light" data-running={running} data-beat={beat}>
      <aside className="product-sidebar" aria-label={t('site.tourLabel')}>
        <img src={logo} alt="Akuris" width="96" height="29" />
        {screenKeys.map((key, n) => { const Icon = icons[n]; return controlledScene === undefined ? <button key={key} type="button" title={t('site.' + key)} aria-label={t('site.scene', { n: n + 1, name: t('site.' + key) })} aria-pressed={scene === n} onClick={() => active(n)}><Icon size={19} /><span>{t('site.' + key)}</span></button> : <div key={key} className={scene === n ? 'is-active' : ''}><Icon size={19} /><span>{t('site.' + key)}</span></div>; })}
      </aside>
      <div className="product-workspace">
        <div className="product-topbar"><span>{t('site.workspace')}</span><Avatar className="h-6 w-6"><AvatarFallback>DE</AvatarFallback></Avatar></div>
        <div className="product-scene" key={scene}>
          <div className="product-page-heading"><h3>{t('site.' + screenKeys[scene])}</h3><span className="product-page-path">{t('site.' + ['record', 'context', 'proof', 'recentActivity'][scene])}</span></div>
          <ProductSceneContent key={scene} scene={scene} beat={beat} motion={motion} pause={() => setPlaying(false)} />
        </div>
      </div>
    </div>
    <div className="product-film-controls">
      {allowZoom && compact && <button className="product-zoom" onClick={() => { setPlaying(false); setZoom(true); }} aria-label={t('site.enlargeScene', { name: t('site.' + screenKeys[scene]) })}><IconExpand size={14} />{t('site.enlarge')}</button>}
      {controlledScene === undefined && <div className="product-film-steps">{screenKeys.map((key, n) => <button key={key} onClick={() => active(n)} aria-label={t('site.scene', { n: n + 1, name: t('site.' + key) })} aria-pressed={n === scene}>{String(n + 1).padStart(2, '0')}</button>)}</div>}
      {(autoplay || controlled) && motion && <button data-demo-play className="product-play" aria-pressed={playing && !(controlled && tick === 3)} onClick={() => { if (controlled && tick === 3) { setTick(0); setPlaying(true); } else setPlaying(!playing); }}>{t(playing && !(controlled && tick === 3) ? 'site.pause' : 'site.play')}</button>}
    </div>
    {!compact && <p className="product-narration">{t('site.' + ['storyScreen1', 'storyScreen2', 'storyScreen3', 'storyScreen4'][scene])}</p>}
    {!compact && <p className="product-caption">{t('site.screenNote')}</p>}
    {allowZoom && <Dialog open={zoom} onOpenChange={setZoom}><DialogContent className="public-site product-zoom-dialog sm:max-w-4xl"><DialogTitle>{t('site.' + screenKeys[scene])}</DialogTitle><DialogDescription>{t('site.screenNote')}</DialogDescription><ProductScreens scene={scene} compact allowZoom={false} /></DialogContent></Dialog>}
  </div>;
}
