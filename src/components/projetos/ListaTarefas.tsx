import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Search, CornerDownRight } from 'lucide-react';
import type { ProjetoTarefa, ProjetoColuna, ProjetoTarefaPrioridade } from '@/types/projetos';
import { PRIORIDADE_LABEL } from '@/types/projetos';

const prioridadeTone: Record<ProjetoTarefaPrioridade, 'destructive' | 'warning' | 'info' | 'neutral'> = {
  critica: 'destructive', alta: 'warning', media: 'info', baixa: 'neutral',
};

interface Props {
  tarefas: ProjetoTarefa[];
  colunas: ProjetoColuna[];
  onSelect: (t: ProjetoTarefa) => void;
}

export function ListaTarefas({ tarefas, colunas, onSelect }: Props) {
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
        key = row.t.responsavel_id ?? 'Não atribuído';
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
          <Input placeholder="Buscar tarefa…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="abertas">Em aberto</SelectItem>
            <SelectItem value="concluidas">Concluídas</SelectItem>
            <SelectItem value="atrasadas">Atrasadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fPrior} onValueChange={setFPrior}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas prioridades</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fColuna} onValueChange={setFColuna}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Coluna" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas colunas</SelectItem>
            {colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={agrupar} onValueChange={setAgrupar}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhum">Sem agrupamento</SelectItem>
            <SelectItem value="coluna">Agrupar por coluna</SelectItem>
            <SelectItem value="prioridade">Agrupar por prioridade</SelectItem>
            <SelectItem value="responsavel">Agrupar por responsável</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtradas.length} de {tarefas.length}</span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarefa</TableHead>
              <TableHead>Coluna</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grupos.length === 1 && grupos[0].rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma tarefa.</TableCell></TableRow>
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
                  {g.rows.map(({ t, depth }) => {
                    const col = colunas.find((c) => c.id === t.coluna_id);
                    const atrasada = t.prazo && !t.concluida_em && new Date(t.prazo) < new Date();
                    return (
                      <TableRow key={t.id} className="cursor-pointer" onClick={() => onSelect(t)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>
                            {depth > 0 && <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="truncate">{t.titulo}</span>
                          </div>
                        </TableCell>
                        <TableCell>{col?.nome ?? '—'}</TableCell>
                        <TableCell>
                          <StatusBadge tone={prioridadeTone[t.prioridade]} size="sm">{PRIORIDADE_LABEL[t.prioridade]}</StatusBadge>
                        </TableCell>
                        <TableCell className={atrasada ? 'text-destructive font-medium' : ''}>
                          {t.prazo ? new Date(t.prazo).toLocaleDateString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell>
                          {t.concluida_em
                            ? <StatusBadge tone="success" size="sm">Concluída</StatusBadge>
                            : <StatusBadge tone="info" size="sm">Em aberto</StatusBadge>}
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
