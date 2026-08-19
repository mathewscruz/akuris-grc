import React from 'react';
import { IconSuccess, IconWarning, IconTime, IconChecklist } from '@/components/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead, compareSortValues } from '@/components/ui/sortable-table-head';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatStrip } from '@/components/ui/stat-strip';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/i18n-format';
import { parseDataLocal } from '@/lib/date-utils';

type Prioridade = 'critica' | 'alta' | 'media' | 'baixa';

const prioridadeTone: Record<Prioridade, 'destructive' | 'warning' | 'info' | 'neutral'> = {
  critica: 'destructive', alta: 'warning', media: 'info', baixa: 'neutral',
};

const normPrioridade = (p?: string | null): Prioridade =>
  (['critica', 'alta', 'media', 'baixa'].includes(p as string) ? p : 'media') as Prioridade;

// Origem unifica as duas fontes de "coisas a fazer" atribuídas ao usuário:
// tarefas de projeto (Kanban) e planos de ação (remediação de controles/auditorias/incidentes).
type Origem = 'projeto' | 'plano';

type Row = {
  id: string;
  titulo: string;
  origem: Origem;
  /** Nome do projeto (origem projeto) ou módulo de origem (origem plano) — dado do banco. */
  origemRef: string | null;
  prioridade: Prioridade;
  prazo: string | null;
  concluida: boolean;
  href: string;
};

export default function MinhasTarefas() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { user, profile } = useAuth();

  const empresaId = profile?.empresa_id;
  const userId = user?.id;

  const { data: tarefasProjeto = [], isLoading: loadingProjeto } = useQuery({
    queryKey: ['minhas-tarefas-projeto', userId, empresaId],
    enabled: !!userId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_tarefas' as any)
        .select('*, projetos!inner(nome, empresa_id)')
        .eq('empresa_id', empresaId!)
        .eq('responsavel_id', userId!)
        .order('prazo', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((t: any): Row => ({
        id: `projeto-${t.id}`,
        titulo: t.titulo,
        origem: 'projeto',
        origemRef: t.projetos?.nome ?? null,
        prioridade: normPrioridade(t.prioridade),
        prazo: t.prazo ?? null,
        concluida: !!t.concluida_em,
        href: `/projetos/${t.projeto_id}`,
      }));
    },
  });

  const { data: planosAcao = [], isLoading: loadingPlanos } = useQuery({
    queryKey: ['minhas-tarefas-planos', userId, empresaId],
    enabled: !!userId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_acao')
        .select('id, titulo, status, prioridade, prazo, data_conclusao, modulo_origem, responsavel_id, empresa_id')
        .eq('empresa_id', empresaId!)
        .eq('responsavel_id', userId!)
        .order('prazo', { ascending: true, nullsFirst: false });
      if (error) throw error;
      const doneStatus = /conclu|resolv|fechad|cancel/;
      return (data ?? []).map((p: any): Row => ({
        id: `plano-${p.id}`,
        titulo: p.titulo,
        origem: 'plano',
        origemRef: p.modulo_origem ? formatStatus(p.modulo_origem) : null,
        prioridade: normPrioridade(p.prioridade),
        prazo: p.prazo ?? null,
        concluida: !!p.data_conclusao || doneStatus.test((p.status ?? '').toLowerCase()),
        href: '/planos-acao',
      }));
    },
  });

  const isLoading = loadingProjeto || loadingPlanos;
  const itens = React.useMemo<Row[]>(() => [...tarefasProjeto, ...planosAcao], [tarefasProjeto, planosAcao]);

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);

  const buckets = React.useMemo(() => {
    const atrasadas: Row[] = [], hojeArr: Row[] = [], semana: Row[] = [], depois: Row[] = [], sem: Row[] = [], concluidas: Row[] = [];
    itens.forEach((t) => {
      if (t.concluida) { concluidas.push(t); return; }
      if (!t.prazo) { sem.push(t); return; }
      const d = parseDataLocal(t.prazo); d.setHours(0, 0, 0, 0);
      if (d < hoje) atrasadas.push(t);
      else if (d.getTime() === hoje.getTime()) hojeArr.push(t);
      else if (d < em7) semana.push(t);
      else depois.push(t);
    });
    return { atrasadas, hoje: hojeArr, semana, depois, sem, concluidas };
  }, [itens, hoje, em7]);

  const [sort, setSort] = React.useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const toggleSort = React.useCallback((field: string) => {
    setSort((prev) => (prev?.field === field
      ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { field, direction: 'asc' }));
  }, []);
  const ordenarLinhas = React.useCallback((rows: Row[]) => {
    if (!sort) return rows;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareSortValues((a as any)[sort.field], (b as any)[sort.field]));
  }, [sort]);

  const renderGrupo = (label: string, rows: Row[], tone: 'destructive' | 'warning' | 'info' | 'neutral' | 'success') => {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={tone}>{label}</StatusBadge>
          <span className="text-xs text-muted-foreground">
            {t(rows.length === 1 ? 'minhasTarefas.itemCount' : 'minhasTarefas.itemCountPlural', { count: rows.length })}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead field="titulo" sort={sort} onSort={toggleSort}>{t('minhasTarefas.columns.item')}</SortableTableHead>
                <SortableTableHead field="origemRef" sort={sort} onSort={toggleSort}>{t('minhasTarefas.columns.source')}</SortableTableHead>
                <SortableTableHead field="prioridade" sort={sort} onSort={toggleSort}>{t('minhasTarefas.columns.priority')}</SortableTableHead>
                <SortableTableHead field="prazo" sort={sort} onSort={toggleSort}>{t('minhasTarefas.columns.dueDate')}</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenarLinhas(rows).map((row) => {
                const originBadge = row.origem === 'plano'
                  ? t('minhasTarefas.source.actionPlan')
                  : t('minhasTarefas.source.project');
                const originRef = row.origemRef
                  ? (row.origem === 'plano' ? `${t('minhasTarefas.source.planPrefix')} · ${row.origemRef}` : row.origemRef)
                  : originBadge;
                return (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => navigate(row.href)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Badge variant={row.origem === 'plano' ? 'outline' : 'secondary'} className="shrink-0">
                          {originBadge}
                        </Badge>
                        <span>{row.titulo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{originRef}</TableCell>
                    <TableCell>
                      <StatusBadge tone={prioridadeTone[row.prioridade]}>
                        {t(`minhasTarefas.priority.${row.prioridade}`)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{row.prazo ? formatDate(row.prazo, locale) : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('minhasTarefas.title')}
        description={t('minhasTarefas.subtitle')}
      />

      <StatStrip
        loading={isLoading}
        items={[
          { key: 'overdue', label: t('minhasTarefas.stats.overdue'), value: buckets.atrasadas.length, tone: 'destructive' },
          { key: 'today', label: t('minhasTarefas.stats.today'), value: buckets.hoje.length, tone: 'warning' },
          { key: 'week', label: t('minhasTarefas.stats.thisWeek'), value: buckets.semana.length },
          { key: 'done', label: t('minhasTarefas.stats.done'), value: buckets.concluidas.length },
        ]}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><AkurisPulse size={56} /></div>
      ) : itens.length === 0 ? (
        <EmptyState
          variant="illustrated"
          icon={<IconChecklist className="h-8 w-8" />}
          title={t('minhasTarefas.empty.title')}
          description={t('minhasTarefas.empty.description')}
        />
      ) : (
        <div className="space-y-6">
          {renderGrupo(t('minhasTarefas.groups.overdue'), buckets.atrasadas, 'destructive')}
          {renderGrupo(t('minhasTarefas.groups.today'), buckets.hoje, 'warning')}
          {renderGrupo(t('minhasTarefas.groups.thisWeek'), buckets.semana, 'info')}
          {renderGrupo(t('minhasTarefas.groups.later'), buckets.depois, 'neutral')}
          {renderGrupo(t('minhasTarefas.groups.noDueDate'), buckets.sem, 'neutral')}
          {renderGrupo(t('minhasTarefas.groups.done'), buckets.concluidas, 'success')}
        </div>
      )}
    </div>
  );
}

