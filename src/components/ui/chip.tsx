import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Chip Akuris — componente ÚNICO de pílula (Envio 9).
 * --------------------------------------------------------------------------
 * Um só tratamento visual por família: mesmo peso, mesmo raio, mesma altura,
 * mesmo tamanho de letra em toda a aplicação. Não existe versão "sólida" a
 * competir com a versão "suave" dentro da mesma escala.
 *
 * Famílias:
 *  - severity  → risco/criticidade. Única família com cor semântica
 *                (vermelho/laranja/âmbar/verde) e sempre com a letra C/A/M/B.
 *  - state     → estados de processo (Ativo, Rascunho, Em andamento…).
 *                Família neutra por padrão; conclusão recebe teal e estados
 *                bloqueados/vencidos recebem vermelho por exigirem ação.
 *  - type      → tipo/classificação. NÃO é pílula: é texto.
 *  - category  → categorias livres. NÃO é pílula: é texto.
 *
 * As duas últimas descrevem o que a coisa É, e ninguém age sobre um tipo.
 * Desenhá-las como pílula punha quatro caixas por linha de tabela e gastava
 * em taxonomia a atenção que devia sobrar para o estado.
 *
 * O roxo da marca não é usado aqui: fica reservado a ação e navegação ativa.
 */

export type ChipFamily = 'severity' | 'state' | 'type' | 'category';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type StateLevel = 'rest' | 'active' | 'done' | 'attention' | 'blocked';

export type ChipTone = SeverityLevel | StateLevel | 'neutral';


const SEVERITY_CLASSES: Record<SeverityLevel, { chip: string; mark: string }> = {
  critical: {
    chip: 'bg-severity-critical/10 text-severity-critical border-severity-critical/25',
    mark: 'bg-severity-critical text-background',
  },
  high: {
    chip: 'bg-severity-high/10 text-severity-high border-severity-high/25',
    mark: 'bg-severity-high text-background',
  },
  medium: {
    chip: 'bg-severity-medium/10 text-severity-medium border-severity-medium/25',
    mark: 'bg-severity-medium text-background',
  },
  low: {
    chip: 'bg-severity-low/10 text-severity-low border-severity-low/25',
    mark: 'bg-severity-low text-background',
  },
  none: {
    chip: 'bg-severity-none/10 text-severity-none border-severity-none/25',
    mark: 'bg-severity-none text-background',
  },
};

const STATE_CLASSES: Record<StateLevel, { chip: string; dot: string }> = {
  rest: {
    chip: 'bg-state-rest-surface text-state-rest border-border',
    dot: 'bg-state-rest',
  },
  active: {
    chip: 'bg-state-active-surface text-state-active border-border',
    dot: 'bg-state-active',
  },
  done: {
    chip: 'bg-state-done-surface text-state-done border-state-done/25',
    dot: 'bg-state-done',
  },
  attention: {
    chip: 'bg-state-rest-surface text-state-rest border-border',
    dot: 'bg-severity-medium',
  },
  blocked: {
    // Bloqueado/vencido exige ação: o ponto vermelho sozinho perdia-se entre
    // estados neutros, especialmente na tabela de Planos de Ação.
    chip: 'bg-destructive/10 text-destructive border-destructive/25',
    dot: 'bg-destructive',
  },
};

const NEUTRAL_CHIP = 'bg-muted text-muted-foreground border-border';

/**
 * Um chip, um tamanho.
 *
 * Havia `sm` e `md`, com pontos de 6px e de 8px. Como 238 dos 246 usos já
 * pediam `sm` e os restantes não pediam nada — logo caíam no `md` por
 * omissão — a mesma tela mostrava as duas bolinhas lado a lado sem que
 * ninguém o tivesse decidido. Um chip de estado não precisa de escala: ou
 * cabe numa célula de tabela, ou não é um chip.
 *
 * A sigla usa o mesmo corpo do rótulo (`text-micro`) para que nenhuma das
 * duas metades do chip domine a outra.
 */
const CHIP_SIZING = {
  wrapper: 'h-5 px-2 text-micro gap-1.5',
  dot: 'h-1.5 w-1.5',
  mark: 'h-3.5 w-3.5 text-micro',
} as const;

export interface ChipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  family?: ChipFamily;
  /** Nível dentro da família. Ignorado nas famílias type/category. */
  tone?: ChipTone;
  /** Letra redundante à cor (WCAG 1.4.1): C/A/M/B na escala de severidade. */
  mark?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const isSeverity = (tone: ChipTone): tone is SeverityLevel =>
  tone === 'critical' || tone === 'high' || tone === 'medium' || tone === 'low' || tone === 'none';

const isState = (tone: ChipTone): tone is StateLevel =>
  tone === 'rest' || tone === 'active' || tone === 'done' || tone === 'attention' || tone === 'blocked';

export const Chip: React.FC<ChipProps> = ({
  family = 'state',
  tone = 'neutral',
  mark,
  icon,
  children,
  className,
  ...props
}) => {

  /*
    Taxonomia sai da caixa.

    Devolve-se texto simples — sem fundo, sem borda, sem altura fixa —, o que
    liberta a cor e a forma para o que exige decisão. Continua a ser o mesmo
    componente e a mesma chamada: quem escreve o ecrã não muda nada.
  */
  if (family === 'type' || family === 'category') {
    return (
      <span className={cn('text-xs text-muted-foreground', className)} {...props}>
        {children}
      </span>
    );
  }

  let chipClass = NEUTRAL_CHIP;
  let leading: React.ReactNode = null;

  if (family === 'severity' && isSeverity(tone)) {
    const s = SEVERITY_CLASSES[tone];
    chipClass = s.chip;
    leading = mark ? (
      <span
        aria-hidden="true"
        /* `font-semibold` e não `font-bold`: a letra tem o mesmo corpo do
           rótulo, mas a 700 contra os 500 dele, dentro de uma caixa cheia,
           lia-se maior do que o nome que devia acompanhar. O peso é que
           desequilibrava, não o tamanho. */
        className={cn(
          'inline-flex items-center justify-center rounded-md font-semibold leading-none flex-shrink-0',
          CHIP_SIZING.mark,
          s.mark,
        )}
      >
        {mark}
      </span>
    ) : (
      <span aria-hidden="true" className={cn('rounded-full flex-shrink-0', CHIP_SIZING.dot, s.mark)} />
    );
  } else if (family === 'state') {
    const s = STATE_CLASSES[isState(tone) ? tone : 'rest'];
    chipClass = s.chip;
    leading = <span aria-hidden="true" className={cn('rounded-full flex-shrink-0', CHIP_SIZING.dot, s.dot)} />;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-medium leading-none whitespace-nowrap',
        CHIP_SIZING.wrapper,
        chipClass,
        className,
      )}
      {...props}
    >
      {icon ? <span className="flex items-center [&_svg]:h-3 [&_svg]:w-3">{icon}</span> : leading}
      {children}
    </span>
  );
};
