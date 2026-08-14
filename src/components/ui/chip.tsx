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
 *                Família NEUTRA; só o estado terminal positivo recebe um
 *                acento discreto (teal), nunca o verde da severidade.
 *  - type      → tipo/classificação. Sem alarme, tinta neutra.
 *  - category  → categorias livres. Sem alarme, tinta neutra.
 *
 * O roxo da marca não é usado aqui: fica reservado a ação e navegação ativa.
 */

export type ChipFamily = 'severity' | 'state' | 'type' | 'category';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type StateLevel = 'rest' | 'active' | 'done' | 'attention' | 'blocked';

export type ChipTone = SeverityLevel | StateLevel | 'neutral';

export type ChipSize = 'sm' | 'md';

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
    chip: 'bg-state-rest-surface text-state-rest border-border',
    dot: 'bg-severity-critical',
  },
};

const NEUTRAL_CHIP = 'bg-muted text-muted-foreground border-border';

/** Altura, raio e letra são iguais em TODAS as famílias. */
const SIZE_CLASSES: Record<ChipSize, { wrapper: string; dot: string; mark: string }> = {
  sm: { wrapper: 'h-5 px-2 text-[11px] gap-1.5', dot: 'h-1.5 w-1.5', mark: 'h-3.5 w-3.5 text-[9px]' },
  md: { wrapper: 'h-6 px-2.5 text-xs gap-1.5', dot: 'h-2 w-2', mark: 'h-4 w-4 text-[10px]' },
};

export interface ChipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  family?: ChipFamily;
  /** Nível dentro da família. Ignorado nas famílias type/category. */
  tone?: ChipTone;
  size?: ChipSize;
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
  size = 'md',
  mark,
  icon,
  children,
  className,
  ...props
}) => {
  const sizing = SIZE_CLASSES[size];

  let chipClass = NEUTRAL_CHIP;
  let leading: React.ReactNode = null;

  if (family === 'severity' && isSeverity(tone)) {
    const s = SEVERITY_CLASSES[tone];
    chipClass = s.chip;
    leading = mark ? (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center justify-center rounded-[3px] font-bold leading-none flex-shrink-0',
          sizing.mark,
          s.mark,
        )}
      >
        {mark}
      </span>
    ) : (
      <span aria-hidden="true" className={cn('rounded-full flex-shrink-0', sizing.dot, s.mark)} />
    );
  } else if (family === 'state') {
    const s = STATE_CLASSES[isState(tone) ? tone : 'rest'];
    chipClass = s.chip;
    leading = <span aria-hidden="true" className={cn('rounded-full flex-shrink-0', sizing.dot, s.dot)} />;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium leading-none whitespace-nowrap',
        sizing.wrapper,
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

export default Chip;
