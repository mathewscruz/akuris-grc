import React from 'react';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const { toast, getUser, from } = vi.hoisted(() => ({
  toast: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
}));
let deleteResult: Promise<{ error: any }>;

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser }, from },
}));
vi.mock('@/components/ui/dropdown-menu', async () => {
  const ReactModule = await import('react');
  const Container = ({ children }: React.PropsWithChildren) =>
    ReactModule.createElement('div', null, children);
  const Trigger = ({ children }: React.PropsWithChildren) =>
    ReactModule.createElement('button', { type: 'button' }, children);
  const Item = ReactModule.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onSelect?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  }>(({ children, onSelect, ...props }, ref) =>
    ReactModule.createElement('button', {
      ...props,
      ref,
      role: 'menuitem',
      type: 'button',
      onClick: onSelect,
    }, children));

  return {
    DropdownMenu: Container,
    DropdownMenuContent: Container,
    DropdownMenuTrigger: Trigger,
    DropdownMenuItem: Item,
  };
});

import { RiscoComentarios } from '../RiscoComentarios';
import { TratadoBlockedOption } from '../RiscoDetailDrawer';
import { useRiscoDetail } from '@/hooks/useRiscoDetail';

const owner = '550e8400-e29b-41d4-a716-446655440000';
const other = '550e8400-e29b-41d4-a716-446655440001';

function setupBackend(deletePromise: Promise<{ error: any }> = Promise.resolve({ error: null })) {
  deleteResult = deletePromise;
  getUser.mockResolvedValue({ data: { user: { id: owner } } });
  from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
    }
    return {
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [
            { id: 'own-comment', comentario: 'Meu', created_at: '2026-08-06T12:00:00Z', user_id: owner },
            { id: 'other-comment', comentario: 'Outro', created_at: '2026-08-06T11:00:00Z', user_id: other },
          ], error: null }),
        }),
      }),
      delete: () => ({ eq: () => deleteResult }),
      insert: async () => ({ error: null }),
    };
  });
}

function renderComments() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><RiscoComentarios riscoId="risk-1" /></QueryClientProvider>);
}

describe('comentários por autoria', () => {
  beforeEach(() => { vi.clearAllMocks(); setupBackend(); });

  it('mostra exclusão apenas no comentário do usuário atual', async () => {
    renderComments();
    expect(await screen.findAllByRole('button', { name: 'Excluir comentário' })).toHaveLength(1);
    expect(screen.getByText('Meu')).toBeInTheDocument();
    expect(screen.getByText('Outro')).toBeInTheDocument();
  });

  it('desabilita a exclusão pendente e informa falha acionável', async () => {
    let reject!: (value: { error: any }) => void;
    setupBackend(new Promise((resolve) => { reject = resolve; }));
    renderComments();
    const button = await screen.findByRole('button', { name: 'Excluir comentário' });
    fireEvent.click(button);
    expect(await screen.findByRole('button', { name: 'Excluindo comentário' })).toBeDisabled();
    reject({ error: { message: 'Falha de rede' } });
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Não foi possível excluir o comentário', description: 'Falha de rede', variant: 'destructive',
    })));
  });
});

describe('explicação acessível de Tratado bloqueado', () => {
  it('é alcançável e ativável por teclado, exibindo a razão', async () => {
    const onActivate = vi.fn();
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>status</DropdownMenuTrigger>
        <DropdownMenuContent>
          <TratadoBlockedOption motivo="Conclua todos os tratamentos." onActivate={onActivate} />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const option = await screen.findByRole('menuitem', { name: /Tratado indisponível: Conclua todos/i });
    option.focus();
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledOnce();
    expect(screen.getByText('Conclua todos os tratamentos.')).toBeVisible();
  });
});

describe('falha ao carregar detalhes do risco', () => {
  it('propaga falha da consulta de tratamentos em vez de retornar lista vazia', async () => {
    from.mockImplementation((table: string) => {
      const result = table === 'riscos_tratamentos'
        ? { data: null, error: { message: 'relation riscos_tratamentos unavailable' } }
        : { data: [], error: null };
      const terminal = Promise.resolve(result);
      if (table === 'incidentes') {
        return {
          select: () => ({
            contains: () => ({
              order: () => ({ limit: () => terminal }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => table === 'controles_riscos'
            ? terminal
            : { order: () => terminal },
        }),
      };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRiscoDetail('risk-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toMatchObject({
      message: expect.stringMatching(/tratamentos.*relation riscos_tratamentos unavailable/i),
    });
  });
});
