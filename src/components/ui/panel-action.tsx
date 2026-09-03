/**
 * PanelAction — o rodapé que diz o que fazer a seguir.
 *
 * Antes desta peça, o painel inteiro tinha UMA frase com verbo ("Ver todos").
 * Os números que exigem decisão existiam — planos atrasados, documentos a
 * vencer, riscos acima do apetite — mas viviam em `title`, ou seja, num
 * tooltip. Tooltip não é chamada para ação: não se vê, não se navega por
 * teclado e não existe no telemóvel.
 *
 * Um só desenho para todos os painéis, para que "o que falta fazer" esteja
 * sempre no mesmo sítio e com o mesmo peso — no fim do cartão, separado por
 * fio, alinhado à esquerda, com a seta à direita.
 *
 * O estado limpo também fala. Um cartão sem pendências mostra "Tudo em dia" em
 * vez de um zero igual a qualquer outro número: zero pendências e zero
 * registos desenhavam-se da mesma maneira, e são o oposto um do outro.
 */
import * as React from 'react';
import { IconChevron, IconSuccess } from '@/components/icons';
import { cn } from '@/lib/utils';

interface Props {
  /** O que falta fazer, já com o número ("8 riscos a tratar"). */
  children: React.ReactNode;
  onClick?: () => void;
  /**
   * Nada por fazer: a linha vira estado, não ação — sem seta, sem clique,
   * e com o tom positivo discreto.
   */
  limpo?: boolean;
  className?: string;
}

export function PanelAction({ children, onClick, limpo, className }: Props) {
  const base = 'flex min-h-10 w-full items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs';

  if (limpo) {
    return (
      <div className={cn(base, 'text-state-done', className)}>
        <span className="min-w-0 truncate">{children}</span>
        <IconSuccess className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        base,
        'text-left font-medium text-accent-foreground transition-ui hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <IconChevron className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
    </button>
  );
}
