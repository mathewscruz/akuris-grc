import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { IconAdd } from '@/components/icons';
import { toast } from 'sonner';
import { useDependenciasProjeto, useMutarDependencia } from '@/hooks/useProjetoCronograma';
import { criaCicloDependencia } from '@/lib/projeto-cronograma';
import { partirTitulo } from './projeto-visual';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ProjetoTarefa } from '@/types/projetos';

export function DependenciasField({ projetoId, tarefa, tarefas }: { projetoId: string; tarefa: ProjetoTarefa; tarefas: ProjetoTarefa[] }) {
  const { t } = useLanguage();
  const ids = React.useMemo(() => tarefas.map((x) => x.id), [tarefas]);
  const { data: deps = [] } = useDependenciasProjeto(projetoId, ids);
  const { add, remove } = useMutarDependencia(projetoId);
  const [open, setOpen] = React.useState(false);
  const porId = React.useMemo(() => new Map(tarefas.map((x) => [x.id, x])), [tarefas]);
  const minhas = deps.filter((d) => d.tarefa_id === tarefa.id);
  const usadas = new Set(minhas.map((d) => d.depende_de_tarefa_id));
  const candidatas = tarefas.filter((x) => x.id !== tarefa.id && !usadas.has(x.id));
  const rotulo = (x: ProjetoTarefa) => { const p = partirTitulo(x.titulo); return p.codigo ? `${p.codigo} · ${p.nome}` : p.nome; };

  const escolher = (id: string) => {
    if (criaCicloDependencia(deps, tarefa.id, id)) { toast.error(t('p3Projetos.tarefa.depCiclo')); return; }
    add.mutate({ tarefaId: tarefa.id, dependeDe: id });
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1">
      {minhas.map((d) => {
        const x = porId.get(d.depende_de_tarefa_id);
        return (
          <button key={d.depende_de_tarefa_id} type="button" title={t('common.delete')}
            onClick={() => remove.mutate({ tarefaId: tarefa.id, dependeDe: d.depende_de_tarefa_id })}
            className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/80 transition-ui hover:bg-destructive/10 hover:text-destructive">
            {x ? rotulo(x) : '—'}
          </button>
        );
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={t('p3Projetos.tarefa.depAdd')}
            className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-border px-2 text-xs text-muted-foreground hover:border-primary hover:text-primary">
            <IconAdd className="h-3 w-3" />{minhas.length === 0 && t('p3Projetos.tarefa.depAdd')}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder={t('p3Projetos.tarefa.depBuscar')} />
            <CommandList>
              <CommandEmpty>{t('p3Projetos.tarefa.depVazio')}</CommandEmpty>
              {candidatas.map((x) => (
                <CommandItem key={x.id} value={`${x.titulo} ${x.id}`} onSelect={() => escolher(x.id)}>
                  <span className="truncate">{rotulo(x)}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
