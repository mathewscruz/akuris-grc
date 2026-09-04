import type {
  ButtonHTMLAttributes,
  Dispatch,
  ReactElement,
  ReactNode,
  SetStateAction,
} from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Estes testes verificam o contrato do Akuris (nomes acessíveis, teclado,
 * ações condicionais e callbacks), não a implementação do portal do Radix.
 * O portal mantém timers de posicionamento/foco no jsdom e, no runner Linux,
 * podia levar mais de um minuto para terminar depois de todos os asserts já
 * terem passado. Um menu mínimo e sem portal conserva o comportamento que o
 * componente precisa fornecer e deixa o ciclo de vida do teste determinístico.
 */
vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await import('react');

  interface MenuContextValue {
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
  }

  const MenuContext = React.createContext<MenuContextValue | null>(null);

  function useMenu() {
    const value = React.useContext(MenuContext);
    if (!value) throw new Error('O menu de teste precisa de um contexto');
    return value;
  }

  function DropdownMenu({ children }: { children: ReactNode }) {
    const [open, setOpen] = React.useState(false);
    return <MenuContext.Provider value={{ open, setOpen }}>{children}</MenuContext.Provider>;
  }

  function DropdownMenuTrigger({ children }: { asChild?: boolean; children: ReactElement }) {
    const { setOpen } = useMenu();
    const child = children as ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;

    return React.cloneElement(child, {
      'aria-expanded': undefined,
      onClick: (event) => {
        child.props.onClick?.(event);
        setOpen(true);
      },
      onKeyDown: (event) => {
        child.props.onKeyDown?.(event);
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
          event.preventDefault();
          setOpen(true);
        }
      },
    });
  }

  function DropdownMenuContent({ children }: { children: ReactNode; align?: string }) {
    const { open } = useMenu();
    return open ? <div role="menu">{children}</div> : null;
  }

  const DropdownMenuItem = React.forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement>
  >(({ children, onClick, ...props }, ref) => {
    const { setOpen } = useMenu();
    return (
      <button
        {...props}
        ref={ref}
        type="button"
        role="menuitem"
        onClick={(event) => {
          onClick?.(event);
          setOpen(false);
        }}
      >
        {children}
      </button>
    );
  });
  DropdownMenuItem.displayName = 'DropdownMenuItemTest';

  function DropdownMenuSeparator() {
    return <div role="separator" />;
  }

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
  };
});

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
