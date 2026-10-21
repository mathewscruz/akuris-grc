import React from 'react';
import { cn } from '@/lib/utils';

export type StatusKind = 'rest' | 'active' | 'done' | 'late';

const CLS: Record<StatusKind, string> = {
  rest: 'bg-muted text-muted-foreground',
  active: 'bg-state-active-surface text-state-active',
  done: 'bg-state-done-surface text-state-done',
  late: 'bg-destructive/10 text-destructive',
};
const DOT: Record<StatusKind, string> = {
  rest: 'bg-muted-foreground/60',
  active: 'bg-state-active',
  done: 'bg-state-done',
  late: 'bg-destructive',
};

/** Etapa de uma tarefa de projeto: pílula tonal (fundo suave + ponto), no padrão do modelo da lista. */
export function StatusPill({ kind, children, className }: { kind: StatusKind; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', CLS[kind], className)}>
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', DOT[kind])} />
      {children}
    </span>
  );
}

export function statusKindDe(col: { nome?: string | null; is_concluido?: boolean | null } | undefined, atrasada = false): StatusKind {
  if (col?.is_concluido) return 'done';
  if (atrasada || /atras|overdue|late/i.test(col?.nome ?? '')) return 'late';
  if (/andamento|progress/i.test(col?.nome ?? '')) return 'active';
  return 'rest';
}
