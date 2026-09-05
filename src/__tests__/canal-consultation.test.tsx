import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DenunciaConsulta from '@/pages/DenunciaConsulta';
import { CanalEvidenceUpload } from '@/components/denuncia/CanalEvidenceUpload';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), upload: vi.fn(), toast: vi.fn(), channel: {
  estado: 'pronto', carregando: false, nomeDoCanal: 'Teste', empresa: { id: 'tenant', slug: 'test', nome: 'Teste', canal_ativo: true },
  config: { permitir_anonimas: true, requerer_email: false, permitir_reuniao: false },
} }));
vi.mock('@/hooks/useCanalDenuncia', () => ({ useCanalDenuncia: () => mocks.channel }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key, locale: 'pt-BR' }) }));
vi.mock('@/components/denuncia/CanalLayout', () => ({ CanalLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/denuncia/SolicitarReuniao', () => ({ SolicitarReuniao: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke }, storage: { from: () => ({ uploadToSignedUrl: mocks.upload }) } } }));
function mount() { render(<MemoryRouter initialEntries={['/test/denuncia/consulta']}><Routes><Route path="/:empresa/denuncia/consulta" element={<DenunciaConsulta />} /></Routes></MemoryRouter>); }
const caseData = { id: 'case-1', protocolo: 'TEST-2026', titulo: 'Relato fictício', status: 'recebida', created_at: '2026-09-01T12:00:00Z', categoria: null };
beforeEach(() => { mocks.invoke.mockReset(); mocks.upload.mockReset(); mocks.toast.mockReset(); });
afterEach(cleanup);
describe('private case access', () => {
  it('masks the code, clears access on exit, and does not put credentials in the URL', async () => {
    mocks.invoke.mockResolvedValue({ data: { denuncia: caseData }, error: null });
    mount();
    const code = screen.getByLabelText('publicPortal.denunciaConsulta.codeLabel');
    expect(code).toHaveAttribute('type', 'password');
    fireEvent.change(screen.getByLabelText('publicPortal.denunciaConsulta.protocolLabel'), { target: { value: 'test-2026' } });
    fireEvent.change(code, { target: { value: 'private-code' } });
    fireEvent.click(screen.getByRole('button', { name: 'publicPortal.denunciaConsulta.search' }));
    await screen.findByText('Relato fictício');
    expect(mocks.invoke.mock.calls[0][1].body).toMatchObject({ codigo: 'private-code', protocolo: 'TEST-2026' });
    expect(screen.getByText('canalExperience.extraEvidence')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'canalExperience.exitCase' }));
    expect(screen.getByLabelText('publicPortal.denunciaConsulta.codeLabel')).toHaveValue('');
    expect(screen.queryByText('Relato fictício')).not.toBeInTheDocument();
    expect(window.location.href).not.toContain('private-code');
  });
  it('preserves basic legacy access without exposing private actions', async () => {
    mocks.invoke.mockResolvedValue({ data: { denuncia: { protocolo: 'OLD-2020', status: 'recebida', created_at: '2020-01-01T12:00:00Z', acesso_legado_limitado: true } }, error: null });
    mount();
    fireEvent.change(screen.getByLabelText('publicPortal.denunciaConsulta.protocolLabel'), { target: { value: 'old-2020' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'publicPortal.denunciaConsulta.search' }));
    await screen.findByRole('button', { name: 'canalExperience.exitCase' });
    expect(mocks.invoke.mock.calls[0][1].body.codigo).toBe('');
    expect(screen.queryByText('canalExperience.extraEvidence')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('canalExperience.newMessage')).not.toBeInTheDocument();
  });
});
describe('additional evidence delivery', () => {
  it('only reports receipt after the server confirms the signed upload', async () => {
    mocks.invoke.mockImplementation((_fn, { body }) => Promise.resolve(body.action === 'anexo_url'
      ? { data: { token: 'signed', caminho: 'test/file.pdf', anexo_id: 'file-id' }, error: null }
      : { data: { error: 'invalid_signature' }, error: null }));
    mocks.upload.mockResolvedValue({ error: null });
    render(<CanalEvidenceUpload denunciaId="case-1" codigo="private-code" />);
    fireEvent.change(screen.getByLabelText('publicPortal.denunciaForm.attach'), { target: { files: [new File(['%PDF-test'], 'test.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'canalExperience.sendFiles' }));
    await screen.findByText('canalExperience.uploadFailed');
    expect(screen.queryByText('canalExperience.uploaded')).not.toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenLastCalledWith('create-denuncia', { body: { action: 'anexo_confirmar', denuncia_id: 'case-1', codigo: 'private-code', anexo_id: 'file-id' } });
    mocks.invoke.mockImplementation((_fn, { body }) => Promise.resolve({ data: body.action === 'anexo_url' ? { token: 'retry', caminho: 'test/retry.pdf', anexo_id: 'file-retry' } : { ok: true }, error: null }));
    fireEvent.click(screen.getByRole('button', { name: 'canalExperience.sendFiles' }));
    await waitFor(() => expect(screen.getByText('canalExperience.uploaded')).toBeVisible());
  });
});
