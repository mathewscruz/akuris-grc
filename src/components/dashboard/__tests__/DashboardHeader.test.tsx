/**
 * DashboardHeader — refresh agrupado e em PT-BR (AKURIS QA-016).
 *
 * No mobile o timestamp era ocultado e sobrava um ícone solto numa linha
 * própria (`flex-col sm:flex-row`), aparentemente desconectado do título; o
 * nome acessível era "Refresh", em inglês, enquanto o resto da interface está
 * em português.
 */
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';

afterEach(() => cleanup());

const ATUALIZADO_EM = new Date(2026, 7, 5, 21, 18).getTime();

function renderHeader(props: Partial<React.ComponentProps<typeof DashboardHeader>> = {}) {
  const onRefresh = vi.fn();
  const utils = render(
    <TooltipProvider>
      <DashboardHeader dataUpdatedAt={ATUALIZADO_EM} onRefresh={onRefresh} {...props} />
    </TooltipProvider>
  );
  return { ...utils, onRefresh };
}

function botaoRefresh() {
  return screen.getByRole('button', { name: 'Atualizar indicadores' });
}

describe('DashboardHeader — nome acessível em PT-BR (AKURIS QA-016)', () => {
  it('nomeia a ação como "Atualizar indicadores", não "Refresh"', () => {
    renderHeader();

    expect(botaoRefresh()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
  });

  it('aciona o refresh do Dashboard ao clicar', () => {
    const { onRefresh } = renderHeader();

    fireEvent.click(botaoRefresh());

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('DashboardHeader — agrupamento no mobile (AKURIS QA-016)', () => {
  it('mantém a ação na mesma linha do título, sem empilhar no mobile', () => {
    renderHeader();

    const header = screen.getByRole('heading', { name: 'Dashboard' }).parentElement;

    expect(header).not.toBeNull();
    // `flex-col` empilhava o ícone numa linha própria abaixo do título.
    expect(header!.className).not.toMatch(/\bflex-col\b/);
    expect(header!.className).toMatch(/\bflex-row\b|\bflex\b/);
    // O botão precisa continuar dentro do mesmo cabeçalho do título.
    expect(header!).toContainElement(botaoRefresh());
  });
});

describe('DashboardHeader — feedback de atualização (AKURIS QA-016)', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('anuncia "Atualizando…" em região viva ao acionar', () => {
    renderHeader();

    fireEvent.click(botaoRefresh());

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Atualizando…');
  });

  it('anuncia "Atualizado" quando os indicadores voltam com novo timestamp', () => {
    const { rerender } = renderHeader();

    fireEvent.click(botaoRefresh());
    expect(screen.getByRole('status')).toHaveTextContent('Atualizando…');

    rerender(
      <TooltipProvider>
        <DashboardHeader dataUpdatedAt={ATUALIZADO_EM + 60_000} onRefresh={vi.fn()} />
      </TooltipProvider>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Atualizado');
  });

  it('não fica preso em "Atualizando…" se o timestamp nunca mudar', () => {
    renderHeader();

    fireEvent.click(botaoRefresh());
    expect(screen.getByRole('status')).toHaveTextContent('Atualizando…');

    act(() => { vi.advanceTimersByTime(15_000); });

    expect(screen.getByRole('status')).not.toHaveTextContent('Atualizando…');
  });
});
