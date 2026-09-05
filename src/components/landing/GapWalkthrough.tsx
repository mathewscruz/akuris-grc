import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDemoPlayback } from '@/hooks/useDemoPlayback';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { GapAnalysisIcon, ControlesIcon, DocumentosIcon, IconCheck, IconLink, IconClose } from '@/components/icons';
import { DemoButton } from '@/components/public/PublicShell';
import logo from '@/assets/akuris-logo.png';
import './gap-demo-detail.css';

export function GapWalkthrough() {
  const { t } = useLanguage();
  const { tick, playing, setPlaying, root, running, motion, select: jump, interaction } = useDemoPlayback({ steps: 8 });
  const [displayTick, setDisplayTick] = useState(tick);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const phase = Math.min(3, Math.floor(tick / 2));
  const open = displayTick >= 1 && displayTick < 7;
  useEffect(() => {
    if (!running) { setDisplayTick(tick); return; }
    // The pointer reaches the target before the demonstration applies its action.
    const timer = window.setTimeout(() => setDisplayTick(tick), 800);
    return () => window.clearTimeout(timer);
  }, [tick, running]);
  useEffect(() => {
    const page = root.current?.querySelector<HTMLElement>('.gap-page');
    const target = page?.querySelector<HTMLElement>('[data-demo-target="' + ['requirement', 'requirement', 'control', 'evidence', 'evidence', 'assessment', 'assessment', 'close'][tick] + '"]');
    if (!page || !target) return;
    const measure = () => { const origin = page.getBoundingClientRect(), point = target.getBoundingClientRect(); setCursor({ x: point.left - origin.left + point.width * .65, y: point.top - origin.top + point.height * .6 }); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure); observer.observe(page);
    return () => observer.disconnect();
  }, [tick, root]);
  const select = (value: number) => jump([1, 2, 4, 6][value]);
  return <section className="site-section gap-spotlight" id="gap-analysis"><div className="lp-container">
    <div className="gap-intro"><div><p className="gap-module-name"><GapAnalysisIcon size={21} />{t('site.gap')}</p><h2>{t('site.gapTitle')}</h2></div><div><p>{t('site.gapBody')}</p><DemoButton interest="gap" className="site-text-link">{t('site.discuss')}</DemoButton></div></div>
    <div ref={root} className="gap-walkthrough" {...interaction}>
      <div className="gap-stage product-app light" data-tick={tick} data-running={running}>
        <aside className="gap-side"><img src={logo} alt="Akuris" width="114" height="34" /><div><GapAnalysisIcon size={20} /><span>{t('site.gap')}</span></div><p>ISO/IEC 27001</p><span>{t('site.risksScreen')}</span><span className="selected">{t('site.gap')}</span><span>{t('site.controlsScreen')}</span><span>{t('site.evidenceScreen')}</span></aside>
        <div className="gap-page"><div className="gap-page-header"><div><span>{t('site.gap')}</span><h3>ISO/IEC 27001</h3></div><p>{t('site.gapSlice')}</p></div>
          <div className="gap-journey" aria-label={t('site.storyNav')}>{['gapDiagnose', 'gapRemediate', 'gapProve'].map((key, n) => <span className={(phase === 0 ? n === 0 : phase === 1 ? n === 1 : n === 2) ? 'selected' : ''} key={key}><small>0{n + 1}</small>{t('site.' + key)}</span>)}</div>
          <div className="gap-overview"><div><span>{t('site.gapReviewed')}</span><strong>{displayTick >= 6 ? '3' : '2'}<small> / 3</small></strong><Progress value={displayTick >= 6 ? 100 : 200 / 3} aria-label={t('site.gapReviewed')} className="h-1.5" /></div><div><span>{t('site.controlsScreen')}</span><strong>{displayTick >= 2 ? '1' : '0'}</strong></div><div><span>{t('site.evidenceScreen')}</span><strong>{displayTick >= 4 ? '1' : '0'}</strong></div></div>
          <div className="gap-table-wrap"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>{t('site.gapRequirement')}</TableHead><TableHead>{t('site.status')}</TableHead></TableRow></TableHeader><TableBody>{['gapReq1', 'gapReq2', 'gapReq3'].map((key, n) => <TableRow key={key} data-selected={n === 0 && open}><TableCell><span className="entity-code">A.5.{[18, 15, 16][n]}</span></TableCell><TableCell>{n === 0 ? <button data-demo-target="requirement" className="product-record-button" onClick={() => select(0)}>{t('site.' + key)}</button> : t('site.' + key)}</TableCell><TableCell><StatusBadge tone={n === 0 ? displayTick >= 6 ? 'success' : 'neutral' : n === 1 ? 'success' : 'warning'}>{t('site.' + (n === 0 ? displayTick >= 6 ? 'gapCompliant' : 'gapNotReviewed' : n === 1 ? 'gapCompliant' : 'gapPartial'))}</StatusBadge></TableCell></TableRow>)}</TableBody></Table></div>
          <div className="gap-demo-summary">
            <div><span>{t('site.gapCoverage')}</span><strong>{displayTick >= 6 ? 3 : 2} / 3</strong><div className="gap-demo-coverage" aria-hidden="true"><i /><i /><i data-filled={displayTick >= 6} /></div><small>{t('site.gapScopeNote')}</small></div>
            <div className="gap-demo-trace"><ControlesIcon size={22} /><span><strong>{t('site.controlsScreen')}</strong><small>{t('site.grcRecord1')}</small></span><IconLink size={15} /><DocumentosIcon size={22} /><span><strong>{t('site.evidenceScreen')}</strong><small>{t('site.attachment')}</small></span></div>
          </div>
          <div className={'gap-record-panel ' + (open ? 'is-open' : '')} aria-hidden={!open} {...(!open ? { inert: '' } : {})}>
            <div className="gap-record-top"><div><span>A.5.18</span><h4>{t('site.gapReq1')}</h4></div><button data-demo-target="close" aria-label={t('site.closeRecord')} onClick={() => jump(7)}><IconClose size={18} /></button></div>
            <p>{t('site.grcNext')}</p>
            <div className="gap-record-tabs"><span className={phase === 0 ? 'selected' : ''}>{t('site.context')}</span><span className={phase === 1 ? 'selected' : ''}>{t('site.controlsScreen')}</span><span className={phase >= 2 ? 'selected' : ''}>{t('site.evidenceScreen')}</span></div>
            <div data-demo-target="control" className={'gap-link-row ' + (displayTick >= 2 ? 'is-shown' : '')}><ControlesIcon size={19} /><div><small>{t('site.controlsScreen')}</small><strong>{t('site.grcRecord1')}</strong></div><IconLink size={16} /></div>
            <div data-demo-target="evidence" className={'gap-link-row gap-file-row ' + (displayTick >= 3 ? 'is-shown' : '')}><DocumentosIcon size={20} /><div><small>{t('site.evidenceScreen')}</small><strong>{t('site.attachment')}</strong><Progress value={displayTick >= 4 ? 100 : 38} aria-label={t('site.evidenceScreen')} className="h-1" /></div>{displayTick >= 4 && <IconCheck size={17} />}</div>
            <div className="gap-assessor-review" data-reviewed={displayTick >= 5}><span>{displayTick >= 5 ? <IconCheck size={14} /> : <span className="gap-review-dot" />}</span><div><strong>{t('site.gapPendingReview')}</strong><small>{t('site.gapEvidenceReview')}</small></div></div>
            <div data-demo-target="assessment" className="gap-assessment"><span>{t('site.status')}</span><div><span className={displayTick < 6 ? 'current' : ''}>{t('site.gapNotReviewed')}</span><span className={displayTick >= 6 ? 'current is-complete' : ''}>{t('site.gapCompliant')}</span></div></div>
            <div className={'gap-saved ' + (displayTick >= 6 ? 'is-shown' : '')}><IconCheck size={16} />{t('site.gapRecorded')}</div>
          </div>
          {running && <div className="gap-demo-cursor" aria-hidden="true" style={{ transform: 'translate(' + cursor.x + 'px, ' + cursor.y + 'px)' }}><svg width="22" height="28" viewBox="0 0 22 28"><path d="M2 2v20l5-5 4 9 4-2-4-8h8Z" fill="#253449" stroke="white" strokeWidth="1.8" /></svg><i key={tick} /></div>}
        </div>
      </div>
      <div className="gap-playback"><div className="gap-playback-steps" role="group" aria-label={t('site.storyNav')}>{[0, 1, 2, 3].map(n => <button key={n} onClick={() => select(n)} aria-pressed={phase === n}><span>0{n + 1}</span>{t(`site.gapPhase${n + 1}`)}</button>)}</div>{motion && <button data-demo-play className="product-play" aria-pressed={playing} onClick={() => setPlaying(value => !value)}>{t(playing ? 'site.pause' : 'site.play')}</button>}</div>
      <p className="gap-caption">{t(`site.gapAction${phase + 1}`)}</p><p className="product-caption">{t('site.screenNote')}</p>
    </div>
    <div className="gap-capabilities">{['gapScope', 'gapEvaluate', 'gapTrace', 'gapProgress'].map(key => <span key={key}><IconCheck size={15} />{t('site.' + key)}</span>)}</div>
  </div></section>;
}
