import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { PUBLIC_MODULES } from '@/lib/public-modules';
import { MODULE_ICON } from '@/lib/module-icons';
import { DemoButton } from '@/components/public/PublicShell';

export function ModuleCatalog() {
  const { t } = useLanguage();
  return <section className="site-section site-catalog" id="solucoes"><div className="lp-container">
    <div className="site-heading"><h2>{t('site.catalogTitle')}</h2><p>{t('site.catalogBody')}</p></div>
    <div className="catalog-compact">
      {(['Assess', 'Protect', 'Operate', 'Assets'] as const).map(group => {
        const modules = PUBLIC_MODULES.filter(module => module.group === group);
        const Icon = MODULE_ICON[modules[0].route];
        return <details className="catalog-area" key={group}>
          <summary><Icon className="h-6 w-6" /><div><h3>{t(`site.group${group}`)}</h3><p>{t(`site.group${group}Body`)}</p><span className="catalog-module-names">{modules.map(module => t('site.' + (module.title || module.key))).join(' · ')}</span><span className="catalog-expand"><span className="when-closed">{t('site.catalogExpand')}</span><span className="when-open">{t('site.catalogCollapse')}</span><span aria-hidden="true">＋</span></span></div></summary>
          <div className="catalog-area-content">
            <dl>{modules.map(module => <div key={module.key}><dt>{t('site.' + (module.title || module.key))}</dt><dd>{t('site.' + (module.body || module.key + 'Body'))}</dd></div>)}</dl>
            <DemoButton interest={modules[0].key} className="site-text-link" />
            {group === 'Assess' && <a className="site-text-link" href="#gap-analysis">{t('site.exploreGap')} ↑</a>}
            {group === 'Protect' && <Link className="site-text-link" to="/solucoes/canal-de-denuncias">{t('site.channel')} →</Link>}
          </div>
        </details>;
      })}
    </div>
    <p className="site-muted catalog-note">{t('site.solutionsBody')}</p>
  </div></section>;
}
