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
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });
beforeEach(() => {
  mock.locale = 'pt-BR'; mock.read.mockReset(); mock.invoke.mockReset();
  mock.read.mockResolvedValue({ data: { orientacao_implementacao: 'Texto salvo', exemplos_evidencias: '- Política', perguntas_diagnostico: '[]' }, error: null });
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
    mock.invoke.mockResolvedValue({ data: { orientacao_implementacao: 'Saved English', exemplos_evidencias: '- Policy', perguntas_diagnostico: '[]' }, error: null });
    const { result } = renderHook(() => useOrientacaoRequisito('r1'), setup());
    await waitFor(() => expect(result.current.texto).toBe('Saved English'));
    expect(mock.invoke).toHaveBeenCalledWith('populate-requirement-guidance', { body: { requirement_id: 'r1', locale: 'en', force: false } });
  });
  it('não usa o texto do requisito anterior enquanto a próxima consulta carrega', async () => {
    mock.read.mockImplementation((id) => id === 'r1' ? Promise.resolve({ data: { orientacao_implementacao: 'Primeiro' } }) : new Promise(() => {}));
    const { result, rerender } = renderHook(({ id }) => useOrientacaoRequisito(id), { ...setup(), initialProps: { id: 'r1' } });
    await waitFor(() => expect(result.current.texto).toBe('Primeiro'));
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
    await waitFor(() => expect(result.current.texto).toBe('Texto salvo'));
    expect(mock.invoke).toHaveBeenCalledTimes(1);
  });
});
