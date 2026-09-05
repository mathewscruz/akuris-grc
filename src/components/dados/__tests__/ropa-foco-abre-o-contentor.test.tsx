/**
 * O tratamento pedido pelo endereço tem de aparecer no ecrã.
 *
 * `/privacidade?focus=<id>` pode trazer o id de um tratamento ROPA, que vive
 * dois níveis abaixo da aba: ROPAs → tratamentos → dossiê. A aba abre sempre
 * no nível 1, por isso a linha procurada NUNCA chegava ao DOM — o
 * `useFocusRow` ficava cinco segundos à espera e desistia em silêncio, e a
 * pessoa que clicou num resultado da busca global aterrava numa lista de
 * levantamentos sem relação visível com o que pediu.
 *
 * O que se prova aqui é o par: abrir o contentor certo (responsabilidade do
 * `RopaTab`) e destacar a linha (responsabilidade do gancho). Sem o primeiro,
 * o segundo não tem sobre o que trabalhar.
 */
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useFocusRow } from '@/hooks/useFocusRow';

vi.mock('@/hooks/useEmpresaId', () => ({ useEmpresaId: () => ({ empresaId: 'emp-1' }) }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { empresa_id: 'emp-1' } }) }));
vi.mock('@/hooks/useJurisdicao', () => ({
  useJurisdicao: () => ({
    lei: 'RGPD',
    basesLegais: () => [{ key: 'consentimento', label: 'Consentimento' }],
  }),
}));
// Filhos que só falam com o backend e nada dizem sobre a navegação em causa.
vi.mock('@/components/dados/RopaImportExport', () => ({ RopaImportExport: () => null }));
vi.mock('@/components/dados/RopaExercicioAnexos', () => ({ RopaExercicioAnexos: () => null }));
vi.mock('@/components/dados/RopaExercicioDialog', () => ({ RopaExercicioDialog: () => null }));

const TABELAS: Record<string, any[]> = {
  ropa_exercicios: [
    { id: 'ex-1', nome: 'ROPA 2025', escopo: '', data_realizacao: '2025-03-01', responsavel_id: 'u1' },
    { id: 'ex-2', nome: 'ROPA 2026', escopo: '', data_realizacao: '2026-03-01', responsavel_id: 'u1' },
  ],
  profiles: [{ user_id: 'u1', nome: 'Ana' }],
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      const resposta = Promise.resolve({ data: TABELAS[tabela] ?? [], error: null });
      // Encadeável e "thenable": as consultas do RopaTab terminam ora em
      // `.order()`, ora em `.eq()`.
      const q: any = {
        select: () => q,
        eq: () => q,
        order: () => resposta,
        then: (...args: any[]) => resposta.then(...args),
      };
      return q;
    },
  },
}));

import { RopaTab } from '@/components/dados/RopaTab';

const tratamento = (id: string, nome: string, exercicio: string) => ({
  id,
  nome_tratamento: nome,
  codigo: id.toUpperCase(),
  exercicio_id: exercicio,
  bases_legais: [],
  categoria_titulares: 'Colaboradores',
  status: 'ativo',
});

const REGISTOS = [
  tratamento('t-1', 'Recrutamento', 'ex-1'),
  tratamento('t-2', 'Videovigilância', 'ex-2'),
];

const rectsOriginal = Element.prototype.getClientRects;
const scrollIntoViewOriginal = Element.prototype.scrollIntoView;

beforeAll(() => {
  Element.prototype.getClientRects = function () {
    return [{ width: 320, height: 48 }] as unknown as DOMRectList;
  };
  Element.prototype.scrollIntoView = vi.fn();
});

afterAll(() => {
  Element.prototype.getClientRects = rectsOriginal;
  Element.prototype.scrollIntoView = scrollIntoViewOriginal;
});

afterEach(() => cleanup());

const noop = () => {};

function montar(focoTratamentoId: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Ecra() {
    useFocusRow();
    return (
      <RopaTab
        registos={REGISTOS}
        aoRecarregar={noop}
        aoEditarTratamento={noop}
        aoApagarTratamento={noop}
        aoCriarTratamento={noop}
        focoTratamentoId={focoTratamentoId}
      />
    );
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/privacidade?focus=${focoTratamentoId ?? ''}`]}>
        <Ecra />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/*
  Cada registo aparece DUAS vezes no DOM — cartão de telemóvel e linha da
  tabela, uma delas escondida por breakpoint. Contar ocorrências seria contar
  o layout; o que interessa é se o nome está ou não no ecrã.
*/
const estaNoEcra = (texto: string) => screen.queryAllByText(texto).length > 0;

describe('ligação profunda ao tratamento ROPA', () => {
  it('sem o id, a aba fica no nível dos ROPAs e o tratamento não existe no ecrã', async () => {
    montar(null);

    await screen.findAllByText('ROPA 2026');
    expect(estaNoEcra('Videovigilância')).toBe(false);
  });

  it('com o id, abre o ROPA que contém o tratamento — e só esse', async () => {
    montar('t-2');

    await screen.findAllByText('Videovigilância');
    // O tratamento do OUTRO levantamento fica de fora: entrou-se num ROPA,
    // não se aplanou a base toda.
    expect(estaNoEcra('Recrutamento')).toBe(false);
  });

  it('a linha aberta é a que o gancho destaca', async () => {
    montar('t-2');

    await screen.findAllByText('Videovigilância');
    await waitFor(() => {
      const destacadas = document.querySelectorAll('[data-focus-id="t-2"].ring-primary');
      expect(destacadas).toHaveLength(1);
    });
  });
});
