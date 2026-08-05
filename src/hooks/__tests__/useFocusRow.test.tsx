import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { useFocusRow } from '@/hooks/useFocusRow';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DocumentosLista, type DocumentoListaItem } from '@/components/documentos/DocumentosLista';

const rectsOriginal = Element.prototype.getClientRects;
const scrollIntoViewOriginal = Element.prototype.scrollIntoView;
const scrollIntoView = vi.fn();

beforeAll(() => {
  // jsdom não calcula layout: simulamos visibilidade marcando o elemento oculto
  // com data-test-hidden (equivalente a um breakpoint `md:hidden` ativo).
  Element.prototype.getClientRects = function (this: Element) {
    const hidden = (this as HTMLElement).dataset?.testHidden === 'true';
    return (hidden ? [] : [{ width: 320, height: 48 }]) as unknown as DOMRectList;
  };
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterAll(() => {
  Element.prototype.getClientRects = rectsOriginal;
  Element.prototype.scrollIntoView = scrollIntoViewOriginal;
});

afterEach(() => {
  cleanup();
  scrollIntoView.mockClear();
});

function Harness({ children }: { children: React.ReactNode }) {
  useFocusRow();
  return <>{children}</>;
}

function renderComFoco(children: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/documentos?focus=doc-1']}>
      <Harness>{children}</Harness>
    </MemoryRouter>
  );
}

describe('useFocusRow — duplicidade de data-focus-id entre breakpoints (AKURIS QA-001)', () => {
  it('destaca o elemento visível, não o primeiro do DOM', () => {
    renderComFoco(
      <>
        <div data-focus-id="doc-1" data-test-hidden="true" data-testid="mobile">
          card mobile (oculto em desktop)
        </div>
        <div data-focus-id="doc-1" data-testid="desktop">
          linha da tabela
        </div>
      </>
    );

    const mobile = screen.getByTestId('mobile');
    const desktop = screen.getByTestId('desktop');

    expect(desktop.classList.contains('ring-primary')).toBe(true);
    expect(mobile.classList.contains('ring-primary')).toBe(false);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('mantém o destaque quando o card mobile é a representação visível', () => {
    renderComFoco(
      <>
        <div data-focus-id="doc-1" data-testid="mobile">
          card mobile
        </div>
        <div data-focus-id="doc-1" data-test-hidden="true" data-testid="desktop">
          linha da tabela (oculta em mobile)
        </div>
      </>
    );

    expect(screen.getByTestId('mobile').classList.contains('ring-primary')).toBe(true);
    expect(screen.getByTestId('desktop').classList.contains('ring-primary')).toBe(false);
  });

  it('recorre ao primeiro candidato quando nenhum reporta layout', () => {
    renderComFoco(
      <>
        <div data-focus-id="doc-1" data-test-hidden="true" data-testid="mobile">
          card
        </div>
        <div data-focus-id="doc-1" data-test-hidden="true" data-testid="desktop">
          linha
        </div>
      </>
    );

    expect(screen.getByTestId('mobile').classList.contains('ring-primary')).toBe(true);
  });

  it('encontra a linha visível da DocumentosLista real', () => {
    const documento: DocumentoListaItem = {
      id: 'doc-1',
      nome: 'Política de Backup',
      tipo: 'politica',
      classificacao: 'interna',
      status: 'ativo',
      versao: 1,
      data_vencimento: '2027-03-01',
    };

    const noop = () => {};

    renderComFoco(
      <TooltipProvider>
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
      </TooltipProvider>
    );

    const destacados = Array.from(
      document.querySelectorAll('[data-focus-id="doc-1"]')
    ).filter((el) => el.classList.contains('ring-primary'));

    // Exatamente uma das duas representações recebe o destaque
    expect(destacados).toHaveLength(1);
  });
});
