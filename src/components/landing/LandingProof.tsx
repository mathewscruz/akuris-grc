import { useLanguage } from '@/contexts/LanguageContext';
import { FrameworkGlyph } from '@/components/frameworks/FrameworkGlyph';
import { PUBLIC_MODULES } from '@/lib/public-modules';
import { GapAnalysisIcon, ControlesIcon, DocumentosIcon, IconCheck } from '@/components/icons';

/** Valores reais do produto: catálogo global de frameworks e biblioteca de riscos. */
export const LANDING_STATS = { frameworks: 29, riscos: 82 } as const;
const TRUST_FRAMEWORKS = ['ISO/IEC 27001', 'SOC 2', 'LGPD', 'GDPR', 'NIST CSF', 'PCI DSS', 'BACEN 4.893'];

export function TrustStrip() {
  const { t } = useLanguage();
  return <section className="lp-container site-trust" aria-label={t('site.trustLabel')}>
    <p>{t('site.trustLabel')}</p>
    <ul>{TRUST_FRAMEWORKS.map(nome => <li key={nome}><FrameworkGlyph nome={nome} size={22} /><span>{nome}</span></li>)}</ul>
    <dl className="site-stats">
      <div><dt>{LANDING_STATS.frameworks}</dt><dd>{t('site.statFrameworks')}</dd></div>
      <div><dt>{LANDING_STATS.riscos}</dt><dd>{t('site.statRisks')}</dd></div>
      <div><dt>{PUBLIC_MODULES.length}</dt><dd>{t('site.statModules')}</dd></div>
    </dl>
  </section>;
}

export function HowItWorks() {
  const { t } = useLanguage();
  const icons = [GapAnalysisIcon, ControlesIcon, DocumentosIcon, IconCheck];
  return <section className="site-section site-how" id="produto"><div className="lp-container">
    <div className="site-heading"><h2>{t('site.howTitle')}</h2><p>{t('site.howBody')}</p></div>
    <ol>{[1, 2, 3, 4].map((n, i) => { const Icon = icons[i]; return <li key={n}><span className="site-how-num">0{n}</span><Icon size={22} /><h3>{t(`site.gapPhase${n}`)}</h3><p>{t(`site.gapAction${n}`)}</p></li>; })}</ol>
  </div></section>;
}
