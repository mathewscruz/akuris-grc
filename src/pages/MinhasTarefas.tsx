import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { ListTodo, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import type { ProjetoTarefa, ProjetoTarefaPrioridade } from '@/types/projetos';
import { PRIORIDADE_LABEL } from '@/types/projetos';

const prioridadeTone: Record<ProjetoTarefaPrioridade, 'destructive' | 'warning' | 'info' | 'neutral'> = {
  critica: 'destructive', alta: 'warning', media: 'info', baixa: 'neutral',
};

type Row = ProjetoTarefa & { projeto_nome?: string };

export default function MinhasTarefas() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const userId = user?.id;

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ['minhas-tarefas', userId, empresaId],
    enabled: !!userId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_tarefas' as any)
        .select('*, projetos!inner(nome, empresa_id)')
        .eq('empresa_id', empresaId!)
        .eq('responsavel_id', userId!)
        .order('prazo', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((t: any) => ({ ...t, projeto_nome: t.projetos?.nome })) as Row[];
    },
  });

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);

  const buckets = React.useMemo(() => {
    const atrasadas: Row[] = [], hojeArr: Row[] = [], semana: Row[] = [], depois: Row[] = [], sem: Row[] = [], concluidas: Row[] = [];
    tarefas.forEach((t) => {
      if (t.concluida_em) { concluidas.push(t); return; }
      if (!t.prazo) { sem.push(t); return; }
      const d = new Date(t.prazo); d.setHours(0, 0, 0, 0);
      if (d < hoje) atrasadas.push(t);
      else if (d.getTime() === hoje.getTime()) hojeArr.push(t);
      else if (d < em7) semana.push(t);
      else depois.push(t);
    });
    return { atrasadas, hoje: hojeArr, semana, depois, sem, concluidas };
  }, [tarefas, hoje, em7]);

  const renderGrupo = (label: string, rows: Row[], tone: 'destructive' | 'warning' | 'info' | 'neutral' | 'success') => {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={tone} size="sm">{label}</StatusBadge>
          <span className="text-xs text-muted-foreground">{rows.length} tarefa{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/projetos/${t.projeto_id}`)}>
                  <TableCell className="font-medium">{t.titulo}</TableCell>
                  <TableCell>{t.projeto_nome ?? '—'}</TableCell>
                  <TableCell>
                    <StatusBadge tone={prioridadeTone[t.prioridade]} size="sm">{PRIORIDADE_LABEL[t.prioridade]}</StatusBadge>
                  </TableCell>
                  <TableCell>{t.prazo ? new Date(t.prazo).toLocaleDateString('pt-BR') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Minhas tarefas</h1>
        <p className="text-sm text-muted-foreground mt-1">Tudo o que está atribuído a você nos projetos, organizado por urgência.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Atrasadas" value={buckets.atrasadas.length} icon={<AlertTriangle />} variant="destructive" />
        <StatCard title="Hoje" value={buckets.hoje.length} icon={<Clock />} variant="warning" />
        <StatCard title="Esta semana" value={buckets.semana.length} icon={<ListTodo />} variant="info" />
        <StatCard title="Concluídas" value={buckets.concluidas.length} icon={<CheckCircle2 />} variant="success" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><AkurisPulse size={56} /></div>
      ) : tarefas.length === 0 ? (
        <EmptyState
          variant="illustrated"
          icon={<ListTodo className="h-8 w-8" />}
          title="Nenhuma tarefa atribuída"
          description="Quando algum projeto te atribuir uma tarefa, ela aparece aqui."
        />
      ) : (
        <div className="space-y-6">
          {renderGrupo('Atrasadas', buckets.atrasadas, 'destructive')}
          {renderGrupo('Hoje', buckets.hoje, 'warning')}
          {renderGrupo('Esta semana', buckets.semana, 'info')}
          {renderGrupo('Depois', buckets.depois, 'neutral')}
          {renderGrupo('Sem prazo', buckets.sem, 'neutral')}
          {renderGrupo('Concluídas', buckets.concluidas, 'success')}
        </div>
      )}
    </div>
  );
}
