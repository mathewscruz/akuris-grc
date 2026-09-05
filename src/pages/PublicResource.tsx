import { Link, useLocation } from 'react-router-dom';
import { PublicShell, DemoButton } from '@/components/public/PublicShell';
import { SEO } from '@/components/SEO';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PublicResource() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const type = pathname === '/migracao' ? 'migration' : pathname === '/seguranca' ? 'trust' : 'channel';
  const title = t('site.' + (type === 'trust' ? 'trustPageTitle' : type + 'Title'));
  const body = t('site.' + (type === 'trust' ? 'trustPageBody' : type + 'Body'));
  return <PublicShell>
    <SEO title={title + ' | Akuris'} description={body} canonical={pathname} />
    <section className="site-section site-resource lp-container">
      <div className="site-heading"><p className="site-kicker">{t('site.resourceEyebrow')}</p><h1>{title}</h1><p>{body}</p></div>
      {type === 'channel' && <p className="site-notice">{t('site.channelNotice')}</p>}
      {[1, 2, 3].map(n => <article key={n}><h2>{t('site.' + type + n)}</h2><p>{t('site.' + type + n + 'Body')}</p></article>)}
      {type === 'migration' && <section><h2>{t('site.checklist')}</h2><ul className="site-checklist">{[1, 2, 3, 4].map(n => <li key={n}>{t(`site.check${n}`)}</li>)}</ul></section>}
      {type === 'trust' && <p className="site-notice">{t('site.trustNotice')}</p>}
      <div className="site-actions"><DemoButton interest={type} /><Link to={type === 'trust' ? '/politica-privacidade' : '/planos'} className="site-text-link">{t(type === 'trust' ? 'publico.landing.footer.politica' : 'site.plans')} →</Link></div>
    </section>
  </PublicShell>;
}
