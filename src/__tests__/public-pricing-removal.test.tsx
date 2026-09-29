import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { PublicShell } from '@/components/public/PublicShell';
import PlanosAssinatura from '@/pages/PlanosAssinatura';
import { publicPages, publicPrerender } from '../../scripts/public-prerender';

const mocks = vi.hoisted(() => ({ fetchPlanos: vi.fn() }));
vi.mock('@/lib/planos-utils', () => ({ fetchPlanos: mocks.fetchPlanos }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/LanguageSelector', () => ({ LanguageSelector: () => <span>Language</span> }));
vi.mock('@/components/landing/DemoRequestDialog', () => ({
  DemoRequestDialog: ({ open, interest }: { open: boolean; interest: string }) =>
    open ? <div role="dialog" aria-label="Commercial contact">{interest}</div> : null,
}));

beforeEach(() => { mocks.fetchPlanos.mockReset(); vi.stubGlobal('scrollTo', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('public pricing removal', () => {
  it('removes pricing links from desktop, mobile and footer while keeping the demo CTA', () => {
    const { container } = render(<MemoryRouter><PublicShell><h1>Akuris</h1></PublicShell></MemoryRouter>);
    const assertNoPrices = () => {
      expect(container.querySelector('a[href="/planos"]')).toBeNull();
      expect(screen.queryByText('site.plans')).not.toBeInTheDocument();
    };
    assertNoPrices();
    fireEvent.click(screen.getByRole('button', { name: 'publico.landing.nav.menu' }));
    expect(container.querySelector('#public-menu')).toBeInTheDocument();
    assertNoPrices();
    expect(screen.getByRole('button', { name: /site.demoShort/ })).toBeEnabled();
  });

  it('routes old pricing bookmarks to the contact form without loading subscription prices', async () => {
    function Destination() {
      const location = useLocation();
      return <PublicShell><output>{location.pathname + location.search}</output></PublicShell>;
    }
    render(<MemoryRouter initialEntries={['/planos?old=campaign']}><Routes>
      <Route path="/planos" element={<PlanosAssinatura />} />
      <Route path="/" element={<Destination />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole('dialog', { name: 'Commercial contact' })).toHaveTextContent('plans');
    expect(screen.getByRole('status')).toHaveTextContent('/?demo=1&interest=plans');
    expect(mocks.fetchPlanos).not.toHaveBeenCalled();
  });

  it('does not publish a pricing page or pricing links in SEO assets and prerendered HTML', () => {
    expect(publicPages().some(page => page.path === '/planos')).toBe(false);
    for (const file of ['public/sitemap.xml', 'public/llms.txt']) {
      expect(readFileSync(file, 'utf8')).not.toContain('https://akuris.pt/planos');
    }
    expect(readFileSync('scripts/generate-sitemap.ts', 'utf8')).not.toContain("path: '/planos'");
    const bundle = { 'index.html': { type: 'asset', source: '<title>Akuris</title><div id="root"></div>' } };
    const emitFile = vi.fn();
    const hook = publicPrerender().generateBundle;
    if (typeof hook !== 'function') throw new Error('Expected a callable prerender hook');
    // Exercise the actual build hook without starting a server or querying customer data.
    Reflect.apply(hook, { emitFile }, [{}, bundle]);
    for (const asset of [bundle['index.html'], ...emitFile.mock.calls.map(([asset]) => asset)]) {
      expect(asset.source).not.toContain('href="/planos"');
    }
    expect(emitFile.mock.calls.some(([asset]) => asset.fileName === 'planos/index.html')).toBe(false);
  });
});
