import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useListState } from '../useListState';

const auth = vi.hoisted(() => ({ user: { id: 'user-a' }, profile: { empresa_id: 'tenant-a' } }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => auth }));
afterEach(cleanup);

function List({ stateKey }: { stateKey: string }) {
  const [value, setValue] = useListState(stateKey, '');
  const navigate = useNavigate();
  return <><input aria-label="Filtro" value={value} onChange={(event) => setValue(event.target.value)} /><button onClick={() => navigate('/detalhe')}>Detalhe</button></>;
}
function Back() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Voltar</button>; }

describe('contexto da lista em memória', () => {
  it('preserva filtro ao voltar de outro módulo', () => {
    render(<MemoryRouter initialEntries={['/lista']}><Routes><Route path="/lista" element={<List stateKey="back-filter" />} /><Route path="/detalhe" element={<Back />} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Acesso' } });
    fireEvent.click(screen.getByRole('button', { name: 'Detalhe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('textbox')).toHaveValue('Acesso');
  });
  it('não mistura a preferência de empresas diferentes', () => {
    const element = <MemoryRouter><List stateKey="tenant-filter" /></MemoryRouter>;
    const first = render(element);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Empresa A' } });
    first.unmount();
    auth.profile.empresa_id = 'tenant-b';
    const second = render(element);
    expect(screen.getByRole('textbox')).toHaveValue('');
    second.unmount();
    auth.profile.empresa_id = 'tenant-a';
    render(element);
    expect(screen.getByRole('textbox')).toHaveValue('Empresa A');
  });
});
