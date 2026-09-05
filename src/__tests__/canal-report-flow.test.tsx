import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DenunciaFormulario from '@/pages/DenunciaFormulario';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(), toastError: vi.fn(),
  channel: {
    estado: 'pronto', carregando: false, nomeDoCanal: 'Empresa de teste',
    empresa: { id: 'tenant-test', slug: 'test', nome: 'Empresa de teste', canal_ativo: true },
    config: { id: 'config-test', permitir_anonimas: true, requerer_email: false, politica_privacidade: 'Política de teste', avisar_denunciante_por_email: false },
  },
}));
vi.mock('@/hooks/useCanalDenuncia', () => ({ useCanalDenuncia: () => mocks.channel }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key, locale: 'pt-BR' }) }));
vi.mock('@/components/denuncia/CanalLayout', () => ({ CanalLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/ui/date-field', () => ({ DateField: () => <input aria-label="date" /> }));
vi.mock('@/lib/toast', () => ({ toast: { error: mocks.toastError } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: vi.fn().mockResolvedValue({ data: [{ id: 'cat-test', nome: 'Categoria teste' }], error: null }),
  functions: { invoke: mocks.invoke },
} }));

function mount() { render(<MemoryRouter initialEntries={['/test/denuncia/registrar']}><Routes><Route path="/:empresa/denuncia/registrar" element={<DenunciaFormulario />} /></Routes></MemoryRouter>); }
async function next() { fireEvent.click(screen.getByRole('button', { name: 'publicPortal.denunciaForm.avancarEtapa' })); }
async function firstStep() {
  await screen.findByRole('option', { name: 'Categoria teste' });
  fireEvent.change(screen.getByLabelText('publicPortal.denunciaForm.category'), { target: { value: 'cat-test' } });
  fireEvent.change(screen.getByLabelText('publicPortal.denunciaForm.title'), { target: { value: 'Relato fictício para teste' } });
  fireEvent.change(screen.getByLabelText('publicPortal.denunciaForm.description'), { target: { value: 'Descrição fictícia para validar o fluxo, sem envio real.' } });
  await next();
  await screen.findByRole('heading', { name: 'canalExperience.stage2' });
}
async function anonymousToReview() {
  await firstStep();
  fireEvent.click(screen.getByRole('radio', { name: /publicPortal.denunciaForm.nivel.anonima / }));
  await next();
  await screen.findByRole('heading', { name: 'canalExperience.stage3' });
  await next();
  await screen.findByRole('heading', { name: 'canalExperience.stage4' });
}
beforeEach(() => {
  mocks.invoke.mockReset(); mocks.toastError.mockReset();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('guided report submission', () => {
  it('opens the review without sending or validating the acceptance prematurely', async () => {
    mount(); await anonymousToReview();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(screen.getByText('Descrição fictícia para validar o fluxo, sem envio real.')).toBeVisible();
  });
  it('requires name at the identification step even while policy is still unchecked', async () => {
    mount(); await firstStep(); await next();
    await screen.findByText('publicPortal.denunciaForm.validation.nameRequired');
    expect(screen.getByRole('heading', { name: 'canalExperience.stage2' })).toBeVisible();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('only submits after final acceptance, prevents duplicate calls, and exposes an access receipt', async () => {
    let resolve!: (value: unknown) => void;
    mocks.invoke.mockImplementation(() => new Promise((done) => { resolve = done; }));
    mount(); await anonymousToReview();
    const submit = screen.getByRole('button', { name: 'publicPortal.denunciaForm.submit' });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submit); fireEvent.click(submit);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    expect(mocks.invoke.mock.calls[0][1].body).toMatchObject({ action: 'create', anonima: true, denunciante_nome: null, denunciante_email: null, denunciante_telefone: null, politica_aceita: true });
    resolve({ data: { id: 'new-report', protocolo: 'TEST-2026', codigo_acompanhamento: 'test-code' }, error: null });
    expect(await screen.findByRole('button', { name: 'canalExperience.downloadReceipt' })).toBeVisible();
    expect(screen.getByText('TEST-2026')).toBeVisible();
  });
  it('keeps the review available if the server rejects submission', async () => {
    mocks.invoke.mockResolvedValue({ data: { error: 'unavailable' }, error: null });
    mount(); await anonymousToReview();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'publicPortal.denunciaForm.submit' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('publicPortal.denunciaForm.createError'));
    expect(screen.getByText('Descrição fictícia para validar o fluxo, sem envio real.')).toBeVisible();
  });
});
