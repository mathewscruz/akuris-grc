import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContratoDialogWizard } from '../ContratoDialogWizard';

vi.mock('@/hooks/useEmpresaMoeda', () => ({ useEmpresaMoeda: () => ({ moeda: 'BRL' }), MOEDAS: ['BRL'], SIMBOLO_MOEDA: { BRL: 'R$' } }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { empresa_id: 'e1' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: null } }) },
  from: () => { const query = { select: () => query, eq: () => query, single: async () => ({ data: null }) }; return query; },
} }));
afterEach(cleanup);
function setup() {
  const close = vi.fn();
  render(<ContratoDialogWizard contrato={null} open onOpenChange={close} onSuccess={() => {}} fornecedores={[]} />);
  return close;
}

describe('QA — cadastro de contratos', () => {
  it('mantém o erro visível, foca o aviso e rejeita nomes com apenas espaços', () => {
    setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome do Contrato *' }), { target: { value: '   ' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do Contrato *' }), { target: { value: 'CT-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Nome do contrato é obrigatório');
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Dados Básicos' })).toBeInTheDocument();
  });
  it('rejeita números em branco e libera a próxima etapa após correção', () => {
    setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome do Contrato *' }), { target: { value: 'Suporte' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do Contrato *' }), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Número do contrato é obrigatório');
    fireEvent.change(screen.getByRole('textbox', { name: 'Número do Contrato *' }), { target: { value: 'CT-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByRole('heading', { name: 'Valores e Datas' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('protege o cancelamento, permite continuar e descarta só após confirmação', () => {
    const close = setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome do Contrato *' }), { target: { value: 'Rascunho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(screen.getByRole('textbox', { name: 'Nome do Contrato *' })).toHaveValue('Rascunho');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(close).toHaveBeenCalledWith(false);
  });
  it('fecha sem confirmação se nada foi alterado e dá nome aos seletores', () => {
    const close = setup();
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisão' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(close).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
