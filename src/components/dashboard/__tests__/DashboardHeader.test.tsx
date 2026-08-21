/**
 * DashboardHeader — o cabeçalho é o título, e mais nada.
 *
 * Este ficheiro testava o botão "atualizar": nome acessível em PT-BR, região
 * viva a anunciar "Atualizando…", trava contra ficar preso nesse estado. Todo
 * esse comportamento foi REMOVIDO — o painel passou a atualizar-se sozinho
 * (`useDashboardLive`), e com ele saíram o botão, o carimbo "Atualizado às
 * HH:MM" e a acção primária "Relatório executivo".
 *
 * O que fica é a guarda contra o regresso: se algum destes voltar ao cabeçalho
 * sem que a decisão seja revista, o teste falha e diz porquê.
 */
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';

afterEach(() => cleanup());

function renderHeader() {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <DashboardHeader />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

describe('DashboardHeader', () => {
  it('mostra o título da página', () => {
    renderHeader();

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('não traz nenhum controlo no cabeçalho', () => {
    renderHeader();

    // O painel atualiza-se sozinho: pedir um clique para ver a verdade é
    // trabalho do utilizador que a máquina faz melhor.
    expect(screen.queryByRole('button', { name: 'Atualizar indicadores' })).toBeNull();
    // O carimbo só servia para confessar que o ecrã podia já não ser verdade.
    expect(screen.queryByText(/Atualizado às/i)).toBeNull();
    // O que há para fazer vive no rodapé de cada painel, com o número que o
    // justifica — um botão genérico no canto competia com todos eles.
    expect(screen.queryByRole('button', { name: /Relatório executivo/i })).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
