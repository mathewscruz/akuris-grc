import React from 'react';
import { cn } from '@/lib/utils';

export type StatusTone =
  | 'success'
  | 'warning'
  | 'orange'
  | 'destructive'
  | 'info'
  | 'neutral'
  | 'primary';

export type StatusVariant = 'soft' | 'solid' | 'outline';
export type StatusSize = 'sm' | 'md';
export type StatusIntensity = 'normal' | 'high';

interface StatusBadgeProps {
  tone?: StatusTone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  variant?: StatusVariant;
  /** sm: tabelas densas (text-[11px], dot 6px). md: detalhe/header (text-xs, dot 8px). */
  size?: StatusSize;
  /** high: adiciona anel concêntrico no dot — use para níveis altos (Crítico, Alto). */
  intensity?: StatusIntensity;
}

const TONE_CLASSES: Record<
  StatusTone,
  { soft: string; solid: string; outline: string; dot: string; ring: string }
> = {
  success: {
    soft: 'bg-success/10 text-success border-success/20',
    solid: 'bg-success text-success-foreground border-transparent',
    outline: 'border-success/40 text-success bg-transparent',
    dot: 'bg-success',
    ring: 'ring-2 ring-success/25',
  },
  warning: {
    soft: 'bg-warning/10 text-warning border-warning/25',
    solid: 'bg-warning text-warning-foreground border-transparent',
    outline: 'border-warning/40 text-warning bg-transparent',
    dot: 'bg-warning',
    ring: 'ring-2 ring-warning/30',
  },
  orange: {
    soft: 'bg-orange/10 text-orange border-orange/25',
    solid: 'bg-orange text-orange-foreground border-transparent',
    outline: 'border-orange/40 text-orange bg-transparent',
    dot: 'bg-orange',
    ring: 'ring-2 ring-orange/30',
  },
  destructive: {
    soft: 'bg-destructive/10 text-destructive border-destructive/20',
    solid: 'bg-destructive text-destructive-foreground border-transparent',
    outline: 'border-destructive/40 text-destructive bg-transparent',
    dot: 'bg-destructive',
    ring: 'ring-2 ring-destructive/30',
  },
  info: {
    soft: 'bg-info/10 text-info border-info/20',
    solid: 'bg-info text-info-foreground border-transparent',
    outline: 'border-info/40 text-info bg-transparent',
    dot: 'bg-info',
    ring: 'ring-2 ring-info/25',
  },
  neutral: {
    soft: 'bg-muted text-muted-foreground border-border',
    solid: 'bg-muted-foreground text-background border-transparent',
    outline: 'border-border text-muted-foreground bg-transparent',
    dot: 'bg-muted-foreground',
    ring: 'ring-2 ring-muted-foreground/20',
  },
  primary: {
    soft: 'bg-primary/10 text-primary border-primary/20',
    solid: 'bg-primary text-primary-foreground border-transparent',
    outline: 'border-primary/40 text-primary bg-transparent',
    dot: 'bg-primary',
    ring: 'ring-2 ring-primary/25',
  },
};

const SIZE_CLASSES: Record<StatusSize, { wrapper: string; dot: string }> = {
  sm: { wrapper: 'px-2 py-[2px] text-[11px] gap-1.5', dot: 'h-1.5 w-1.5' },
  md: { wrapper: 'px-2.5 py-0.5 text-xs gap-1.5', dot: 'h-2 w-2' },
};

/**
 * Pílula de status oficial Akuris.
 *
 * Anatomia:
 *  ┌─────────────────────────┐
 *  │ ● Em andamento           │
 *  └─────────────────────────┘
 *    ↑   ↑
 *    │   └── label DM Sans, font-medium
 *    └────── dot semântico (substituído por icon quando fornecido)
 *
 * Use sempre via resolvers em `src/lib/status-tone.tsx`.
 * Nunca aplique cores Tailwind cruas (bg-red-100, bg-blue-100, etc.) em badges.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  tone = 'neutral',
  children,
  icon,
  className,
  variant = 'soft',
  size = 'md',
  intensity = 'normal',
}) => {
  const styles = TONE_CLASSES[tone];
  const sizing = SIZE_CLASSES[size];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border whitespace-nowrap leading-none',
        sizing.wrapper,
        styles[variant],
        className
      )}
    >
      {icon ? (
        <span className="flex items-center [&_svg]:h-3 [&_svg]:w-3">{icon}</span>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'rounded-full flex-shrink-0',
            sizing.dot,
            styles.dot,
            intensity === 'high' && styles.ring
          )}
        />
      )}
      {children}
    </span>
  );
};

export default StatusBadge;
