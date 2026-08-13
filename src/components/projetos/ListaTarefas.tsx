import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Search, CornerDownRight } from 'lucide-react';
import type { ProjetoTarefa, ProjetoColuna, ProjetoTarefaPrioridade } from '@/types/projetos';
import { PRIORIDADE_LABEL } from '@/types/projetos';
import { useLanguage } from '@/contexts/LanguageContext';

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

  const filtradas = React.useMemo(() => {
    return tarefas.filter((t) => {
      if (busca && !t.titulo.toLowerCase().includes(busca.toLowerCase())) return false;
      if (fPrior !== 'todas' && t.prioridade !== fPrior) return false;
      if (fColuna !== 'todas' && t.coluna_id !== fColuna) return false;
      if (fStatus === 'abertas' && t.concluida_em) return false;
      if (fStatus === 'concluidas' && !t.concluida_em) return false;
      if (fStatus === 'atrasadas') {
        const atrasada = t.prazo && !t.concluida_em && new Date(t.prazo) < new Date();
        if (!atrasada) return false;
      }
      return true;
    });
  }, [tarefas, busca, fPrior, fColuna, fStatus]);

  // Construir hierarquia (pais primeiro, depois filhos indentados)
  const ordenadas = React.useMemo(() => {
    const ids = new Set(filtradas.map((t) => t.id));
    const pais = filtradas.filter((t) => !t.parent_task_id || !ids.has(t.parent_task_id));
    const result: { t: ProjetoTarefa; depth: number }[] = [];
    const pushWithChildren = (t: ProjetoTarefa, depth: number) => {
      result.push({ t, depth });
      const filhos = filtradas.filter((c) => c.parent_task_id === t.id);
      filhos.forEach((c) => pushWithChildren(c, depth + 1));
    };
    pais.forEach((p) => pushWithChildren(p, 0));
    return result;
  }, [filtradas]);

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
        key = PRIORIDADE_LABEL[row.t.prioridade];
      } else if (agrupar === 'responsavel') {
        key = row.t.responsavel_id ?? t('projetos.lista.notAssigned');
      }
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(row);
    });
    return [...m.entries()].map(([key, rows]) => ({ key, label: key, rows }));
  }, [ordenadas, agrupar, colunas]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('projetos.lista.searchPlaceholder')} value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">{t('projetos.lista.statusAll')}</SelectItem>
            <SelectItem value="abertas">{t('projetos.lista.statusOpen')}</SelectItem>
            <SelectItem value="concluidas">{t('projetos.lista.statusDone')}</SelectItem>
            <SelectItem value="atrasadas">{t('projetos.lista.statusOverdue')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fPrior} onValueChange={setFPrior}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder={t('projetos.tarefaDialog.fieldPrioridade')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">{t('projetos.lista.priorityAll')}</SelectItem>
            <SelectItem value="critica">{PRIORIDADE_LABEL.critica}</SelectItem>
            <SelectItem value="alta">{PRIORIDADE_LABEL.alta}</SelectItem>
            <SelectItem value="media">{PRIORIDADE_LABEL.media}</SelectItem>
            <SelectItem value="baixa">{PRIORIDADE_LABEL.baixa}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fColuna} onValueChange={setFColuna}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder={t('projetos.tarefaDialog.fieldColuna')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">{t('projetos.lista.columnAll')}</SelectItem>
            {colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={agrupar} onValueChange={setAgrupar}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhum">{t('projetos.lista.groupNone')}</SelectItem>
            <SelectItem value="coluna">{t('projetos.lista.groupColumn')}</SelectItem>
            <SelectItem value="prioridade">{t('projetos.lista.groupPriority')}</SelectItem>
            <SelectItem value="responsavel">{t('projetos.lista.groupResponsible')}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{t('projetos.lista.filteredOf', { filtered: filtradas.length, total: tarefas.length })}</span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('projetos.lista.colTarefa')}</TableHead>
              <TableHead>{t('projetos.lista.colColuna')}</TableHead>
              <TableHead>{t('projetos.lista.colPrioridade')}</TableHead>
              <TableHead>{t('projetos.lista.colPrazo')}</TableHead>
              <TableHead>{t('projetos.lista.colStatus')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grupos.length === 1 && grupos[0].rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t('projetos.lista.noTasks')}</TableCell></TableRow>
            ) : (
              grupos.map((g) => (
                <React.Fragment key={g.key}>
                  {g.label && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground py-1.5">
                        {g.label} <span className="text-muted-foreground/70">({g.rows.length})</span>
                      </TableCell>
                    </TableRow>
                  )}
                  {g.rows.map(({ t: task, depth }) => {
                    const col = colunas.find((c) => c.id === task.coluna_id);
                    const atrasada = task.prazo && !task.concluida_em && new Date(task.prazo) < new Date();
                    return (
                      <TableRow key={task.id} className="cursor-pointer" onClick={() => onSelect(task)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>
                            {depth > 0 && <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="truncate">{task.titulo}</span>
                          </div>
                        </TableCell>
                        <TableCell>{col?.nome ?? '—'}</TableCell>
                        <TableCell>
                          <StatusBadge tone={prioridadeTone[task.prioridade]} size="sm">{PRIORIDADE_LABEL[task.prioridade]}</StatusBadge>
                        </TableCell>
                        <TableCell className={atrasada ? 'text-destructive font-medium' : ''}>
                          {task.prazo ? new Date(task.prazo).toLocaleDateString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell>
                          {task.concluida_em
                            ? <StatusBadge tone="success" size="sm">{t('projetos.lista.done')}</StatusBadge>
                            : <StatusBadge tone="info" size="sm">{t('projetos.lista.open')}</StatusBadge>}
                        </TableCell>
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
