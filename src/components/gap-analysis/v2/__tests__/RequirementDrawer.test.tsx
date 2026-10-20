import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequirementDrawer } from '../RequirementDrawer';
import { scopedDraftKey } from '@/hooks/useWizardDraft';
import { answerFingerprint } from '@/lib/gap-analysis/requirement-draft';

const mock = vi.hoisted(() => ({
  saved: { id: 'ev1', conformity_status: 'conforme', observacoes: 'Saved answer', prazo_implementacao: null, responsavel_avaliacao: null },
  update: vi.fn(), evidenceMount: vi.fn(), reviewMount: vi.fn(),
  guidance: { texto: 'Existing plain guidance', evidencias: '- Policy', perguntas: [], estado: 'ok', gerar: vi.fn() },
}));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user1' }, profile: { empresa_id: 'tenant1' } }) }));
vi.mock('@/hooks/useOrientacaoRequisito', () => ({ useOrientacaoRequisito: () => mock.guidance }));
vi.mock('@/lib/gap-i18n', () => ({ localizeRequirement: (row: unknown) => row }));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/frameworks/FrameworkBadge', () => ({ FrameworkBadge: () => null }));
vi.mock('@/components/riscos/UserSelect', () => ({ UserSelect: () => null }));
vi.mock('@/components/ui/date-field', () => ({ DateField: () => null }));
vi.mock('@/components/gap-analysis/DocumentosDoRequisito', () => ({ DocumentosDoRequisito: () => null }));
vi.mock('../EvidenciasEsperadasLista', () => ({ EvidenciasEsperadasLista: () => null, useMarcacoesEvidencia: () => ({ data: [] }) }));
vi.mock('@/components/gap-analysis/dialogs/EvidenceReusePanel', () => ({ EvidenceReusePanel: () => {
  useEffect(() => { mock.evidenceMount(); }, []);
  return <div>Evidence library</div>;
} }));
vi.mock('@/components/gap-analysis/RequirementReviewPanel', () => ({ RequirementReviewPanel: () => {
  useEffect(() => { mock.reviewMount(); }, []);
  return <div>Review panel</div>;
} }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  const result = () => ({ data: table === 'gap_analysis_requirements'
    ? { id: 'r1', titulo: 'Requirement', descricao: 'Description', codigo: '1.1', framework_id: 'fw1' }
    : table === 'gap_analysis_evaluations' ? { ...mock.saved }
    : table === 'gap_analysis_frameworks' ? { nome: 'ISO 27001' } : [], error: null });
  const query: any = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
  for (const method of ['select', 'eq']) query[method] = () => query;
  query.maybeSingle = async () => result();
  query.update = (payload: unknown) => { mock.update(payload); return query; };
  return query;
} } }));

const key = scopedDraftKey('tenant1', 'user1', 'gap-req-r1');
const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><RequirementDrawer asPage open onOpenChange={() => {}} requirementId="r1" empresaId="tenant1" /></QueryClientProvider>);
}
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  mock.saved = { id: 'ev1', conformity_status: 'conforme', observacoes: 'Saved answer', prazo_implementacao: null, responsavel_avaliacao: null };
  mock.guidance.estado = 'ok';
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });
async function loaded() { return screen.findByLabelText('gapUi.drawer.justification'); }
async function debounce() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)); }); }

describe('requirement answer persistence and stable evidence panels', () => {
  it('opening an unchanged answer leaves no browser draft', async () => {
    mount(); await loaded(); await debounce();
    expect(localStorage.getItem(key)).toBeNull();
  });
  it('ignores legacy snapshots and saves the current server answer', async () => {
    localStorage.setItem(key, JSON.stringify({ conformity_status: 'nao_conforme', observacoes: 'Old snapshot' }));
    mount();
    expect(await loaded()).toHaveValue('Saved answer');
    fireEvent.click(screen.getByRole('button', { name: 'gapUi.drawer.save' }));
    await waitFor(() => expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ conformity_status: 'conforme', observacoes: 'Saved answer' })));
  });
  it('restores real edits only when their saved baseline has not changed', async () => {
    localStorage.setItem(key, JSON.stringify({ version: 1, base: answerFingerprint(mock.saved), values: answerFingerprint({ ...mock.saved, observacoes: 'My unfinished edit' }) }));
    const first = mount();
    expect(await loaded()).toHaveValue('My unfinished edit');
    first.unmount();
    mock.saved = { ...mock.saved, conformity_status: 'parcial', observacoes: 'Colleague update' };
    mount();
    expect(await loaded()).toHaveValue('Colleague update');
    expect(screen.getByRole('radio', { name: 'gapUi.drawer.status.parcial' })).toHaveAttribute('aria-checked', 'true');
  });
  it('persists edited fields with their baseline and removes a reverted draft', async () => {
    mount(); const input = await loaded();
    fireEvent.change(input, { target: { value: 'Real edit' } }); await debounce();
    expect(JSON.parse(localStorage.getItem(key) || '{}')).toEqual({ version: 1, base: answerFingerprint(mock.saved), values: answerFingerprint({ ...mock.saved, observacoes: 'Real edit' }) });
    fireEvent.change(input, { target: { value: 'Saved answer' } });
    await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
  });
  it('keeps open sections and evidence mounts intact while editing and changing status', async () => {
    mount(); const input = await loaded();
    const reuse = screen.getByText('gapUi.drawer.reuseEvidence').closest('details');
    const review = screen.getByText('gapUi.drawer.reviewAndPlan').closest('details');
    if (!reuse || !review) throw new Error('Missing evidence panels');
    reuse.open = true; review.open = true;
    fireEvent.change(input, { target: { value: 'Updated' } });
    fireEvent.change(input, { target: { value: 'Updated again' } });
    fireEvent.click(screen.getByRole('radio', { name: 'gapUi.drawer.status.parcial' }));
    expect(reuse.open).toBe(true); expect(review.open).toBe(true);
    expect(mock.evidenceMount).toHaveBeenCalledTimes(1);
    expect(mock.reviewMount).toHaveBeenCalledTimes(1);
  });
  it('retains saved plain guidance without a general failure message when completion fails', async () => {
    mock.guidance.estado = 'falha';
    mount(); await loaded();
    expect(screen.getByText('Existing plain guidance')).toBeInTheDocument();
    expect(screen.queryByText('gapUi.detail.guidanceFalhou')).not.toBeInTheDocument();
  });
});