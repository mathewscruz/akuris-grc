import * as React from 'react';

interface DashboardHeaderProps {
  /** Mantido por compatibilidade — não é mais exibido. */
  userName?: string;
  /** Mantido por compatibilidade — não é mais exibido. */
  criticalCount?: number;
}

/**
 * Cabeçalho do painel: o título, e mais nada.
 *
 * Tinha três coisas à direita, e as três saíram:
 *
 *  · **"Atualizado às HH:MM"** — um carimbo que só servia para confessar que o
 *    ecrã podia já não ser verdade. Se o número pode estar velho, o problema é
 *    o número, não a falta de aviso.
 *
 *  · **O botão de atualizar** — pedir a alguém que carregue num botão para ver
 *    a verdade é transferir para o utilizador um trabalho que a máquina faz
 *    melhor. Substituído por `useDashboardLive`, que subscreve as tabelas de
 *    onde saem os números e reconsulta quando alguma muda.
 *
 *  · **"Relatório executivo"** — o painel não precisa de uma acção primária
 *    própria. O que há para fazer está no rodapé de cada painel, com o número
 *    que o justifica; um botão genérico no canto competia com todos eles.
 *
 * O componente fica por causa do `<h1>`: é o único da página e vários testes e
 * o leitor de ecrã dependem dele.
 */
export const DashboardHeader: React.FC<DashboardHeaderProps> = () => (
  <div className="flex flex-row items-center justify-between gap-3">
    <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
      Dashboard
    </h1>
  </div>
);
