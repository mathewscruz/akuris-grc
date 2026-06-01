import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Plus, Kanban, ListTodo, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { useProjetos } from '@/hooks/useProjetos';
import { useProjetoStats } from '@/hooks/useProjetoStats';
import { ProjetoDialog } from '@/components/projetos/ProjetoDialog';
import type { Projeto } from '@/types/projetos';
import { STATUS_LABEL } from '@/types/projetos';

const statusTone: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
  ativo: 'success',
  pausado: 'warning',
  concluido: 'info',
  arquivado: 'neutral',
};

export default function Projetos() {
  const navigate = useNavigate();
  const { data: projetos = [], isLoading } = useProjetos();
  const { data: stats } = useProjetoStats();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Projeto | null>(null);

  const openNovo = () => { setEditando(null); setDialogOpen(true); };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de atividades, Kanban e entregas integrada ao GRC.</p>
        </div>
        <Button onClick={openNovo}><Plus className="h-4 w-4" /> Novo projeto</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Projetos ativos" value={stats?.projetosAtivos ?? 0} icon={<Kanban />} variant="primary" showAccent />
        <StatCard title="Tarefas abertas" value={stats?.tarefasAbertas ?? 0} icon={<ListTodo />} variant="info" />
        <StatCard title="Tarefas concluídas" value={stats?.tarefasConcluidas ?? 0} icon={<CheckCircle2 />} variant="success" />
        <StatCard title="Tarefas atrasadas" value={stats?.tarefasAtrasadas ?? 0} icon={<AlertTriangle />} variant="destructive" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><AkurisPulse size={56} /></div>
      ) : projetos.length === 0 ? (
        <EmptyState
          variant="illustrated"
          icon={<Kanban className="h-8 w-8" />}
          title="Nenhum projeto ainda"
          description="Crie seu primeiro projeto para organizar atividades em Kanban e vincular cards aos seus riscos, controles, auditorias e incidentes."
          action={{ label: 'Criar projeto', onClick: openNovo }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetos.map((p) => (
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
                  <h3 className="font-semibold leading-tight">{p.nome}</h3>
                  <StatusBadge tone={statusTone[p.status] ?? 'neutral'} size="sm">{STATUS_LABEL[p.status]}</StatusBadge>
                </div>
                {p.descricao && <p className="text-sm text-muted-foreground line-clamp-2">{p.descricao}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>{p.data_inicio ? new Date(p.data_inicio).toLocaleDateString('pt-BR') : '—'}</span>
                  <span>→ {p.data_fim_prevista ? new Date(p.data_fim_prevista).toLocaleDateString('pt-BR') : '—'}</span>
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
