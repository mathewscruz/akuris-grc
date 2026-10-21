import { matchesSearch as matchesText } from '@/lib/search-utils';
import React from 'react';
import { IconSearch, IconChevron } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead, compareSortValues } from '@/components/ui/sortable-table-head';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ProjetoTarefa, ProjetoColuna, ProjetoTarefaPrioridade } from '@/types/projetos';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPrioridadeLabel } from './enum-labels';
import { intlLocale, parseDataLocal } from '@/lib/date-utils';
import { useUsuariosEmpresa } from '@/hooks/useUsuariosEmpresa';
import { isMarco, estaAtrasada, mesInicio, TAG_MARCO } from '@/lib/projeto-acompanhamento';
const prioridadeTone: Record<ProjetoTarefaPrioridade, 'destructive' | 'warning' | 'info' | 'neutral'> = {
  critica: 'destructive', alta: 'warning', media: 'info', baixa: 'neutral',
};

interface Props {
  tarefas: ProjetoTarefa[];
  colunas: ProjetoColuna[];
  onSelect: (t: ProjetoTarefa) => void;
}

export function ListaTarefas({ tarefas, colunas, onSelect }: Props) {
  const { t } = useLanguage();
  const [busca, setBusca] = React.useState('');
  const [fPrior, setFPrior] = React.useState<string>('todas');
  const [fColuna, setFColuna] = React.useState<string>('todas');
  const [fStatus, setFStatus] = React.useState<string>('todos');
  const [agrupar, setAgrupar] = React.useState<string>('nenhum');
  const [fResp, setFResp] = React.useState<string>('todos');
  const [fTipo, setFTipo] = React.useState<string>('todos');
  const { data: usuarios = [] } = useUsuariosEmpresa();
  const nomeUsuario = React.useCallback((id: string | null) => usuarios.find((u) => u.user_id === id)?.nome ?? null, [usuarios]);
  const tipos = React.useMemo(() => {
    const set = new Set<string>();
    tarefas.forEach((x) => { const tg = (x.tags ?? []).find((g) => g !== TAG_MARCO); if (tg) set.add(tg); });
    return [...set].sort();
  }, [tarefas]);
  const tipoDe = (x: ProjetoTarefa) => (isMarco(x) ? t('p3Projetos.lista.milestone') : (x.tags ?? [])[0] ?? null);

  const filtradas = React.useMemo(() => {
    return tarefas.filter((t) => {
      if (busca && !matchesText(busca, t.titulo)) return false;
      if (fPrior !== 'todas' && t.prioridade !== fPrior) return false;
      if (fColuna !== 'todas' && t.coluna_id !== fColuna) return false;
      if (fResp !== 'todos' && (t.responsavel_id ?? 'none') !== fResp) return false;
      if (fTipo !== 'todos' && !(t.tags ?? []).includes(fTipo)) return false;
      if (fStatus === 'abertas' && t.concluida_em) return false;
      if (fStatus === 'concluidas' && !t.concluida_em) return false;
      if (fStatus === 'atrasadas') {
        if (!estaAtrasada(t)) return false;
      }
      return true;
    });
  }, [tarefas, busca, fPrior, fColuna, fStatus, fResp, fTipo]);

  // Ordenação A-Z / Z-A por coluna
  const [sort, setSort] = React.useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const toggleSort = React.useCallback((field: string) => {
    setSort((prev) => (prev?.field === field
      ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { field, direction: 'asc' }));
  }, []);

  const valorOrdenacao = React.useCallback((task: ProjetoTarefa, field: string): unknown => {
    if (field === 'coluna') return colunas.find((c) => c.id === task.coluna_id)?.nome ?? '';
    return (task as any)[field];
  }, [colunas]);

  const filtradasOrdenadas = React.useMemo(() => {
    if (!sort) return filtradas;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => factor * compareSortValues(valorOrdenacao(a, sort.field), valorOrdenacao(b, sort.field)));
  }, [filtradas, sort, valorOrdenacao]);

  // Construir hierarquia (pais primeiro, depois filhos indentados)
  // Recolher/expandir por fase e domínio — guardado na sessão para não se perder ao trocar de aba.
  const chaveRecolhidos = `projeto-lista-recolhidos:${tarefas[0]?.projeto_id ?? ''}`;
  const [recolhidos, setRecolhidos] = React.useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem(chaveRecolhidos) ?? '[]')); } catch { return new Set(); }
  });
  const alternarRecolhido = (id: string) => setRecolhidos((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id);
    try { sessionStorage.setItem(chaveRecolhidos, JSON.stringify([...n])); } catch { /* sem storage */ }
    return n;
  });
  const filhosPorPai = React.useMemo(() => {
    const m = new Map<string, ProjetoTarefa[]>();
    tarefas.forEach((x) => { if (x.parent_task_id) { if (!m.has(x.parent_task_id)) m.set(x.parent_task_id, []); m.get(x.parent_task_id)!.push(x); } });
    return m;
  }, [tarefas]);
  /** Progresso de um agrupador = média das atividades-folha abaixo dele. */
  const progressoAgregado = React.useCallback((id: string): number | null => {
    const vals: number[] = [];
    const walk = (pid: string) => (filhosPorPai.get(pid) ?? []).forEach((c) => (filhosPorPai.has(c.id) ? walk(c.id) : vals.push(c.progresso_pct ?? 0)));
    walk(id);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [filhosPorPai]);

  const ordenadas = React.useMemo(() => {
    const ids = new Set(filtradasOrdenadas.map((t) => t.id));
    const pais = filtradasOrdenadas.filter((t) => !t.parent_task_id || !ids.has(t.parent_task_id));
    const result: { t: ProjetoTarefa; depth: number }[] = [];
    const pushWithChildren = (t: ProjetoTarefa, depth: number) => {
      result.push({ t, depth });
      if (recolhidos.has(t.id) && agrupar === 'nenhum') return;
      const filhos = filtradasOrdenadas.filter((c) => c.parent_task_id === t.id);
      filhos.forEach((c) => pushWithChildren(c, depth + 1));
    };
    pais.forEach((p) => pushWithChildren(p, 0));
    return result;
  }, [filtradasOrdenadas, recolhidos, agrupar]);

  // Agrupar
  const grupos = React.useMemo(() => {
    if (agrupar === 'nenhum') return [{ key: '', label: '', rows: ordenadas }];
    const m = new Map<string, typeof ordenadas>();
    ordenadas.forEach((row) => {
      let key = '—';
      if (agrupar === 'coluna') {
        const c = colunas.find((x) => x.id === row.t.coluna_id);
        key = c?.nome ?? '—';
      } else if (agrupar === 'prioridade') {
        key = getPrioridadeLabel(t, row.t.prioridade);
      } else if (agrupar === 'responsavel') {
        key = nomeUsuario(row.t.responsavel_id) ?? t('projetos.lista.notAssigned');
      } else if (agrupar === 'tipo') {
        key = tipoDe(row.t) ?? '—';
      } else if (agrupar === 'mes') {
        const mk = mesInicio(row.t);
        key = mk ? new Date(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)) - 1, 1).toLocaleDateString(intlLocale(), { month: 'long', year: 'numeric' }) : '—';
      }
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(row);
    });
    return [...m.entries()].map(([key, rows]) => ({ key, label: key, rows }));
  }, [ordenadas, agrupar, colunas, nomeUsuario]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <IconSearch className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('projetos.lista.searchPlaceholder')} value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-xs font-medium text-muted-foreground">{t('p3Projetos.lista.filterStatusLabel')}</span>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="h-9 w-full" title={fStatus}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t('projetos.lista.statusAll')}</SelectItem>
              <SelectItem value="abertas">{t('projetos.lista.statusOpen')}</SelectItem>
              <SelectItem value="concluidas">{t('projetos.lista.statusDone')}</SelectItem>
              <SelectItem value="atrasadas">{t('projetos.lista.statusOverdue')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-xs font-medium text-muted-foreground">{t('p3Projetos.lista.filterPriorityLabel')}</span>
          <Select value={fPrior} onValueChange={setFPrior}>
            <SelectTrigger className="h-9 w-full" title={fPrior}><SelectValue placeholder={t('projetos.tarefaDialog.fieldPrioridade')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">{t('projetos.lista.priorityAll')}</SelectItem>
              <SelectItem value="critica">{getPrioridadeLabel(t, 'critica')}</SelectItem>
              <SelectItem value="alta">{getPrioridadeLabel(t, 'alta')}</SelectItem>
              <SelectItem value="media">{getPrioridadeLabel(t, 'media')}</SelectItem>
              <SelectItem value="baixa">{getPrioridadeLabel(t, 'baixa')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-xs font-medium text-muted-foreground">{t('p3Projetos.lista.filterColumnLabel')}</span>
          <Select value={fColuna} onValueChange={setFColuna}>
            <SelectTrigger className="h-9 w-full" title={colunas.find((c) => c.id === fColuna)?.nome ?? fColuna}><SelectValue placeholder={t('projetos.tarefaDialog.fieldColuna')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">{t('projetos.lista.columnAll')}</SelectItem>
              {colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-xs font-medium text-muted-foreground">{t('p3Projetos.lista.filterGroupLabel')}</span>
          <Select value={agrupar} onValueChange={setAgrupar}>
            <SelectTrigger className="h-9 w-full" title={agrupar}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">{t('projetos.lista.groupNone')}</SelectItem>
              <SelectItem value="coluna">{t('projetos.lista.groupColumn')}</SelectItem>
              <SelectItem value="prioridade">{t('projetos.lista.groupPriority')}</SelectItem>
              <SelectItem value="responsavel">{t('projetos.lista.groupResponsible')}</SelectItem>
              <SelectItem value="tipo">{t('p3Projetos.lista.groupType')}</SelectItem>
              <SelectItem value="mes">{t('p3Projetos.lista.groupMonth')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-xs font-medium text-muted-foreground">{t('p3Projetos.lista.filterResponsibleLabel')}</span>
          <Select value={fResp} onValueChange={setFResp}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t('p3Projetos.lista.responsibleAll')}</SelectItem>
              <SelectItem value="none">{t('projetos.lista.notAssigned')}</SelectItem>
              {usuarios.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.nome ?? u.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {tipos.length > 0 && (
          <div className="flex flex-col gap-1 min-w-[180px]">
            <span className="text-xs font-medium text-muted-foreground">{t('p3Projetos.lista.filterTypeLabel')}</span>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t('p3Projetos.lista.typeAll')}</SelectItem>
                <SelectItem value={TAG_MARCO}>{t('p3Projetos.lista.milestone')}</SelectItem>
                {tipos.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{t('projetos.lista.filteredOf', { filtered: filtradas.length, total: tarefas.length })}</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table className="border-collapse border-spacing-0">
          <TableHeader>
            <TableRow data-table-static className="bg-muted/40">
              <SortableTableHead field="titulo" sort={sort} onSort={toggleSort}>{t('projetos.lista.colTarefa')}</SortableTableHead>
              <TableHead>{t('p3Projetos.lista.colTipo')}</TableHead>
              <SortableTableHead field="responsavel_id" sort={sort} onSort={toggleSort}>{t('p3Projetos.lista.colResponsavel')}</SortableTableHead>
              <SortableTableHead field="data_inicio" sort={sort} onSort={toggleSort}>{t('p3Projetos.lista.colPeriodo')}</SortableTableHead>
              <SortableTableHead field="progresso_pct" sort={sort} onSort={toggleSort}>{t('p3Projetos.lista.colProgresso')}</SortableTableHead>
              <SortableTableHead field="coluna" sort={sort} onSort={toggleSort}>{t('projetos.lista.colStatus')}</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grupos.length === 1 && grupos[0].rows.length === 0 ? (
              <TableRow data-table-static><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t('projetos.lista.noTasks')}</TableCell></TableRow>
            ) : (
              grupos.map((g) => (
                <React.Fragment key={g.key}>
                  {g.label && (
                    <TableRow data-table-static>
                      <TableCell colSpan={6} className="bg-muted/40 text-xs font-semibold text-muted-foreground py-1.5">
                        {g.label} <span className="text-muted-foreground">({g.rows.length})</span>
                      </TableCell>
                    </TableRow>
                  )}
                  {g.rows.map(({ t: task, depth }) => {
                    const col = colunas.find((c) => c.id === task.coluna_id);
                    const atrasada = estaAtrasada(task);
                    const fmt = (d: string | null) => (d ? parseDataLocal(d).toLocaleDateString(intlLocale()) : '—');
                    const tags = task.tags ?? [];
                    const temFilhos = filhosPorPai.has(task.id);
                    const nivel: 'fase' | 'dominio' | 'atividade' = temFilhos ? (depth === 0 ? 'fase' : 'dominio') : 'atividade';
                    const agregado = temFilhos ? progressoAgregado(task.id) : null;
                    const pct = Math.max(0, Math.min(100, agregado ?? task.progresso_pct ?? 0));
                    const m = task.titulo.match(/^([A-Z]{1,3}\d+(?:\.\d+)*)\s+—\s+(.*)$/);
                    const codigo = m?.[1] ?? null;
                    let nome = m?.[2] ?? task.titulo;
                    if (nivel !== 'atividade') nome = nome.replace(/^(FASE|DOMÍNIO|DOMINIO)\s+\d+\s+—\s+/i, '');
                    const recolhido = recolhidos.has(task.id);
                    const linhaCls = nivel === 'fase'
                      ? 'bg-primary/[0.08] hover:bg-primary/[0.12]'
                      : nivel === 'dominio'
                        ? 'bg-[hsl(var(--chart-teal)/0.08)] hover:bg-[hsl(var(--chart-teal)/0.13)]'
                        : 'bg-card hover:bg-muted/40';
                    const barra = nivel === 'fase'
                      ? 'shadow-[inset_3px_0_0_hsl(var(--primary))]'
                      : nivel === 'dominio' ? 'shadow-[inset_3px_0_0_hsl(var(--chart-teal))]' : '';
                    const status: StatusKind = col?.is_concluido || task.concluida_em ? 'done' : atrasada || /atras/i.test(col?.nome ?? '') ? 'late' : /andamento|progress/i.test(col?.nome ?? '') ? 'active' : 'rest';
                    const statusLabel = status === 'late' && !/atras/i.test(col?.nome ?? '') ? t('projetos.lista.statusOverdue') : col?.nome ?? '—';
                    return (
                      <TableRow key={task.id} data-table-static className={`cursor-pointer border-b border-border/60 transition-colors ${linhaCls}`} onClick={() => onSelect(task)}>
                        <TableCell className={`py-2.5 ${barra}`}>
                          <div className="flex items-center gap-2" style={{ paddingLeft: depth * 22 }}>
                            {temFilhos ? (
                              <button type="button" onClick={(e) => { e.stopPropagation(); alternarRecolhido(task.id); }}
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-background/70"
                                aria-label={recolhido ? t('p3Projetos.tarefa.expand') : t('p3Projetos.tarefa.collapse')} aria-expanded={!recolhido}>
                                <IconChevron className={`h-3.5 w-3.5 transition-transform ${recolhido ? '' : 'rotate-90'}`} />
                              </button>
                            ) : depth > 0 ? (
                              <span aria-hidden className="ml-2 h-3 w-3 shrink-0 rounded-bl border-b border-l border-border" />
                            ) : null}
                            {codigo && (
                              <span className={nivel === 'fase'
                                ? 'shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground tabular-nums'
                                : nivel === 'dominio'
                                  ? 'shrink-0 rounded-md bg-[hsl(var(--chart-teal))] px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground tabular-nums'
                                  : 'shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary tabular-nums'}>{codigo}</span>
                            )}
                            {isMarco(task) && <span className="text-[hsl(var(--fw-gold))]" aria-label={t('p3Projetos.lista.milestone')} title={t('p3Projetos.lista.milestone')}>◆</span>}
                            <span className={nivel === 'fase' ? 'truncate font-bold text-foreground' : nivel === 'dominio' ? 'truncate font-semibold text-foreground' : 'truncate text-foreground/90'}>{nome}</span>
                            {temFilhos && <span className="text-xs text-muted-foreground">({filhosPorPai.get(task.id)!.length})</span>}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground max-w-[200px]">
                          <span className="block truncate" title={tags.join(' · ')}>{tags.filter((g) => g !== TAG_MARCO).join(' · ') || (isMarco(task) ? t('p3Projetos.lista.milestone') : '—')}</span>
                        </TableCell>
                        <TableCell className="py-2.5 text-sm">{nomeUsuario(task.responsavel_id) ?? <span className="text-muted-foreground">{t('projetos.lista.notAssigned')}</span>}</TableCell>
                        <TableCell className={`py-2.5 text-xs tabular-nums whitespace-nowrap ${atrasada ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {fmt(task.data_inicio)} → {fmt(task.data_fim ?? task.prazo)}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2 min-w-[110px]">
                            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden"><div className={pct >= 100 ? 'h-full bg-success' : nivel === 'dominio' ? 'h-full bg-[hsl(var(--chart-teal))]' : 'h-full bg-primary'} style={{ width: `${pct}%` }} /></div>
                            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5"><StatusPill kind={status}>{statusLabel}</StatusPill></TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
