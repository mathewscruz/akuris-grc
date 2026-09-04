import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

describe('DocumentosLista — menu de ações acessível', () => {
  it('abre pelo teclado e dispara a ação escolhida', () => {
    const { handlers } = renderLista();

    const mobile = screen.getByTestId('documentos-lista-mobile');
    const trigger = within(mobile).getByRole('button', {
      name: `Ações do documento ${documento.nome}`,
    });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Preview/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Renovar Documento/ })).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('menuitem', { name: /Editar/ }));
    expect(handlers.onEditar).toHaveBeenCalledWith(documento);
  });

  it('omite ações condicionais quando não se aplicam', () => {
    renderLista({
      documentos: [{ ...documento, requer_aprovacao: false }],
      podeRenovar: () => false,
    });

    const mobile = screen.getByTestId('documentos-lista-mobile');
    const trigger = within(mobile).getByRole('button', {
      name: `Ações do documento ${documento.nome}`,
    });

    fireEvent.keyDown(trigger, { key: 'Enter' });

    const menu = screen.getByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: /Aprovação/ })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: /Renovar Documento/ })).toBeNull();
  });
});
