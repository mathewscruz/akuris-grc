import { rowOpenProps } from '@/lib/row-interaction';
import React, { useState } from 'react';
import { QueryError } from '@/components/ui/query-error';
import { IconAdd, IconSuccess, IconWarning, IconChecklist, IconMail, IconGrid, IconRows } from '@/components/icons';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatStrip } from '@/components/ui/stat-strip';
import { EmptyState } from '@/components/ui/empty-state';
import { ModuleLoadingSkeleton } from '@/components/ui/module-loading-skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Progress } from '@/components/ui/progress';
import { useProjetos } from '@/hooks/useProjetos';
import { useProjetoStats } from '@/hooks/useProjetoStats';
import { ProjetoDialog } from '@/components/projetos/ProjetoDialog';
import { ProjetoActionsMenu } from '@/components/projetos/ProjetoActionsMenu';
import type { Projeto } from '@/types/projetos';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/i18n-format';
import { parseDataLocal } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { OwnerCell } from '@/components/ui/owner-cell';
import { RecordProgress } from '@/components/ui/record-progress';

const statusTone: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
  ativo: 'success',
  pausado: 'warning',
  concluido: 'info',
  arquivado: 'neutral',
};

export default function Projetos() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { data: projetos = [], isLoading, isError, refetch } = useProjetos();
  const { data: stats, isLoading: statsLoading, isError: statsError } = useProjetoStats();
  const { empresaId } = useEmpresaId();

  /*
    O cartao dizia nome, estado, descricao e duas datas -- e mais nada.

    Nenhuma dessas coisas responde a pergunta que se faz ao olhar para uma
    lista de projetos: em que pe esta? Um projeto com 40 tarefas por fazer e
    um com tudo concluido tinham exactamente o mesmo aspecto, e so se
    distinguiam entrando em cada um.

    Uma consulta agregada para todos os projetos, em vez de uma por cartao:
    com dez projetos seriam dez consultas a fazer a mesma coisa.
  */
  const { data: tarefasPorProjeto, isError: tasksError, isLoading: tasksLoading, refetch: retryTasks } = useQuery({
    queryKey: ['projetos-progresso', empresaId],
    enabled: !!empresaId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!empresaId) return new Map<string, { total: number; feitas: number; atrasadas: number }>();
      const { data, error } = await supabase
        .from('projeto_tarefas' as never)
        .select('projeto_id, concluida_em, prazo, projetos!inner(empresa_id)')
        .eq('projetos.empresa_id', empresaId);
      if (error) throw error;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const mapa = new Map<string, { total: number; feitas: number; atrasadas: number }>();
      for (const t of (data ?? []) as any[]) {
        const linha = mapa.get(t.projeto_id) ?? { total: 0, feitas: 0, atrasadas: 0 };
        linha.total += 1;
        if (t.concluida_em) linha.feitas += 1;
        // `parseDataLocal`, nao `new Date`: `prazo` e coluna `date`, e
        // `new Date('2026-08-25')` e meia-noite UTC -- o dia ANTERIOR a oeste
        // de Greenwich. Uma tarefa que vence hoje apareceria atrasada.
        else if (t.prazo && parseDataLocal(t.prazo) < hoje) linha.atrasadas += 1;
        mapa.set(t.projeto_id, linha);
      }
      return mapa;
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Projeto | null>(null);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { data: owners = [] } = useQuery({
    queryKey: ['projetos-owners', empresaId], enabled: !!empresaId,
    queryFn: async () => {
      if (!empresaId) return [];
      const result = await supabase.from('profiles').select('user_id,nome,foto_url').eq('empresa_id', empresaId);
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });

  const STATUS_LABEL: Record<string, string> = {
    ativo: t('projetos.status.ativo'),
    pausado: t('projetos.status.pausado'),
    concluido: t('projetos.status.concluido'),
    arquivado: t('projetos.status.arquivado'),
  };

  const openNovo = () => { setEditando(null); setDialogOpen(true); };
  const openEditar = (p: Projeto) => { setEditando(p); setDialogOpen(true); };

  const visiveis = projetos.filter((p) => mostrarArquivados ? p.status === 'arquivado' : p.status !== 'arquivado');
  const totalArquivados = projetos.filter((p) => p.status === 'arquivado').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('projetos.page.title')}
        description={t('projetos.page.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/planos-acao?aba=tarefas')}>{t('projetos.page.myTasks')}</Button>
            <Button onClick={openNovo}><IconAdd className="h-4 w-4" /> {t('projetos.page.newProject')}</Button>
          </>
        }
        secondaryActions={[
          { label: t('projetos.page.templates'), icon: <IconRows className="h-4 w-4" />, onClick: () => navigate('/projetos/templates') },
        ]}
      />

      <StatStrip loading={statsLoading} error={statsError}
        items={[
          { key: 'ativos', label: t('projetos.page.statActive'), value: stats?.projetosAtivos ?? 0 },
          { key: 'abertas', label: t('projetos.page.statOpenTasks'), value: stats?.tarefasAbertas ?? 0 },
          { key: 'concluidas', label: t('projetos.page.statDoneTasks'), value: stats?.tarefasConcluidas ?? 0 },
          { key: 'atrasadas', label: t('projetos.page.statOverdueTasks'), value: stats?.tarefasAtrasadas ?? 0, tone: 'destructive' },
        ]}
      />

      <div className="flex justify-end gap-2">
        <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" aria-label={t('layout.listView')} title={t('layout.listView')} aria-pressed={view === 'list'} onClick={() => setView('list')}><IconRows className="h-4 w-4" /></Button>
        <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon" aria-label={t('layout.gridView')} title={t('layout.gridView')} aria-pressed={view === 'grid'} onClick={() => setView('grid')}><IconGrid className="h-4 w-4" /></Button>
        {totalArquivados > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMostrarArquivados((v) => !v)}>
            {mostrarArquivados ? t('projetos.page.backToActive') : t('projetos.page.showArchived', { count: totalArquivados })}
          </Button>
        )}
      </div>

      {tasksError && <QueryError onRetry={() => void retryTasks()} />}
      {isError ? <QueryError onRetry={() => void refetch()} /> : isLoading ? (
        <ModuleLoadingSkeleton statCards={4} />
      ) : visiveis.length === 0 ? (
        <EmptyState
          variant="illustrated"
          icon={<IconGrid className="h-8 w-8" />}
          title={mostrarArquivados ? t('projetos.page.emptyArchivedTitle') : t('projetos.page.emptyTitle')}
          description={mostrarArquivados
            ? t('projetos.page.emptyArchivedDesc')
            : t('experience.projectFirstRun')}
          action={!mostrarArquivados ? { label: t('projetos.page.createProject'), onClick: openNovo } : undefined}
        />
      ) : (
        /*
          Quatro colunas em ecras largos: com tres, um monitor de 2000px punha
          cartoes gordos e meia tela vazia por baixo.
        */
        <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'grid grid-cols-1 gap-3'}>
          {visiveis.map((p) => (
            <Card
              key={p.id}
              variant="elevated"
              interactive
              {...rowOpenProps(() => navigate(`/projetos/${p.id}`), p.nome)}
              className="overflow-hidden"
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight flex-1 min-w-0">{p.nome}</h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <StatusBadge tone={statusTone[p.status] ?? 'neutral'}>{STATUS_LABEL[p.status] ?? formatStatus(p.status)}</StatusBadge>
                    <ProjetoActionsMenu projeto={p} onEdit={() => openEditar(p)} />
                  </div>
                </div>
                {p.descricao && <p className="text-sm text-muted-foreground line-clamp-2">{p.descricao}</p>}
                <OwnerCell name={owners.find(owner => owner.user_id === p.owner_id)?.nome} photo={owners.find(owner => owner.user_id === p.owner_id)?.foto_url} emptyLabel={t('experience.ownerUnavailable')} />

                {(() => {
                  if (tasksError || tasksLoading) return <p className="text-sm text-muted-foreground">{t(tasksError ? 'experience.unavailable' : 'common.loading')}</p>;
                  const c = tarefasPorProjeto?.get(p.id);
                  const total = c?.total ?? 0;
                  const feitas = c?.feitas ?? 0;
                  const pct = total ? Math.round((feitas / total) * 100) : 0;
                  return (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {total
                            ? t('projetos.page.cardProgresso', { feitas: String(feitas), total: String(total) })
                            : t('projetos.page.cardSemTarefas')}
                        </span>
                        {total > 0 && <span className="font-medium tabular-nums">{pct}%</span>}
                      </div>
                      {/* Sem tarefas nao ha barra: uma barra a zero le-se como
                          «nao comecou», e nao comecar e diferente de nao ter. */}
                      {total > 0 && <RecordProgress value={pct} label={t('layout.progress')} />}
                      {!!c?.atrasadas && (
                        <p className="text-xs text-destructive">
                          {t('projetos.page.cardAtrasadas', { n: String(c.atrasadas) })}
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2.5">
                  <span>{p.data_inicio ? formatDate(p.data_inicio, locale) : '—'}</span>
                  <span>→ {p.data_fim_prevista ? formatDate(p.data_fim_prevista, locale) : '—'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProjetoDialog open={dialogOpen} onOpenChange={setDialogOpen} projeto={editando} />
    </div>
  );
}
