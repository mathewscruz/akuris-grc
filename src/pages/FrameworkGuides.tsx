import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '@/components/public/PublicShell';
import { SEO } from '@/components/SEO';
import { useLanguage } from '@/contexts/LanguageContext';
import { frameworksSeo } from '@/data/frameworks-seo';

export default function FrameworkGuides() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const guides = frameworksSeo.filter(f => normalize(f.nome + ' ' + f.categoria + ' ' + f.slug).includes(normalize(search.trim())));
  return <PublicShell><SEO title={t('site.guides') + ' | Akuris'} description={t('site.guideBody')} canonical="/frameworks" />
    <section className="site-section lp-container"><div className="site-heading"><h1>{t('site.guideTitle')}</h1><p>{t('site.guideBody')}</p></div>
      <label htmlFor="guide-search" className="sr-only">{t('site.searchGuide')}</label><input id="guide-search" className="site-search" type="search" placeholder={t('site.searchGuide')} value={search} onChange={e => setSearch(e.target.value)} />
      <div className="site-guides">{guides.map(f => <Link key={f.slug} to={'/frameworks/' + f.slug} className="site-guide"><strong>{f.nome}</strong><span aria-hidden="true">↗</span></Link>)}</div>
      {guides.length === 0 && <p role="status">{t('site.noGuides')}</p>}<p className="site-muted mt-6">{t('site.guidesNote')}</p>
    </section></PublicShell>;
}
