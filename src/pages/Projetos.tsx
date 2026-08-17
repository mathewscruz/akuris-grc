import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatStrip } from '@/components/ui/stat-strip';
import { EmptyState } from '@/components/ui/empty-state';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Plus, Kanban, ListTodo, CheckCircle2, AlertTriangle, Inbox, LayoutTemplate } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { useProjetos } from '@/hooks/useProjetos';
import { useProjetoStats } from '@/hooks/useProjetoStats';
import { ProjetoDialog } from '@/components/projetos/ProjetoDialog';
import { ProjetoActionsMenu } from '@/components/projetos/ProjetoActionsMenu';
import type { Projeto } from '@/types/projetos';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/i18n-format';

const statusTone: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
  ativo: 'success',
  pausado: 'warning',
  concluido: 'info',
  arquivado: 'neutral',
};

export default function Projetos() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { data: projetos = [], isLoading } = useProjetos();
  const { data: stats } = useProjetoStats();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Projeto | null>(null);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);

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
          <Button onClick={openNovo}><Plus className="h-4 w-4" /> {t('projetos.page.newProject')}</Button>
        }
        secondaryActions={[
          { label: t('projetos.page.templates'), icon: <LayoutTemplate className="h-4 w-4" />, onClick: () => navigate('/projetos/templates') },
          { label: t('projetos.page.myTasks'), icon: <Inbox className="h-4 w-4" />, onClick: () => navigate('/projetos/minhas-tarefas') },
        ]}
      />

      <StatStrip
        items={[
          { key: 'ativos', label: t('projetos.page.statActive'), value: stats?.projetosAtivos ?? 0 },
          { key: 'abertas', label: t('projetos.page.statOpenTasks'), value: stats?.tarefasAbertas ?? 0 },
          { key: 'concluidas', label: t('projetos.page.statDoneTasks'), value: stats?.tarefasConcluidas ?? 0 },
          { key: 'atrasadas', label: t('projetos.page.statOverdueTasks'), value: stats?.tarefasAtrasadas ?? 0, tone: 'destructive' },
        ]}
      />

      {totalArquivados > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setMostrarArquivados((v) => !v)}>
            {mostrarArquivados ? t('projetos.page.backToActive') : t('projetos.page.showArchived', { count: totalArquivados })}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><AkurisPulse size={56} /></div>
      ) : visiveis.length === 0 ? (
        <EmptyState
          variant="illustrated"
          icon={<Kanban className="h-8 w-8" />}
          title={mostrarArquivados ? t('projetos.page.emptyArchivedTitle') : t('projetos.page.emptyTitle')}
          description={mostrarArquivados
            ? t('projetos.page.emptyArchivedDesc')
            : t('projetos.page.emptyDesc')}
          action={!mostrarArquivados ? { label: t('projetos.page.createProject'), onClick: openNovo } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiveis.map((p) => (
            <Card
              key={p.id}
              variant="elevated"
              interactive
              onClick={() => navigate(`/projetos/${p.id}`)}
              className="overflow-hidden"
            >
              <div className="h-1.5" style={{ backgroundColor: p.cor ?? '#7552FF' }} />
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight flex-1 min-w-0">{p.nome}</h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <StatusBadge tone={statusTone[p.status] ?? 'neutral'} size="sm">{STATUS_LABEL[p.status]}</StatusBadge>
                    <ProjetoActionsMenu projeto={p} onEdit={() => openEditar(p)} />
                  </div>
                </div>
                {p.descricao && <p className="text-sm text-muted-foreground line-clamp-2">{p.descricao}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
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
