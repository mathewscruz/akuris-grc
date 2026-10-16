import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DataTable } from '../data-table';

vi.mock('@/hooks/useListState', () => ({ useListState: (_key: string, initial: unknown) => useState(initial) }));
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
// Keep this regression focused on the table's pagination state, not Radix's portal/focus implementation.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) => <select aria-label="Linhas por página" value={value} onChange={event => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}));
afterEach(cleanup);

function setup(count: number) {
  render(<MemoryRouter><DataTable searchable={false} pageSize={10} data={Array.from({ length: count }, (_, i) => ({ id: String(i), nome: `Item ${i}` }))} columns={[{ key: 'nome', label: 'Nome' }]} /></MemoryRouter>);
}
describe('QA — navegação real da tabela compartilhada', () => {
  it('mantém páginas únicas até o fim da lista', () => {
    setup(100);
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    const pages = within(screen.getByRole('navigation')).getAllByRole('button').map(button => button.textContent).filter(text => /^\d+$/.test(text ?? ''));
    expect(pages).toEqual(['6', '7', '8', '9', '10']);
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
  });
  it('não perde o seletor ao escolher um tamanho que cabe em uma página', () => {
    setup(21);
    fireEvent.change(screen.getByRole('combobox', { name: 'Linhas por página' }), { target: { value: '100' } });
    expect(screen.getByRole('combobox', { name: 'Linhas por página' })).toHaveValue('100');
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Linhas por página' }), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled();
  });
  it('preserva a página e os mesmos registros ao alternar lista e grade', () => {
    setup(21);
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Grade' }));
    expect(screen.getAllByText('Item 10').length).toBeGreaterThan(0);
    expect(screen.queryByText('Item 0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getAllByText('Item 10').length).toBeGreaterThan(0);
    expect(screen.queryByText('Item 0')).not.toBeInTheDocument();
  });
});
