import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { dictionaryFor } from '@/lib/dictionary-registry';
import { DemoRequestDialog } from '@/components/landing/DemoRequestDialog';
import { ProductStory } from '@/components/landing/ProductStory';
import { ProductSceneContent } from '@/components/landing/ProductSceneContent';
import { ModuleCatalog } from '@/components/landing/ModuleCatalog';
import { GapWalkthrough } from '@/components/landing/GapWalkthrough';
import { useDemoPlayback } from '@/hooks/useDemoPlayback';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), motion: true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/lib/motion-preferences', () => ({ useMotionAllowed: () => mocks.motion, useMotionPreference: () => ({ selected: false, systemReduced: !mocks.motion, setSelected: vi.fn() }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ locale: 'pt-BR', t: (key: string) => key.split('.').reduce((value, part) => value?.[part], dictionaryFor('pt-BR') as any) || key }) }));

let observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void>;
beforeEach(() => {
  mocks.invoke.mockReset(); mocks.motion = true; observers = [];
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof observers[number]) { observers.push(callback); }
    observe() {} unobserve() {} disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const visible = (value = true) => act(() => observers.forEach(callback => callback([{ isIntersecting: value }])));

describe('landing demonstrations and module overview', () => {
  it('renders all four scenes concurrently, connected in reading order', () => {
    const { container } = render(<ProductStory />);
    expect(container.querySelectorAll('.story-stage')).toHaveLength(4);
    expect(container.querySelectorAll('.product-app')).toHaveLength(4);
    expect(container.querySelectorAll('.story-connections .story-wire')).toHaveLength(3);
    expect(container.querySelector('.story-screen')).toBeNull();
  });
  it('lets visitors explore risk context, control evidence and dashboard segments', () => {
    mocks.motion = false;
    const pause = vi.fn();
    const { container, rerender } = render(<ProductSceneContent scene={0} beat={0} motion={false} pause={pause} />);
    const marker = container.querySelector<HTMLElement>('.demo-matrix-marker')!;
    expect(marker.style.left).toBe('70%');
    fireEvent.click(screen.getByRole('button', { name: /RSC-002/ }));
    expect(marker.style.left).toBe('50%');
    expect(pause).toHaveBeenCalledOnce();
    rerender(<ProductSceneContent scene={1} beat={0} motion={false} pause={pause} />);
    expect(container.querySelectorAll('.demo-execution [data-done=true]')).toHaveLength(3);
    fireEvent.click(screen.getByRole('tab', { name: 'Evidências' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Revisao-de-acessos.pdf');
    rerender(<ProductSceneContent scene={3} beat={0} motion={false} pause={pause} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alto 1' }));
    expect(screen.getByRole('button', { name: 'Alto 1' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('keeps four compact summaries and makes module detail optional', () => {
    const { container } = render(<MemoryRouter><ModuleCatalog /></MemoryRouter>);
    const areas = container.querySelectorAll('details');
    expect(areas).toHaveLength(4);
    expect(container.querySelectorAll('details[open]')).toHaveLength(0);
    expect(container.querySelectorAll('dt')).toHaveLength(22);
    fireEvent.click(areas[0].querySelector('summary')!);
    expect(areas[0]).toHaveAttribute('open');
    expect(container.querySelectorAll('details[open]')).toHaveLength(1);
  });
  it('allows manual Gap exploration with reduced motion and hides the closed record from focus', () => {
    mocks.motion = false;
    const { container } = render(<GapWalkthrough />);
    const panel = container.querySelector('.gap-record-panel')!;
    expect(panel).toHaveAttribute('inert');
    expect(screen.queryByRole('button', { name: 'Pausar demonstração' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '04 Avaliação' }));
    expect(panel).not.toHaveAttribute('inert');
    expect(screen.getByText('Avaliação demonstrativa registrada')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à lista' }));
    expect(panel).toHaveAttribute('aria-hidden', 'true');
  });
  it('only advances on-screen, and pauses during hover and keyboard exploration', () => {
    vi.useFakeTimers();
    function Harness() {
      const demo = useDemoPlayback({ steps: 4, interval: 1000 });
      return <div ref={demo.root} {...demo.interaction} data-testid="demo"><output>{demo.tick}</output><button onClick={() => demo.select(3)}>Explore</button></div>;
    }
    render(<Harness />);
    act(() => vi.advanceTimersByTime(2000)); expect(screen.getByRole('status')).toHaveTextContent('0');
    visible(); act(() => vi.advanceTimersByTime(1000)); expect(screen.getByRole('status')).toHaveTextContent('1');
    fireEvent.mouseEnter(screen.getByTestId('demo')); act(() => vi.advanceTimersByTime(3000)); expect(screen.getByRole('status')).toHaveTextContent('1');
    fireEvent.mouseLeave(screen.getByTestId('demo')); act(() => vi.advanceTimersByTime(1000)); expect(screen.getByRole('status')).toHaveTextContent('2');
    fireEvent.focus(screen.getByRole('button')); act(() => vi.advanceTimersByTime(2000)); expect(screen.getByRole('status')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button')); expect(screen.getByRole('status')).toHaveTextContent('3');
    visible(false); act(() => vi.advanceTimersByTime(3000)); expect(screen.getByRole('status')).toHaveTextContent('3');
  });
});

describe('demo request form', () => {
  const show = () => render(<DemoRequestDialog open interest="gap" source="/" onOpenChange={() => {}} />);
  const fill = () => {
    fireEvent.change(document.getElementById('demo-name')!, { target: { value: 'Equipe Demo' } });
    fireEvent.change(document.getElementById('demo-email')!, { target: { value: 'demo@example.test' } });
    fireEvent.change(document.getElementById('demo-company')!, { target: { value: 'Organização fictícia' } });
    fireEvent.change(document.getElementById('demo-companySize')!, { target: { value: '1-50' } });
  };
  it('focuses the first invalid field without sending an empty request', async () => {
    show(); fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(document.getElementById('demo-name')).toHaveFocus());
    expect(document.getElementById('demo-name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toBeVisible();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('preserves form data and request id when retrying a failed submission', async () => {
    mocks.invoke.mockResolvedValueOnce({ error: new Error('offline') }).mockResolvedValue({ data: { success: true, registered: true } });
    show(); fill(); fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(document.getElementById('demo-email')).toHaveValue('demo@example.test');
    fireEvent.submit(document.querySelector('form')!);
    await screen.findByText('Pedido registrado');
    const first = mocks.invoke.mock.calls[0][1].body, second = mocks.invoke.mock.calls[1][1].body;
    expect(first.requestId).toBe(second.requestId);
    expect(first).toMatchObject({ interest: 'gap', source: '/', locale: 'pt-BR' });
  });
  it('prevents simultaneous duplicate submissions and rejects a false success response', async () => {
    let finish!: (value: unknown) => void;
    mocks.invoke.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    show(); fill(); const form = document.querySelector('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(form).toHaveAttribute('aria-busy', 'true');
    await act(async () => finish({ data: { success: false } }));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.queryByText('Pedido registrado')).not.toBeInTheDocument();
  });
});
