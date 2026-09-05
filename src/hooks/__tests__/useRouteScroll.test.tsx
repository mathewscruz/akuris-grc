import { useRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRouteScroll } from '../useRouteScroll';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1600);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: function (position: ScrollToOptions) { this.scrollTop = position.top ?? 0; } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function Surface() {
  const ref = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  useRouteScroll(ref, true);
  return <main ref={ref} data-testid="surface"><button onClick={() => navigate('/outro')}>Outro módulo</button><button onClick={() => navigate(-1)}>Voltar</button><button onClick={() => navigate('?view=table', { replace: true })}>Recorte</button></main>;
}
it('voltar restaura o ponto da lista e uma nova página começa no topo', () => {
  render(<MemoryRouter initialEntries={[{ pathname: '/lista', key: 'scroll-list' }]}><Surface /></MemoryRouter>);
  const surface = screen.getByTestId('surface');
  surface.scrollTop = 520; fireEvent.scroll(surface);
  fireEvent.click(screen.getByRole('button', { name: 'Outro módulo' }));
  expect(surface.scrollTop).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
  expect(surface.scrollTop).toBe(520);
});
it('alterar apenas o recorte da mesma página não provoca salto ao topo', () => {
  render(<MemoryRouter initialEntries={[{ pathname: '/lista', key: 'scroll-query' }]}><Surface /></MemoryRouter>);
  const surface = screen.getByTestId('surface');
  surface.scrollTop = 350; fireEvent.scroll(surface);
  fireEvent.click(screen.getByRole('button', { name: 'Recorte' }));
  expect(surface.scrollTop).toBe(350);
});
