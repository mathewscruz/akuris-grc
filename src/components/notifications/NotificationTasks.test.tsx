import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationTasks } from './NotificationTasks';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), query: vi.fn(), refetch: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/hooks/useMinhasPendencias', () => ({ useMinhasPendencias: () => mocks.query() }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockReturnValue({ itens: [], total: 0, isLoading: false, isError: false, refetch: mocks.refetch });
});

describe('pendências no sino', () => {
  it('não interpreta erro como ausência de trabalho', () => {
    mocks.query.mockReturnValue({ itens: [], total: 0, isLoading: false, isError: true, refetch: mocks.refetch });
    render(<NotificationTasks onNavigate={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('dashWidgets.pendencias.empty')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'experience.retry' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
  it('pagina sem perder as pendências restantes e abre a origem exata', () => {
    const itens = Array.from({ length: 10 }, (_, n) => ({ id: String(n), titulo: 'Pendência ' + n, prazo: null, atrasada: false, href: '/planos-acao?focus=' + n }));
    mocks.query.mockReturnValue({ itens, total: 10, isLoading: false, isError: false });
    const onNavigate = vi.fn();
    render(<NotificationTasks onNavigate={onNavigate} />);
    expect(screen.getByText('Pendência 0')).toBeInTheDocument();
    expect(screen.queryByText('Pendência 8')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'experience.next' }));
    fireEvent.click(screen.getByRole('button', { name: /Pendência 8/ }));
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenCalledWith('/planos-acao?focus=8');
  });
  it('explica o estado vazio sem ocultar falhas', () => {
    render(<NotificationTasks onNavigate={vi.fn()} />);
    expect(screen.getByText('dashWidgets.pendencias.empty')).toBeInTheDocument();
    expect(screen.getByText('experience.notificationTaskScope')).toBeInTheDocument();
  });
});
