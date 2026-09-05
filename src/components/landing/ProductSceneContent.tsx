import { useId, useState, type CSSProperties } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { ControlesIcon, RiscosIcon, DocumentosIcon, IconCheck, IconLink } from '@/components/icons';

const riskKeys = ['riskDemo', 'riskDemo2', 'riskDemo3'];
const severityKeys = ['high', 'medium', 'low'];
const riskTones = ['orange', 'warning', 'success'] as const;
const riskPoints = [{ impact: 4, probability: 3 }, { impact: 3, probability: 2 }, { impact: 2, probability: 1 }];

function DemoStats({ items }: { items: Array<[string, number]> }) {
  const { t } = useLanguage();
  return <div className="product-stat-row">{items.map(([key, value]) => <Card key={key}><CardContent className="p-3"><small>{t('site.' + key)}</small><strong>{value}</strong></CardContent></Card>)}</div>;
}

function RiskScene({ pause }: { pause: () => void }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(0);
  const point = riskPoints[selected];
  return <>
    <DemoStats items={[[ 'totalRisks', 3 ], ['high', 1], ['medium', 1]]} />
    <div className="demo-risk-workbench">
      <Card className="overflow-hidden"><Table><TableHeader><TableRow><TableHead>{t('site.risksScreen')}</TableHead><TableHead>{t('site.severity')}</TableHead></TableRow></TableHeader><TableBody>{riskKeys.map((key, n) => <TableRow key={key} data-demo-primary={selected === n}><TableCell><button className="product-record-button demo-risk-choice" onClick={() => { setSelected(n); pause(); }} aria-pressed={selected === n}><span className="entity-code">RSC-00{n + 1}</span>{t('site.' + key)}</button></TableCell><TableCell><StatusBadge tone={riskTones[n]}>{t('site.' + severityKeys[n])}</StatusBadge></TableCell></TableRow>)}</TableBody></Table></Card>
      <div className="demo-matrix-card"><strong>{t('site.riskMap')}</strong>
        <div className="demo-matrix" role="img" aria-label={t('site.riskPosition', { name: t('site.' + riskKeys[selected]), ...point })}>
          <span className="demo-matrix-y">{t('site.probability')}</span>
          <div className="demo-matrix-cells">{Array.from({ length: 25 }, (_, n) => { const impact = n % 5 + 1, probability = 5 - Math.floor(n / 5); return <i key={n} data-level={impact * probability >= 16 ? 'critical' : impact * probability >= 10 ? 'high' : impact * probability >= 5 ? 'medium' : 'low'} />; })}
            <span className="demo-matrix-marker" style={{ left: (point.impact - .5) * 20 + '%', top: (5.5 - point.probability) * 20 + '%' }}><span>0{selected + 1}</span></span>
          </div><span className="demo-matrix-x">{t('site.impact')}</span>
        </div>
      </div>
    </div>
    <div className="demo-context-line"><RiscosIcon size={15} /><span>{t('site.riskContext')}</span></div>
  </>;
}

function ControlScene({ beat, pause }: { beat: number; pause: () => void }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState(0);
  const tabsId = useId();
  return <Card><CardContent className="p-4 space-y-4">
    <div className="product-record-heading"><ControlesIcon size={22} /><div><small className="entity-code">CTRL-001</small><strong>{t('site.grcRecord1')}</strong></div><StatusBadge tone="success">{t('site.active')}</StatusBadge></div>
    <div className="product-fields">{[['owner', 'teamSecurity'], ['frequency', 'monthlyReview'], ['controlType', 'preventive']].map(([label, value]) => <div key={label}><small>{t('site.' + label)}</small><strong>{t('site.' + value)}</strong></div>)}</div>
    <div className="demo-execution"><div><strong>{t('site.execution')}</strong><span>{Math.min(beat, 3)} / 3</span></div><ol>{['reviewScope', 'reviewAccounts', 'recordDecision'].map((key, n) => <li key={key} data-done={beat > n}><span>{beat > n ? <IconCheck size={13} /> : n + 1}</span><strong>{t('site.' + key)}</strong></li>)}</ol><Progress value={beat / 3 * 100} aria-label={t('site.execution')} className="h-1" /></div>
    <div className="product-native-tabs demo-content-tabs" role="tablist" aria-label={t('site.controlTrace')}>{['linkedRisk', 'evidenceScreen'].map((key, n) => <button key={key} id={tabsId + '-tab-' + n} role="tab" aria-selected={tab === n} aria-controls={tabsId + '-panel'} tabIndex={tab === n ? 0 : -1} onClick={() => { setTab(n); pause(); }} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : 1 - tab; setTab(next); pause(); (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus(); } }}>{n === 0 ? <RiscosIcon size={14} /> : <DocumentosIcon size={14} />}{t('site.' + key)}</button>)}</div>
    <div className="product-linked-item demo-related-record" role="tabpanel" id={tabsId + '-panel'} aria-labelledby={tabsId + '-tab-' + tab} tabIndex={0}>{tab === 0 ? <RiscosIcon size={18} /> : <DocumentosIcon size={18} />}<div><small>{tab === 0 ? 'RSC-001' : 'PDF · v1.0'}</small><strong>{t(tab === 0 ? 'site.riskDemo' : 'site.attachment')}</strong></div><IconLink size={15} /></div>
  </CardContent></Card>;
}

function EvidenceScene({ beat }: { beat: number }) {
  const { t } = useLanguage();
  return <div className="demo-evidence-desk">
    <div className="demo-document-viewer">
      <header><DocumentosIcon size={16} /><span>{t('site.attachment')}</span><small>PDF</small></header>
      <div className="demo-paper" aria-label={t('site.readDocument')}>
        <div className="demo-paper-brand"><span>AKURIS</span><small>{t('site.demoAccounts')}</small></div>
        <strong>{t('site.accessReport')}</strong><p>{t('site.teamSecurity')} · {t('site.monthlyReview')}</p>
        <div className="demo-paper-rule" />
        <div className="demo-paper-table"><div><strong>{t('site.reviewItem')}</strong><strong>{t('site.reviewDecision')}</strong></div>{[0, 1, 2].map(n => <div key={n} data-reviewed={beat > n}><span>{t('site.demoAccount')} 0{n + 1}</span><span><IconCheck size={11} />{t(n === 2 ? 'site.reviewRevoke' : 'site.reviewKeep')}</span></div>)}</div>
        <div className="demo-paper-signature"><i /><span>{t('site.recordDecision')}</span></div>
        <div className="demo-paper-scan" aria-hidden="true" />
      </div>
      <footer>{t('site.documentPage')}<span>{t('site.documentVersion')} 1.0</span></footer>
    </div>
    <div className="demo-evidence-links"><strong>{t('site.evidenceTrail')}</strong><div><ControlesIcon size={18} /><span><small>CTRL-001</small>{t('site.grcRecord1')}</span></div><div><IconLink size={17} /><span><small>ISO/IEC 27001</small>A.5.18 · {t('site.gapReq1')}</span></div><p><IconCheck size={14} />{t('site.attachmentReady')}</p></div>
  </div>;
}

function DashboardScene({ beat, pause }: { beat: number; pause: () => void }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<number | null>(null);
  return <>
    <DemoStats items={[[ 'totalRisks', 3 ], ['totalControls', 1], ['totalEvidence', 1]]} />
    <div className="demo-dashboard-grid">
      <Card><CardContent className="p-4"><strong className="demo-chart-title">{t('site.portfolio')}</strong><div className="demo-donut-wrap"><svg className="demo-donut" viewBox="0 0 160 160" role="img" aria-label={t('site.portfolioNote')}><circle cx="80" cy="80" r="58" fill="none" stroke="#edf0f6" strokeWidth="15" />{['#c55a18', '#b98916', '#368278'].map((color, n) => <circle key={color} className="demo-donut-segment" cx="80" cy="80" r="58" fill="none" stroke={color} strokeWidth={selected === n ? 19 : 15} pathLength="100" strokeDasharray="31 69" strokeDashoffset={-n * 33.333} transform="rotate(-90 80 80)" style={{ opacity: selected === null || selected === n ? 1 : .24, '--segment': n } as CSSProperties} />)}<text x="80" y="78" textAnchor="middle">3</text><text x="80" y="100" textAnchor="middle" className="demo-donut-caption">{t('site.risksScreen')}</text></svg><div className="demo-chart-legend">{severityKeys.map((key, n) => <button key={key} aria-pressed={selected === n} onClick={() => { setSelected(selected === n ? null : n); pause(); }}><i data-tone={key} /><span>{t('site.' + key)}</span><strong>1</strong></button>)}</div></div></CardContent></Card>
      <Card><CardContent className="p-4"><strong className="demo-chart-title">{t('site.recentActivity')}</strong><ol className="demo-activity-timeline">{['controlLinked', 'evidenceLinked', 'reviewScheduled'].map((key, n) => <li key={key} data-ready={beat >= n}><span>{n === 0 ? <ControlesIcon size={14} /> : n === 1 ? <DocumentosIcon size={14} /> : <IconCheck size={14} />}</span><div><strong>{t('site.' + key)}</strong><small>{['CTRL-001', 'A.5.18', t('site.monthlyReview')][n]}</small></div></li>)}</ol></CardContent></Card>
    </div>
  </>;
}

/** Rich, deterministic fixtures only. Never queries customer records. */
export function ProductSceneContent({ scene, beat, motion, pause }: { scene: number; beat: number; motion: boolean; pause: () => void }) {
  const progress = motion ? beat : 3;
  if (scene === 0) return <RiskScene pause={pause} />;
  if (scene === 1) return <ControlScene beat={progress} pause={pause} />;
  if (scene === 2) return <EvidenceScene beat={progress} />;
  return <DashboardScene beat={progress} pause={pause} />;
}
