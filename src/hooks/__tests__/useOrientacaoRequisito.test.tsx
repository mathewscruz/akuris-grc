import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrientacaoRequisito } from '../useOrientacaoRequisito';

const mock = vi.hoisted(() => ({ locale: 'pt-BR', read: vi.fn(), invoke: vi.fn() }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ locale: mock.locale }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: (_key: string, id: string) => ({ abortSignal: () => ({ single: () => mock.read(id) }) }) }) }),
  functions: { invoke: (...args: unknown[]) => mock.invoke(...args) },
} }));
const clients: QueryClient[] = [];
const saved = { orientacao_implementacao: '## Faça nesta ordem\n- Texto salvo', exemplos_evidencias: '- Política aprovada', perguntas_diagnostico: '[{"pergunta":"A política foi aprovada?","peso":2}]' };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });
beforeEach(() => {
  mock.locale = 'pt-BR'; mock.read.mockReset(); mock.invoke.mockReset();
  mock.read.mockResolvedValue({ data: saved, error: null });
});
describe('orientação compartilhada entre as superfícies', () => {
  it('reutiliza a consulta e não chama IA para conteúdo já gravado', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => [useOrientacaoRequisito('r1'), useOrientacaoRequisito('r1')], { wrapper });
    await waitFor(() => expect(result.current.every(g => g.estado === 'ok')).toBe(true));
    expect(mock.read).toHaveBeenCalledTimes(1); expect(mock.invoke).not.toHaveBeenCalled();
  });
  it('pede geração apenas quando falta a orientação do idioma', async () => {
    mock.locale = 'en';
    mock.invoke.mockResolvedValue({ data: { ...saved, orientacao_implementacao: '## Do this in order\n- Saved English' }, error: null });
    const { result } = renderHook(() => useOrientacaoRequisito('r1'), setup());
    await waitFor(() => expect(result.current.texto).toContain('Saved English'));
    expect(mock.invoke).toHaveBeenCalledWith('populate-requirement-guidance', { body: { requirement_id: 'r1', locale: 'en', force: false } });
  });
  it('não usa o texto do requisito anterior enquanto a próxima consulta carrega', async () => {
    mock.read.mockImplementation((id) => id === 'r1' ? Promise.resolve({ data: { ...saved, orientacao_implementacao: '## Faça nesta ordem\nPrimeiro' } }) : new Promise(() => {}));
    const { result, rerender } = renderHook(({ id }) => useOrientacaoRequisito(id), { ...setup(), initialProps: { id: 'r1' } });
    await waitFor(() => expect(result.current.texto).toContain('Primeiro'));
    rerender({ id: 'r2' }); expect(result.current.texto).toBeNull();
  });
  it('falha de leitura não dispara geração nem sugere comprar créditos', async () => {
    mock.read.mockResolvedValue({ data: null, error: new Error('read failed') });
    const { result } = renderHook(() => useOrientacaoRequisito('r1'), setup());
    await waitFor(() => expect(result.current.estado).toBe('falha'));
    expect(mock.invoke).not.toHaveBeenCalled();
  });
  it('um processamento concorrente é relido do banco antes de chamar o modelo novamente', async () => {
    mock.read.mockResolvedValueOnce({ data: {}, error: null });
    mock.invoke.mockResolvedValue({ data: { pending: true, retry_after: 10 }, error: null });
    const { result } = renderHook(() => useOrientacaoRequisito('r1'), setup());
    await waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.gerar(); });
    await waitFor(() => expect(result.current.texto).toBe(saved.orientacao_implementacao));
    expect(mock.invoke).toHaveBeenCalledTimes(1);
  });
  it('prepara orientação ausente sem precisar expandir o painel e reutiliza no próximo acesso', async () => {
    const { client, wrapper } = setup();
    mock.read.mockResolvedValue({ data: {}, error: null });
    mock.invoke.mockResolvedValue({ data: saved, error: null });
    const first = renderHook(() => useOrientacaoRequisito('r1'), { wrapper });
    await waitFor(() => expect(first.result.current.estado).toBe('ok'));
    first.unmount();
    mock.read.mockResolvedValue({ data: saved, error: null });
    client.clear(); // Simulates a different browser/user with no in-memory cache.
    const next = renderHook(() => useOrientacaoRequisito('r1'), { wrapper });
    await waitFor(() => expect(next.result.current.estado).toBe('ok'));
    expect(mock.invoke).toHaveBeenCalledTimes(1);
  });
  it('repara conteúdo parcial e preserva o texto salvo se o provedor falhar', async () => {
    mock.read.mockResolvedValue({ data: { ...saved, exemplos_evidencias: '' }, error: null });
    mock.invoke.mockResolvedValue({ data: null, error: new Error('provider unavailable') });
    const { result } = renderHook(() => useOrientacaoRequisito('r1'), setup());
    await waitFor(() => expect(result.current.estado).toBe('falha'));
    expect(result.current.texto).toBe(saved.orientacao_implementacao);
    expect(result.current.perguntas).toHaveLength(1);
    expect(mock.invoke).toHaveBeenCalledTimes(1);
  });
});
