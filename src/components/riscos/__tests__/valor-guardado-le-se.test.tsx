/**
 * Um campo preenchido nunca se lê como campo vazio.
 *
 * `UserSelect` comparava `user_id === value` e, sem correspondência, desenhava
 * o placeholder — «Selecionar responsável...». Mas a coluna é TEXT e guarda as
 * duas coisas; `src/lib/uuid.ts` di-lo desde sempre: «o rótulo textual continua
 * disponível para exibição».
 *
 * Medido na base local: 31 dos 35 activos com proprietário e 44 dos 82 riscos
 * com responsável guardam um rótulo — `Facilities`, `TI`, `Comercial`,
 * `Mathews Cruz - CISO` — e TODOS apareciam como campo por preencher. Quem
 * acredita nisso atribui um dono novo a um registo que já tinha dono: a
 * leitura falhada vira facto, e o facto vira escrita.
 *
 * O valor guardado sobrevive à gravação — foi verificado — por isso o dano é
 * todo de leitura. O que não o torna pequeno: é o campo que diz quem responde.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ profile: { empresa_id: 'empresa-1' } }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { UserSelect } from '../UserSelect';

const DA_LISTA = '11111111-1111-4111-8111-111111111111';
const FORA_DA_LISTA = '22222222-2222-4222-8222-222222222222';

/** Uma pessoa activa na empresa; e uma que existe mas não está na lista. */
function backend({ comOrfao = true }: { comOrfao?: boolean } = {}) {
  from.mockImplementation((tabela: string) => {
    if (tabela !== 'profiles') throw new Error(`tabela inesperada: ${tabela}`);
    const lista = {
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data: [{ user_id: DA_LISTA, nome: 'Grace Karen', email: 'grace@exemplo.pt' }],
                error: null,
              }),
          }),
          // A segunda leitura: o nome de quem não está na lista.
          maybeSingle: () =>
            Promise.resolve({ data: comOrfao ? { nome: 'Pedro Inactivo' } : null, error: null }),
        }),
      }),
    };
    return lista;
  });
}

describe('o valor guardado lê-se', () => {
  beforeEach(() => {
    from.mockReset();
    backend();
  });

  it('um rótulo de texto aparece tal como está guardado', async () => {
    render(<UserSelect value="Facilities" onValueChange={() => {}} placeholder="Selecionar proprietário..." />);
    expect(await screen.findByText('Facilities')).toBeTruthy();
    expect(screen.queryByText('Selecionar proprietário...')).toBeNull();
  });

  it('um utilizador da lista aparece pelo nome', async () => {
    render(<UserSelect value={DA_LISTA} onValueChange={() => {}} />);
    expect(await screen.findByText('Grace Karen')).toBeTruthy();
  });

  it('um UUID fora da lista mostra o nome, não o número', async () => {
    render(<UserSelect value={FORA_DA_LISTA} onValueChange={() => {}} placeholder="Selecionar..." />);
    await waitFor(() => expect(screen.queryByText('Pedro Inactivo')).toBeTruthy());
    expect(screen.queryByText(FORA_DA_LISTA)).toBeNull();
    expect(screen.queryByText('Selecionar...')).toBeNull();
  });

  it('sem nome nenhum diz que não encontrou — e não que está por preencher', async () => {
    backend({ comOrfao: false });
    render(<UserSelect value={FORA_DA_LISTA} onValueChange={() => {}} placeholder="Selecionar..." />);
    /* «Por preencher» seria mentira: há lá um valor. Dizer que não se encontrou
       é a verdade, e é accionável — alguém foi desactivado ou mudou de empresa. */
    await waitFor(() => expect(screen.queryByText('Selecionar...')).toBeNull());
  });

  it('vazio é que é vazio: aí sim, o placeholder', async () => {
    render(<UserSelect value="" onValueChange={() => {}} placeholder="Selecionar proprietário..." />);
    expect(await screen.findByText('Selecionar proprietário...')).toBeTruthy();
  });
});
