import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PaginationLink, PaginationNext, PaginationPrevious } from './pagination';

afterEach(cleanup);

it('a paginação usa botão nativo sem enviar o formulário', () => {
  const select = vi.fn();
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(<form onSubmit={submit}><PaginationLink isActive onClick={select}>2</PaginationLink></form>);
  const button = screen.getByRole('button', { name: '2' });
  expect(button).toHaveAttribute('aria-current', 'page');
  expect(button).toHaveAttribute('type', 'button');
  fireEvent.click(button);
  expect(select).toHaveBeenCalledTimes(1);
  expect(submit).not.toHaveBeenCalled();
});

it('os limites são botões nativamente desabilitados', () => {
  const previous = vi.fn();
  render(<><PaginationPrevious disabled onClick={previous} /><PaginationNext /></>);
  const disabled = screen.getByRole('button', { name: 'Anterior' });
  expect(disabled).toBeDisabled();
  fireEvent.click(disabled);
  expect(screen.getByRole('button', { name: 'Próximo' })).not.toBeDisabled();
  expect(previous).not.toHaveBeenCalled();
});
