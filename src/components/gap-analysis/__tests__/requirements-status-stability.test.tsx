/* eslint-disable @typescript-eslint/no-explicit-any -- Boundary doubles around the real table. */
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GenericRequirementsTable } from '../GenericRequirementsTable';
import { PriorityQueueCard } from '../v2/PriorityQueueCard';
import { getFrameworkConfig } from '@/lib/framework-configs';
import { gapUi } from '@/i18n/modules/gap-ui';

const mock = vi.hoisted(() => ({ read: vi.fn(), catalogue: vi.fn(), statuses: new Map<string, string>(), failWrite: false, error: vi.fn() }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string, params?: Record<string, unknown>) => {
  const value = key.split('.').reduce((node, part) => node?.[part], gapUi.pt as any) || key;
  return Object.entries(params || {}).reduce((text, [key, value]) => text.replaceAll('{' + key + '}', String(value)), value);
} }) }));
vi.mock('@/lib/i18n-global', () => ({ tGlobal: (key: string) => key }));
vi.mock('@/lib/i18n-locale', () => ({ getAppLocale: () => 'pt' }));
vi.mock('@/hooks/useEmpresaId', () => ({ useEmpresaId: () => ({ empresaId: 'tenant', loading: false }) }));
vi.mock('@/hooks/useRiscoRequisitos', () => ({ useRequisitoRiscos: () => ({ data: new Map() }) }));
vi.mock('@/hooks/useControleRequisitos', () => ({ useRequisitoControles: () => ({ data: new Map() }) }));
vi.mock('@/lib/framework-requirements', () => ({ fetchFrameworkRequirements: () => mock.catalogue() }));
vi.mock('@/lib/supabase-paginate', () => ({ fetchAllPaginated: () => mock.read() }));
vi.mock('@/lib/gap-soa', () => ({ buscarForaDoEscopo: async () => new Set() }));
vi.mock('@/hooks/useScoreHistory', () => ({ saveScoreHistory: async () => {} }));
vi.mock('@/lib/toast', () => ({ toast: { error: (...args: unknown[]) => mock.error(...args), success: vi.fn() } }));
vi.mock('../ConformitySelect', () => ({ ConformitySelect: ({ value, onValueChange, disabled }: any) => <select aria-label="Status do requisito" value={value || 'nao_avaliado'} disabled={disabled} onChange={event => onValueChange(event.target.value)}>{['nao_avaliado', 'conforme', 'parcial', 'nao_conforme', 'nao_aplicavel'].map(status => <option key={status} value={status}>{status}</option>)}</select> }));
vi.mock('../dialogs/RequirementDetailDialog', () => ({ RequirementDetailDialog: (props: any) => props.open ? <div role="dialog" aria-label="Requisito aberto"><button onClick={() => { mock.statuses.set(props.requirement.id, 'conforme'); props.onStatusChange?.(props.requirement.id, 'conforme'); }}>Salvar status no diálogo</button><button onClick={props.onClose}>Salvar e fechar</button></div> : null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  let id = ''; let payload: any;
  const chain: any = {
    select: () => chain, order: () => chain,
    eq: (key: string, value: string) => { if (key === 'requirement_id' || key === 'id') id = value; return chain; },
    update: (value: unknown) => { payload = value; return chain; },
    maybeSingle: async () => ({ data: { id }, error: null }),
    then: (resolve: any) => {
      if (table === 'gap_analysis_evaluations' && payload && !mock.failWrite) mock.statuses.set(id, payload.conformity_status);
      return Promise.resolve({ data: [], error: payload && mock.failWrite ? new Error('write failed') : null }).then(resolve);
    },
  };
  return chain;
} } }));
const config = getFrameworkConfig('default')!;
const rows = Array.from({ length: 35 }, (_, index) => ({ id: `r${index + 1}`, codigo: `R-${String(index + 1).padStart(2, '0')}`, titulo: `Requisito ${index + 1}`, descricao: 'Descrição', categoria: 'Gestão', peso: 1 }));
const readResult = () => ({ data: rows.map(row => ({ requirement_id: row.id, conformity_status: mock.statuses.get(row.id) || 'nao_avaliado' })), error: null });
function Parent({ sectioned = false }: { sectioned?: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const location = useLocation();
  return <><output data-testid="location">{location.search}</output><GenericRequirementsTable frameworkId="fw" frameworkName="Framework de teste" config={sectioned ? { ...config, sections: [{ id: 'controls', title: 'Controles', filter: code => code?.startsWith('R-') ?? false }] } : config} refreshKey={refresh} onStatusChange={() => setRefresh(value => value + 1)} /></>;
}
const show = (url = '/framework?page=3', sectioned = false) => render(<MemoryRouter initialEntries={[url]}><Parent sectioned={sectioned} /></MemoryRouter>);
const row21 = () => screen.getByText('R-21').closest('tr')!;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  mock.read.mockReset(); mock.catalogue.mockReset(); mock.error.mockReset(); mock.statuses.clear(); mock.failWrite = false;
  mock.catalogue.mockResolvedValue(rows); mock.read.mockImplementation(async () => readResult());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('requirements keep their position after status changes', () => {
  it('keeps the expanded priority list above the table mounted during its refresh', async () => {
    const props = { frameworkId: 'fw', empresaId: 'tenant', limit: 6, onRequirementClick: vi.fn() };
    const view = render(<PriorityQueueCard {...props} refreshKey={0} />);
    await screen.findByText('Requisito 1');
    fireEvent.click(screen.getByRole('button', { name: 'executive.showMore' }));
    expect(screen.getByText('Requisito 6')).toBeVisible();
    const list = screen.getByRole('list');
    let release!: (value: unknown) => void;
    mock.catalogue.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    view.rerender(<PriorityQueueCard {...props} refreshKey={1} />);
    expect(screen.getByRole('list')).toBe(list);
    expect(screen.getByText('Requisito 6')).toBeVisible();
    await act(async () => release(rows));
    expect(screen.getByRole('list')).toBe(list);
    expect(screen.getByRole('button', { name: 'executive.showLess' })).toHaveAttribute('aria-expanded', 'true');
  });
  it.each([false, true])('opens the URL page and keeps the same table/row mounted during a saved-status refresh (sections=%s)', async sectioned => {
    show('/framework?page=3&q=Requisito', sectioned);
    await screen.findByText('R-21');
    const table = screen.getByRole('table'); const row = row21();
    let release!: (value: unknown) => void;
    mock.read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    fireEvent.change(within(row).getByRole('combobox', { name: 'Status do requisito' }), { target: { value: 'conforme' } });
    await waitFor(() => expect(mock.read).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('table')).toBe(table); expect(row21()).toBe(row);
    expect(screen.queryByText('Carregando requisitos...')).not.toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toContain('page=3');
    expect(screen.getByTestId('location').textContent).toContain('q=Requisito');
    await act(async () => release(readResult()));
    expect(screen.getByRole('table')).toBe(table);
    expect(within(row21()).getByRole('combobox', { name: 'Status do requisito' })).toHaveValue('conforme');
  });
  it('keeps the open requirement dialog through the refresh and preserves page three after saving it', async () => {
    show(); await screen.findByText('R-21');
    fireEvent.click(screen.getByText('R-21'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(screen.getByText('Salvar status no diálogo'));
    await waitFor(() => expect(mock.read).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('dialog')).toBe(dialog);
    fireEvent.click(screen.getByText('Salvar e fechar'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('R-21')).toBeVisible();
    expect(screen.getByTestId('location').textContent).toContain('page=3');
  });
  it('rolls back a failed status without losing the row or the page', async () => {
    show(); await screen.findByText('R-21'); mock.failWrite = true;
    const row = row21();
    fireEvent.change(within(row).getByRole('combobox'), { target: { value: 'conforme' } });
    await waitFor(() => expect(mock.error).toHaveBeenCalled());
    expect(row21()).toBe(row);
    expect(within(row).getByRole('combobox')).toHaveValue('nao_avaliado');
    expect(screen.getByTestId('location').textContent).toContain('page=3');
  });
  it('moves only to the nearest valid page when the last filtered item changes status', async () => {
    mock.catalogue.mockResolvedValue(rows.slice(0, 21));
    show('/framework?page=3&status=nao_avaliado'); await screen.findByText('R-21');
    fireEvent.change(within(row21()).getByRole('combobox'), { target: { value: 'conforme' } });
    await screen.findByText('R-11');
    expect(screen.getByTestId('location').textContent).toContain('page=2');
    expect(screen.getByTestId('location').textContent).toContain('status=nao_avaliado');
  });
  it('still resets pagination when the user deliberately changes the search', async () => {
    show(); await screen.findByText('R-21');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Requisito 1' } });
    await screen.findByText('R-01');
    expect(screen.getByTestId('location').textContent).not.toContain('page=3');
  });
});
