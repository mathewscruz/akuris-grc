import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RequirementDetailDialog } from '@/components/gap-analysis/dialogs/RequirementDetailDialog';
import { gapUi } from '@/i18n/modules/gap-ui';

const mocks = vi.hoisted(() => ({ writes: vi.fn(), onClose: vi.fn(), onOpenChange: vi.fn() }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string, params?: Record<string, unknown>) => {
  const value = key.split('.').reduce((node, part) => node?.[part], gapUi.pt as any) || key;
  return Object.entries(params || {}).reduce((text, [key, value]) => text.replaceAll('{' + key + '}', String(value)), value);
}, locale: 'pt-BR' }) }));
vi.mock('@/hooks/useEmpresaId', () => ({ useEmpresaId: () => ({ empresaId: 'tenant-test' }) }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ profile: { role: 'admin' } }) }));
vi.mock('@/hooks/useControleRequisitos', () => ({ useRequisitoControles: () => ({ data: new Map() }) }));
vi.mock('@/hooks/useOrientacaoRequisito', () => ({ useOrientacaoRequisito: () => ({ texto: '## 📋 Significado\nOrientação detalhada do requisito.', evidencias: '- Registro de revisão atual', perguntas: [{ pergunta: 'O controle é executado?', peso: 1 }, { pergunta: 'Há evidência atual?', peso: 1 }], estado: 'pronto', gerar: vi.fn() }) }));
vi.mock('@/contexts/DocGenContext', () => ({ useDocGen: () => ({ openDocGen: vi.fn() }) }));
vi.mock('@/components/gap-analysis/DocumentosDoRequisito', () => ({ DocumentosDoRequisito: () => <div>Documentos vinculados</div> }));
vi.mock('@/components/gap-analysis/dialogs/EvidenceReusePanel', () => ({ EvidenceReusePanel: () => <div>Biblioteca de evidências</div> }));
vi.mock('@/components/gap-analysis/AuditTrailTimeline', () => ({ AuditTrailTimeline: () => <div>Histórico preservado</div> }));
vi.mock('@/components/planos-acao/PlanoAcaoDialog', () => ({ PlanoAcaoDialog: () => null }));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  let write = false;
  const result = { data: [], count: 0, error: null };
  const chain: any = {
    select: () => chain, eq: () => chain, order: () => chain,
    insert: (payload: unknown) => { write = true; mocks.writes(table, payload); return chain; },
    update: (payload: unknown) => { write = true; mocks.writes(table, payload); return chain; },
    delete: () => chain,
    single: () => Promise.resolve({ data: write ? { id: 'evaluation-test', updated_at: '2026-09-05' } : null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
} } }));

beforeEach(() => {
  mocks.writes.mockReset(); mocks.onClose.mockReset(); mocks.onOpenChange.mockReset();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
});
afterEach(cleanup);
const show = (status = 'nao_avaliado') => render(<MemoryRouter><RequirementDetailDialog open onOpenChange={mocks.onOpenChange} requirement={{ id: 'req-test', codigo: '4.1', titulo: 'Contexto da organização', descricao: 'Identifique os fatores internos e externos relevantes ao escopo.', categoria: 'Gestão', area_responsavel: null, peso: 1, conformity_status: status }} frameworkId="framework-test" onClose={mocks.onClose} /></MemoryRouter>);

describe('requirement workspace', () => {
  it('starts with a concise brief, optional full guidance and one visible step', async () => {
    const { container } = show();
    await screen.findByText('O que este requisito pede');
    expect(container.ownerDocument.querySelectorAll('.requirement-panel:not([hidden])')).toHaveLength(1);
    expect(screen.queryByText('Orientação detalhada do requisito.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar orientação detalhada' }));
    expect(screen.getByRole('heading', { name: 'Significado' })).toBeVisible();
    expect(screen.getByText('Orientação detalhada do requisito.')).toBeVisible();
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it('keeps diagnostic answers when changing steps and does not auto-apply an incomplete recommendation', async () => {
    show();
    await screen.findByText('O que este requisito pede');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    const first = screen.getByRole('group', { name: 'O controle é executado?' });
    fireEvent.click(within(first).getByRole('button', { name: 'Sim' }));
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(within(screen.getByRole('group', { name: 'O controle é executado?' })).getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'true');
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it('explains that a gap needs a plan, owner and deadline and links back to pending work', async () => {
    show('parcial');
    await screen.findByText('O que este requisito pede');
    fireEvent.click(screen.getByRole('button', { name: /Revisar e encaminhar Pendências/ }));
    expect(screen.getByText('Necessário para tratar a lacuna')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Criar Plano de Ação' })).toBeVisible();
    expect(within(document.getElementById('requirement-panel-3')!).getByText(/não aprova automaticamente as evidências/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Responder todo o diagnóstico guiado.*Pendente/ }));
    await waitFor(() => expect(screen.getByRole('group', { name: 'O controle é executado?' })).toBeVisible());
  });
  it('closes a clean workspace without asking to discard changes', async () => {
    show();
    await screen.findByText('O que este requisito pede');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
  it('protects diagnostic answers when closing without saving', async () => {
    show();
    await screen.findByText('O que este requisito pede');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'O controle é executado?' })).getByRole('button', { name: 'Sim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(mocks.onOpenChange).not.toHaveBeenCalled();
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it('saves a draft without manufacturing a compliant status', async () => {
    show();
    await screen.findByText('O que este requisito pede');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(mocks.onClose).toHaveBeenCalledOnce());
    expect(mocks.writes).toHaveBeenCalledWith('gap_analysis_evaluations', expect.objectContaining({ conformity_status: 'nao_avaliado', empresa_id: 'tenant-test', requirement_id: 'req-test' }));
  });
});
