/**
 * A linha que só existe depois de a página decidir mostrá-la.
 *
 * Cinco páginas deste produto guardam o registo atrás de uma aba ou de um
 * nível de navegação. O `?focus=` chega, a aba certa abre — mas isso demora:
 * primeiro a consulta, depois a troca de aba, só então a linha entra no DOM.
 * `useFocusRow` conta com isso e fica em espera activa por 200ms × 25.
 *
 * Esse prazo é a parte silenciosa do contrato: passado ele o gancho desiste
 * sem dizer nada e a ligação profunda volta a ser "abriu a lista". Fica aqui
 * escrito nos dois sentidos — o que chega a tempo é destacado, o que chega
 * tarde não é — para que quem puser mais um nível pelo caminho saiba o
 * orçamento que tem.
 */
import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFocusRow } from '@/hooks/useFocusRow';

const rectsOriginal = Element.prototype.getClientRects;
const scrollIntoViewOriginal = Element.prototype.scrollIntoView;
const scrollIntoView = vi.fn();

beforeAll(() => {
  // jsdom não calcula layout: sem isto nenhum candidato "está visível".
  Element.prototype.getClientRects = function (this: Element) {
    return [{ width: 320, height: 48 }] as unknown as DOMRectList;
  };
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterAll(() => {
  Element.prototype.getClientRects = rectsOriginal;
  Element.prototype.scrollIntoView = scrollIntoViewOriginal;
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  scrollIntoView.mockClear();
  vi.useRealTimers();
});

/** Espelha a query string, para se poder ver o parâmetro ser consumido. */
function Endereco() {
  return <span data-testid="endereco">{useLocation().search}</span>;
}

/** A linha só entra no DOM ao fim de `atrasoMs` — como uma aba que troca. */
function ListaTardia({ atrasoMs }: { atrasoMs: number }) {
  useFocusRow();
  const [pronta, setPronta] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setPronta(true), atrasoMs);
    return () => window.clearTimeout(id);
  }, [atrasoMs]);
  return (
    <>
      <Endereco />
      {pronta ? (
        <div data-focus-id="rec-1" data-testid="linha">
          registo
        </div>
      ) : null}
    </>
  );
}

function renderComFoco(atrasoMs: number) {
  render(
    <MemoryRouter initialEntries={['/privacidade?focus=rec-1']}>
      <ListaTardia atrasoMs={atrasoMs} />
    </MemoryRouter>
  );
}

/*
  Avança o relógio em fatias, cada uma no seu `act`.

  Numa fatia só, os disparos do polling correm todos ANTES de o React aplicar
  a renderização pedida pelo temporizador da lista — o gancho procura no DOM
  antigo, não encontra nada e o teste acusa uma falha que o browser não tem.
*/
function avancar(ms: number, fatia = 100) {
  for (let restante = ms; restante > 0; restante -= fatia) {
    act(() => void vi.advanceTimersByTime(Math.min(fatia, restante)));
  }
}

describe('linha que chega depois (AKURIS QA — ligação profunda atrás de aba)', () => {
  it('destaca a linha que aparece dentro da janela de espera', () => {
    renderComFoco(1000);

    // Antes de a lista montar não há nada para destacar — e o gancho espera.
    expect(screen.queryByTestId('linha')).toBeNull();

    avancar(1400);

    expect(screen.getByTestId('linha').classList.contains('ring-primary')).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('consome o parâmetro, para que voltar atrás não repita o destaque', () => {
    renderComFoco(1000);
    expect(screen.getByTestId('endereco').textContent).toContain('focus=rec-1');

    avancar(1400);

    expect(screen.getByTestId('endereco').textContent).not.toContain('focus');
  });

  it('desiste quando a linha chega depois dos 5s de espera', () => {
    renderComFoco(6000);
    avancar(7000);

    expect(screen.getByTestId('linha').classList.contains('ring-primary')).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
