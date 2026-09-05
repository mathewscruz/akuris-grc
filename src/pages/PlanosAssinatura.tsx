import { useEffect, useState } from 'react';
import { PublicShell, DemoButton } from '@/components/public/PublicShell';
import { fetchPlanos, type Plano } from '@/lib/planos-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { SEO } from '@/components/SEO';
import { publicPlanPrice, planFeatureLabel } from '@/lib/public-plan';
export default function PlanosAssinatura() {
  const { t, locale } = useLanguage();
  const [annual, setAnnual] = useState(false);
  const [plans, setPlans] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    fetchPlanos().then(data => { if (active) setPlans(data); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const money = (value: number, currency: string) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-PT' : 'pt-BR', { style: 'currency', currency: /^[A-Z]{3}$/.test(currency) ? currency : 'BRL', maximumFractionDigits: 2 }).format(value);
  return <PublicShell>
    <SEO title={t('site.plans') + ' | Akuris'} description={t('site.planBody')} canonical="/planos" />
    <section className="site-section lp-container">
      <div className="site-heading"><p className="site-kicker">{t('site.plans')}</p><h1>{t('site.planTitle')}</h1><p>{t('site.planBody')}</p></div>
      {loading ? <p role="status">{t('publico.blog.carregando')}</p> : error ? <div role="alert" className="site-state"><p>{t('site.loadError')}</p><button className="site-text-link" onClick={() => setRetry(n => n + 1)}>{t('site.retry')}</button></div> : plans.length === 0 ? <div className="site-state"><p>{t('site.emptyPlans')}</p><DemoButton interest="plans" /></div> : <>
        <div className="site-plan-toggle" role="group" aria-label={t('site.plans')}><button aria-pressed={!annual} onClick={() => setAnnual(false)}>{t('site.monthly')}</button><button aria-pressed={annual} onClick={() => setAnnual(true)}>{t('site.annual')}</button></div>
        <div className="site-plan-grid">{plans.map(plan => {
          const pricing = publicPlanPrice(plan, annual);
          return <article className="site-plan" key={plan.id} data-featured={plan.is_destaque}>
            <div><h2>{plan.nome}</h2>{plan.is_destaque && <p>{t('site.featured')}</p>}</div>
            {plan.descricao && <p>{plan.descricao}</p>}
            <div>{pricing.monthly === null ? <p>{t('site.annualUnavailable')}</p> : <><strong className="site-plan-price">{money(pricing.monthly, plan.moeda)}</strong><span className="site-muted"> {t('site.perMonth')}</span>{pricing.annualTotal !== null && <><p>{t('site.monthlyEquivalent')}</p><p>{t('site.annualTotal', { price: money(pricing.annualTotal, plan.moeda) })}</p></>}</>}</div>
            <ul>{plan.recursos_destacados.map((feature, index) => <li key={index}>{planFeatureLabel(feature)}</li>)}</ul>
            {!!plan.preco_setup && <p>{t('site.setup', { price: money(plan.preco_setup, plan.moeda) })}{plan.setup_observacao ? ' · ' + plan.setup_observacao : ''}</p>}
            <DemoButton interest="plans" plan={plan.codigo} />
          </article>;
        })}</div>
        <div className="site-plan-compare" tabIndex={0} role="region" aria-label={t('site.compare')}><table><caption>{t('site.compare')}</caption><thead><tr><th scope="col">{t('site.plans')}</th>{plans.map(p => <th scope="col" key={p.id}>{p.nome}</th>)}</tr></thead><tbody>
          <tr><th scope="row">{t('site.users')}</th>{plans.map(p => <td key={p.id}>{p.limite_usuarios ?? t('site.unlimited')}</td>)}</tr>
          <tr><th scope="row">{t('site.credits')}</th>{plans.map(p => <td key={p.id}>{p.creditos_franquia}</td>)}</tr>
          {(['riscos', 'controles', 'privacidade', 'due_diligence', 'denuncia'] as const).map((module, i) => <tr key={module}><th scope="row">{t('site.' + ['risksScreen', 'controlsScreen', 'privacy', 'thirdParties', 'channel'][i])}</th>{plans.map(p => <td key={p.id}>{t(p.modulos_habilitados.includes(module) ? 'site.included' : 'site.notIncluded')}</td>)}</tr>)}
        </tbody></table></div>
      </>}
      <p className="site-muted mt-6">{t('site.priceNote')}</p>
    </section>
  </PublicShell>;
}
