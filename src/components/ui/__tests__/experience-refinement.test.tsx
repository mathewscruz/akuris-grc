import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatStrip } from '../stat-strip';
import { SortableTableHead } from '../sortable-table-head';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/dashboard/KpiDrillDownProvider', () => ({ useKpiDrillDown: () => ({ open: vi.fn() }) }));
afterEach(cleanup);

describe('indicadores sem conclusões implícitas', () => {
  it('zero em alerta permanece neutro sem declarar tudo em dia', () => {
    const { container } = render(<StatStrip items={[{ label: 'Vencidos', value: 0, tone: 'destructive' }]} />);
    expect(screen.getByText('0')).toHaveClass('text-foreground');
    expect(container.textContent).not.toMatch(/tudoEmDia|Tudo em dia/);
  });
  it('aceita uma interpretação de zero explicitamente definida pelo domínio', () => {
    render(<StatStrip items={[{ label: 'Revisões', value: 0, zeroState: { label: 'Nenhuma revisão pendente', tone: 'success' } }]} />);
    expect(screen.getByText('Nenhuma revisão pendente')).toHaveClass('text-state-done');
  });
  it('falha de consulta não vira zero, progresso ou ação de drill-down', () => {
    const onClick = vi.fn();
    render(<StatStrip error items={[{ label: 'Cobertura', value: '100%', progress: 100, onClick }]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('experience.unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(onClick).not.toHaveBeenCalled();
  });
  it('resumo móvel preserva total e alerta relevante, com expansão acessível', () => {
    const { container } = render(<StatStrip items={[
      { label: 'Total', value: 20 }, { label: 'Em dia', value: 19 },
      { label: 'Vencidos', value: 1, tone: 'destructive' },
    ]} />);
    const items = container.querySelectorAll('.akuris-stat-item');
    expect(items[0]).toHaveAttribute('data-mobile-hidden', 'false');
    expect(items[1]).toHaveAttribute('data-mobile-hidden', 'true');
    expect(items[2]).toHaveAttribute('data-mobile-hidden', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'experience.showMetrics' }));
    expect(screen.getByRole('button', { name: 'experience.hideMetrics' })).toHaveAttribute('aria-expanded', 'true');
    expect(items[1]).toHaveAttribute('data-mobile-hidden', 'false');
  });
});

it('cabeçalho ordenável usa botão nativo e informa a ordenação', () => {
  const onSort = vi.fn();
  render(<table><thead><tr><SortableTableHead field="nome" sort={{ field: 'nome', direction: 'asc' }} onSort={onSort}>Nome</SortableTableHead></tr></thead></table>);
  const button = screen.getByRole('button', { name: 'Nome' });
  expect(button.tagName).toBe('BUTTON');
  expect(button.tabIndex).toBe(0);
  expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending');
  fireEvent.click(button);
  expect(onSort).toHaveBeenCalledWith('nome');
});
