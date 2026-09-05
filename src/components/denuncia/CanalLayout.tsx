import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Fingerprint, CalendarCheck2, Signpost, Languages } from 'lucide-react';
import { useLanguage, type Locale } from '@/contexts/LanguageContext';
import { LOCALE_OPTIONS } from '@/components/LanguageSelector';
import type { ConfigCanal } from '@/hooks/useCanalDenuncia';
import type { EmpresaPublica } from '@/lib/denuncia-publica';
import akurisLogoLight from '@/assets/akuris-logo-light.png';
import './canal-public.css';

interface Props {
  empresa: EmpresaPublica | null;
  config: ConfigCanal | null;
  nomeDoCanal: string;
  estiloDaMarca?: React.CSSProperties;
  etapa?: string;
  voltarPara?: string;
  children: ReactNode;
  onNavigate?: React.MouseEventHandler<HTMLDivElement>;
}

/** Tenant-branded public shell. Never includes report data in page metadata. */
export function CanalLayout({ empresa, config, nomeDoCanal, estiloDaMarca, etapa, children, onNavigate }: Props) {
  const { t, locale, setLocale } = useLanguage();
  const { pathname } = useLocation();
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const base = empresa ? `/${empresa.slug}/denuncia` : '/denuncia';
  const links = [
    { to: base, label: t('canalExperience.about'), end: true },
    { to: `${base}/registrar`, label: t('canalExperience.register'), end: false },
    { to: `${base}/consulta`, label: t('canalExperience.track'), end: false },
  ];
  return (
    <div className="canal-public" style={estiloDaMarca} onClickCapture={onNavigate}>
      <Helmet>
        <title>{`${etapa || t('publicPortal.canal.titulo')} · ${nomeDoCanal || 'Akuris'}`}</title>
        <meta name="description" content={t('canalExperience.metaDescription')} />
        <meta name="robots" content="noindex,nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <a className="canal-skip" href="#canal-content">{t('canalExperience.skip')}</a>
      <header className="canal-header">
        <div className="canal-width canal-header-inner">
          <Link to={base} className="canal-brand" aria-label={`${nomeDoCanal} — ${t('canalExperience.about')}`}>
            {(!empresa || empresa.slug === 'akuris') ? (
              <img src={akurisLogoLight} width={650} height={195} alt="Akuris" />
            ) : empresa.logo_url && failedLogo !== empresa.logo_url ? (
              <img src={empresa.logo_url} alt={nomeDoCanal} onError={() => setFailedLogo(empresa.logo_url)} referrerPolicy="no-referrer" />
            ) : <span>{nomeDoCanal || 'Akuris'}</span>}
          </Link>
          <span className="canal-header-label">{t('publicPortal.canal.titulo')}</span>
          <label className="canal-language">
            <Languages aria-hidden="true" />
            <select aria-label={t('language.selector')} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              {LOCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </header>
      {empresa && <nav className="canal-nav" aria-label={t('canalExperience.navigation')}>
        <div className="canal-width">{links.map((link) => <NavLink key={link.to} to={link.to} end={link.end}>{link.label}</NavLink>)}</div>
      </nav>}
      <main id="canal-content" className="canal-width canal-main" key={pathname}>
        {etapa && <div className="canal-page-title"><p className="canal-eyebrow">{t('publicPortal.canal.titulo')}</p><h1>{etapa}</h1></div>}
        {children}
      </main>
      {config && <aside className="canal-width canal-rights" aria-label={t('publicPortal.canal.direitosTitulo')}>
        <article><Fingerprint aria-hidden="true" /><div><h2>{t('publicPortal.canal.direitoSigilo')}</h2><p>{config.permitir_anonimas && !config.requerer_email ? t('publicPortal.canal.direitoSigiloAnonimo') : t('publicPortal.canal.direitoSigiloIdentificado')}</p></div></article>
        <article><CalendarCheck2 aria-hidden="true" /><div><h2>{t('publicPortal.canal.direitoPrazo')}</h2><p>{t('publicPortal.canal.direitoPrazoTexto', { acusacao: config.prazo_acusacao_dias ?? 7, retorno: config.prazo_retorno_dias ?? 90 })}</p></div></article>
        <article><Signpost aria-hidden="true" /><div><h2>{t('publicPortal.canal.direitoExterno')}</h2><p>{config.orgao_externo_nome ? t('publicPortal.canal.direitoExternoTexto', { orgao: config.orgao_externo_nome }) : t('publicPortal.canal.direitoExternoSemOrgao')}</p>{config.orgao_externo_url && /^https?:\/\//i.test(config.orgao_externo_url) && <a href={config.orgao_externo_url} target="_blank" rel="noopener noreferrer">{config.orgao_externo_nome || t('publicPortal.canal.direitoExterno')}</a>}</div></article>
      </aside>}
      <footer className="canal-footer"><div className="canal-width">
        {config?.texto_retaliacao && <p><strong>{t('publicPortal.canal.retaliacaoTitulo')}</strong> {config.texto_retaliacao}</p>}
        <div className="canal-footer-line"><img className="canal-platform-logo" src={akurisLogoLight} width={650} height={195} alt="Akuris" loading="lazy" /><span>{nomeDoCanal || 'Akuris'} · {t('publicPortal.canal.titulo')}</span>{config?.retencao_meses ? <span>{t('publicPortal.canal.retencao', { meses: config.retencao_meses })}</span> : null}</div>
      </div></footer>
    </div>
  );
}
