import React from 'react';
import { cn } from '@/lib/utils';
import type { ProjetoTarefa } from '@/types/projetos';

/**
 * Padrão visual partilhado pelas abas de Projetos (Lista, Kanban, Gantt, Calendário…):
 * código em chip, nível hierárquico (fase / domínio / atividade) e avatar com foto.
 */
export type Nivel = 'fase' | 'dominio' | 'atividade';

export function partirTitulo(titulo: string): { codigo: string | null; nome: string } {
  const m = titulo.match(/^([A-Z]{1,3}\d+(?:\.\d+)*)\s+—\s+(.*)$/);
  const nome = (m?.[2] ?? titulo).replace(/^(FASE|DOMÍNIO|DOMINIO)\s+\d+\s+—\s+/i, '');
  return { codigo: m?.[1] ?? null, nome };
}

export function mapaFilhos(tarefas: ProjetoTarefa[]) {
  const m = new Map<string, ProjetoTarefa[]>();
  tarefas.forEach((x) => { if (x.parent_task_id) { if (!m.has(x.parent_task_id)) m.set(x.parent_task_id, []); m.get(x.parent_task_id)!.push(x); } });
  return m;
}

export function nivelDe(t: ProjetoTarefa, filhos: Map<string, ProjetoTarefa[]>, depth: number): Nivel {
  if (!filhos.has(t.id)) return 'atividade';
  return depth === 0 ? 'fase' : 'dominio';
}

export const NIVEL_ROW: Record<Nivel, string> = {
  fase: 'bg-primary/[0.08] shadow-[inset_3px_0_0_hsl(var(--primary))]',
  dominio: 'bg-[hsl(var(--chart-teal)/0.08)] shadow-[inset_3px_0_0_hsl(var(--chart-teal))]',
  atividade: '',
};

export function CodeChip({ codigo, nivel, className }: { codigo: string; nivel: Nivel; className?: string }) {
  return (
    <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
      nivel === 'fase' ? 'bg-primary text-primary-foreground'
        : nivel === 'dominio' ? 'bg-[hsl(var(--chart-teal))] text-primary-foreground'
          : 'bg-primary/10 text-primary font-medium', className)}>{codigo}</span>
  );
}

export function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function UserAvatar({ nome, foto, size = 24, className }: { nome: string; foto?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (foto) return <img src={foto} alt={nome} title={nome} style={style} className={cn('shrink-0 rounded-full object-cover ring-2 ring-card', className)} />;
  return (
    <span title={nome} style={{ ...style, fontSize: Math.max(9, size * 0.4) }}
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ring-2 ring-card', className)}>
      {iniciais(nome)}
    </span>
  );
}
