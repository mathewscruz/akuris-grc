import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('projetos.page.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('projetos.page.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/projetos/templates')}>
            <LayoutTemplate className="h-4 w-4" /> {t('projetos.page.templates')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/projetos/minhas-tarefas')}>
            <Inbox className="h-4 w-4" /> {t('projetos.page.myTasks')}
          </Button>
          <Button onClick={openNovo}><Plus className="h-4 w-4" /> {t('projetos.page.newProject')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('projetos.page.statActive')} value={stats?.projetosAtivos ?? 0} icon={<Kanban />} variant="primary" showAccent />
        <StatCard title={t('projetos.page.statOpenTasks')} value={stats?.tarefasAbertas ?? 0} icon={<ListTodo />} variant="info" />
        <StatCard title={t('projetos.page.statDoneTasks')} value={stats?.tarefasConcluidas ?? 0} icon={<CheckCircle2 />} variant="success" />
        <StatCard title={t('projetos.page.statOverdueTasks')} value={stats?.tarefasAtrasadas ?? 0} icon={<AlertTriangle />} variant="destructive" />
      </div>

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
