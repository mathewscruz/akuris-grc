import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DocumentosLista,
  type DocumentoListaItem,
} from '@/components/documentos/DocumentosLista';

afterEach(() => cleanup());

const documento: DocumentoListaItem = {
  id: 'doc-1',
  nome: 'Política de Segurança da Informação',
  descricao: 'Diretrizes gerais de segurança',
  tipo: 'politica',
  classificacao: 'confidencial',
  status: 'ativo',
  versao: 3,
  data_vencimento: '2027-01-15',
  requer_aprovacao: true,
};

function renderLista(overrides: Partial<React.ComponentProps<typeof DocumentosLista>> = {}) {
  const handlers = {
    onPreview: vi.fn(),
    onEditar: vi.fn(),
    onVinculacoes: vi.fn(),
    onComentarios: vi.fn(),
    onAprovacao: vi.fn(),
    onRenovar: vi.fn(),
    onHistorico: vi.fn(),
    onAuditoria: vi.fn(),
    onExcluir: vi.fn(),
  };

  const utils = render(
    <DocumentosLista
      documentos={[documento]}
      podeRenovar={() => true}
      emptyState={<div>Nenhum documento cadastrado</div>}
      {...handlers}
      {...overrides}
    />
  );

  return { ...utils, handlers };
}

describe('DocumentosLista — listagem responsiva (AKURIS QA-001)', () => {
  it('no mobile expõe Nome, Tipo, Status, Validade e Ações sem tabela/rolagem horizontal', () => {
    renderLista();

    const mobile = screen.getByTestId('documentos-lista-mobile');

    // A representação mobile não pode ser a tabela de 7 colunas
    expect(within(mobile).queryByRole('table')).toBeNull();

    expect(within(mobile).getByText(documento.nome)).toBeInTheDocument();

    // Pares rótulo-valor críticos
    expect(within(mobile).getByText('Status')).toBeInTheDocument();
    expect(within(mobile).getByText('Ativo')).toBeInTheDocument();
    expect(within(mobile).getByText('Validade')).toBeInTheDocument();
    expect(within(mobile).getByText('15/01/2027')).toBeInTheDocument();
    expect(within(mobile).getByText('Classificação')).toBeInTheDocument();
    expect(within(mobile).getByText('Confidencial')).toBeInTheDocument();
    expect(within(mobile).getByText('Versão')).toBeInTheDocument();
    expect(within(mobile).getByText('v3')).toBeInTheDocument();

    // Ações discoberíveis com nome acessível
    expect(
      within(mobile).getByRole('button', { name: `Ações do documento ${documento.nome}` })
    ).toBeInTheDocument();
  });

  it('mantém a tabela apenas de md para cima e os cards apenas abaixo de md', () => {
    renderLista();

    const mobile = screen.getByTestId('documentos-lista-mobile');
    const desktop = screen.getByTestId('documentos-tabela-desktop');

    expect(mobile).toHaveClass('md:hidden');
    expect(desktop.className).toContain('hidden');
    expect(desktop).toHaveClass('md:block');
  });

  it('preserva a tabela desktop com todas as colunas', () => {
    renderLista();

    const desktop = screen.getByTestId('documentos-tabela-desktop');
    const table = within(desktop).getByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim());

    expect(headers).toEqual([
      'Nome',
      'Tipo',
      'Classificação',
      'Status',
      'Versão',
      'Validade',
      'Responsável',
      'Ações',
    ]);
    expect(within(table).getByText(documento.nome)).toBeInTheDocument();
  });

  it('preserva a saliência visual de documentos confidenciais no card mobile', () => {
    renderLista();

    const mobile = screen.getByTestId('documentos-lista-mobile');
    const badge = within(mobile).getByText('Confidencial');

    /**
     * A asserção original exigia `destructive` na classe do chip. Isso deixou
     * de valer quando os estados foram padronizados: hoje **toda** superfície
     * de chip é neutra e a cor vive na marca (ver `STATE_CLASSES` em
     * `ui/chip.tsx`, onde `blocked` usa fundo neutro e ponto crítico). O teste
     * ficou a defender um desenho abandonado, e vermelho por isso.
     *
     * O que continua a importar — e é o que se guarda aqui — é que
     * confidencial se distinga de qualquer outra classificação no card: leva um
     * glifo próprio no lugar do ponto.
     */
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('classificação não confidencial não recebe o glifo de risco', () => {
    renderLista({ documentos: [{ ...documento, classificacao: 'interna' }] });

    const mobile = screen.getByTestId('documentos-lista-mobile');
    const badge = within(mobile).getByText('Interna');

    // Sem glifo: cai no ponto de estado. É o contraste que dá sentido ao
    // teste anterior — sem este, um ícone em toda a gente passaria na guarda.
    expect(badge.querySelector('svg')).toBeNull();
  });

  it('aceita campos anuláveis vindos do banco sem quebrar a exibição', () => {
    renderLista({
      documentos: [
        {
          id: 'doc-nulo',
          nome: 'Documento sem metadados',
          descricao: null,
          tipo: 'documento',
          classificacao: null,
          status: 'rascunho',
          versao: null,
          data_vencimento: null,
          requer_aprovacao: null,
        },
      ],
    });

    const mobile = screen.getByTestId('documentos-lista-mobile');

    expect(within(mobile).getByText('Documento sem metadados')).toBeInTheDocument();
    // Ausência de classificação não inventa uma classificação aprovada.
    expect(within(mobile).getByText('Por classificar')).toBeInTheDocument();
    expect(within(mobile).queryByText('Interna')).toBeNull();
    // Validade e Versão ausentes exibem placeholder, sem "undefined"/"vnull"
    expect(within(mobile).getAllByText('-').length).toBeGreaterThanOrEqual(2);
    expect(mobile.textContent).not.toMatch(/undefined|null|NaN/);
  });

  it('não depende de um TooltipProvider externo', () => {
    const noop = () => {};

    expect(() =>
      render(
        <DocumentosLista
          documentos={[documento]}
          podeRenovar={() => false}
          emptyState={<div>vazio</div>}
          onPreview={noop}
          onEditar={noop}
          onVinculacoes={noop}
          onComentarios={noop}
          onAprovacao={noop}
          onRenovar={noop}
          onHistorico={noop}
          onAuditoria={noop}
          onExcluir={noop}
        />
      )
    ).not.toThrow();

    expect(screen.getByTestId('documentos-tabela-desktop')).toBeInTheDocument();
  });

  it('renderiza o estado vazio nas duas representações', () => {
    renderLista({ documentos: [] });

    const mobile = screen.getByTestId('documentos-lista-mobile');
    const desktop = screen.getByTestId('documentos-tabela-desktop');

    expect(within(mobile).getByText('Nenhum documento cadastrado')).toBeInTheDocument();
    expect(within(desktop).getByText('Nenhum documento cadastrado')).toBeInTheDocument();
  });

  it('delegar a ordenação mantém a página recebida e usa o campo real de validade', async () => {
    const onSort = vi.fn();
    renderLista({
      documentos: [{ ...documento, id: 'z', nome: 'Zeta' }, { ...documento, id: 'a', nome: 'Alfa' }],
      sort: { field: 'nome', direction: 'asc' },
      onSort,
    });
    const desktop = within(screen.getByTestId('documentos-tabela-desktop'));
    expect(desktop.getByRole('columnheader', { name: 'Nome' })).toHaveAttribute('aria-sort', 'ascending');
    const rows = desktop.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Zeta');
    expect(rows[2]).toHaveTextContent('Alfa');
    fireEvent.click(desktop.getByRole('button', { name: 'Validade' }));
    expect(onSort).toHaveBeenCalledWith('data_vencimento');
  });

});
