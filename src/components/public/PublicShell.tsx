import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import akurisLogo from '@/assets/akuris-logo.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSelector } from '@/components/LanguageSelector';
const DemoRequestDialog = lazy(() => import('@/components/landing/DemoRequestDialog').then(module => ({ default: module.DemoRequestDialog })));
import { demoInterest, emitDemoEvent, type DemoInterest } from '@/lib/public-demo';
import '@/styles/public-site.css';

const DemoContext = createContext<(interest: DemoInterest, plan?: string) => void>(() => {});
export function DemoButton({ children, interest = 'general', plan, className = 'lp-btn lp-btn-primary' }: { children?: ReactNode; interest?: DemoInterest; plan?: string; className?: string }) {
  const open = useContext(DemoContext);
  const { t } = useLanguage();
  return <button type="button" className={className} onClick={() => open(interest, plan)}>{children || t('site.demo')}<span aria-hidden="true"> →</span></button>;
}
export function PublicShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [menu, setMenu] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const interest = demoInterest(params.get('interest'));
  const plan = (params.get('plan') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const open = params.get('demo') === '1';
  useEffect(() => {
    document.documentElement.classList.add('lp-html');
    return () => document.documentElement.classList.remove('lp-html');
  }, []);
  useEffect(() => { setMenu(false); }, [location.pathname]);
  useEffect(() => {
    if (!location.hash) { window.scrollTo({ top: 0, behavior: 'instant' }); return; }
    let id: string;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); toggle.current?.focus(); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menu]);
  useEffect(() => { if (open) { setDemoLoaded(true); emitDemoEvent('demo_open', interest); } }, [open, interest]);
  const requestDemo = (topic: DemoInterest, planCode?: string) => {
    lastTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMenu(false);
    setParams(p => { p.set('demo', '1'); p.set('interest', topic); if (planCode) p.set('plan', planCode); else p.delete('plan'); return p; }, { replace: true, preventScrollReset: true });
  };
  const repeatAnchor = (href: string) => {
    if (location.pathname === '/' && href === '/' + location.hash && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  };
  const links = [['/#produto', 'product'], ['/#solucoes', 'solutions'], ['/frameworks', 'guides'], ['/planos', 'plans'], ['/blog', 'content']] as const;
  return <DemoContext.Provider value={requestDemo}>
    <div className="lp-root public-site">
      <a href="#public-main" className="public-skip">{t('site.skip')}</a>
      <header className="public-header">
        <div className="lp-container public-header-inner">
          <Link to="/" onClick={() => { if (location.pathname === '/' && !location.hash) window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="Akuris" className="public-brand"><img src={akurisLogo} alt="Akuris" width="134" height="40" /></Link>
          <nav className="public-desktop-nav" aria-label={t('publico.landing.nav.principal')}>
            {links.map(([href, key]) => <Link key={href} to={href} onClick={() => repeatAnchor(href)} aria-current={location.pathname + location.hash === href ? 'location' : location.pathname === href ? 'page' : undefined}>{t('site.' + key)}</Link>)}
          </nav>
          <div className="public-header-actions">
            <span className="public-desktop-extra"><LanguageSelector variant="dark" /></span>
            <Link to="/auth" className="public-desktop-extra public-login">{t('publico.landing.nav.acessar')}</Link>
            <DemoButton><span>{t('site.demoShort')}</span></DemoButton>
            <button ref={toggle} type="button" className="public-menu-toggle" aria-label={t(menu ? 'site.closeMenu' : 'publico.landing.nav.menu')} aria-expanded={menu} aria-controls="public-menu" onClick={() => setMenu(!menu)}><span /><span /><span /></button>
          </div>
        </div>
        {menu && <nav id="public-menu" className="public-mobile-nav lp-container" aria-label={t('publico.landing.nav.principal')}>
          {links.map(([href, key]) => <Link key={href} to={href} onClick={() => { setMenu(false); repeatAnchor(href); }}>{t('site.' + key)}</Link>)}
          <Link to="/auth">{t('publico.landing.nav.acessar')}</Link><LanguageSelector variant="dark" />
        </nav>}
      </header>
      <main id="public-main" tabIndex={-1}>{children}</main>
      <footer className="public-footer lp-container">
        <div><Link to="/" aria-label="Akuris"><img src={akurisLogo} alt="Akuris" width="134" height="40" /></Link><p>{t('publico.landing.footer.tagline')}</p></div>
        <nav aria-label={t('publico.landing.footer.produto')}>
          <Link to="/planos">{t('site.plans')}</Link><Link to="/solucoes/canal-de-denuncias">{t('site.channel')}</Link><Link to="/migracao">{t('site.migration')}</Link>
        </nav>
        <nav aria-label={t('publico.landing.footer.empresa')}>
          <Link to="/seguranca">{t('site.trust')}</Link><Link to="/blog">{t('site.content')}</Link><Link to="/politica-privacidade">{t('publico.landing.footer.politica')}</Link>
        </nav>
        <div><a href="mailto:contato@akuris.com.br">contato@akuris.com.br</a><p>© {new Date().getFullYear()} Akuris</p></div>
      </footer>
      {(demoLoaded || open) && <Suspense fallback={<p role="status" className="public-demo-loading">{t('publico.blog.carregando')}</p>}><DemoRequestDialog open={open} interest={interest} plan={plan} source={location.pathname} onOpenChange={value => {
        if (!value) setParams(p => { p.delete('demo'); p.delete('interest'); p.delete('plan'); return p; }, { replace: true, preventScrollReset: true });
      }} onCloseAutoFocus={() => lastTrigger.current?.focus()} /></Suspense>}
    </div>
  </DemoContext.Provider>;
}
