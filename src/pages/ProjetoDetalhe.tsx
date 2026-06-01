import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { ArrowLeft, Plus, Settings, Sparkles, FileText, Download } from 'lucide-react';
import { useProjeto } from '@/hooks/useProjetos';
import { useProjetoColunas, useProjetoTarefas } from '@/hooks/useProjetoTarefas';
import { KanbanBoard } from '@/components/projetos/KanbanBoard';
import { TarefaDialog } from '@/components/projetos/TarefaDialog';
import { ProjetoDialog } from '@/components/projetos/ProjetoDialog';
import { GanttChart } from '@/components/projetos/GanttChart';
import { SuggestTasksDialog } from '@/components/projetos/SuggestTasksDialog';
import { StatusReportDialog } from '@/components/projetos/StatusReportDialog';
import { CalendarView } from '@/components/projetos/CalendarView';
import { ListaTarefas } from '@/components/projetos/ListaTarefas';
import { ProjetoActionsMenu } from '@/components/projetos/ProjetoActionsMenu';
import { SprintsPanel } from '@/components/projetos/SprintsPanel';
import { MetricasPanel } from '@/components/projetos/MetricasPanel';
import { AutomacoesPanel } from '@/components/projetos/AutomacoesPanel';
import { exportTarefasCSV } from '@/components/projetos/exportProjeto';
import type { ProjetoTarefa } from '@/types/projetos';
import { STATUS_LABEL } from '@/types/projetos';

export default function ProjetoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: projeto, isLoading } = useProjeto(id);
  const { data: colunas = [] } = useProjetoColunas(id);
  const { data: tarefas = [] } = useProjetoTarefas(id);

  const [tarefaDialog, setTarefaDialog] = useState(false);
  const [tarefaAtual, setTarefaAtual] = useState<ProjetoTarefa | null>(null);
  const [defaultColuna, setDefaultColuna] = useState<string | null>(null);
  const [projetoDialog, setProjetoDialog] = useState(false);
  const [suggestDialog, setSuggestDialog] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);

  if (isLoading) return <div className="flex justify-center py-16"><AkurisPulse size={56} /></div>;
  if (!projeto) return <div className="p-6">Projeto não encontrado.</div>;

  const openNovaTarefa = (colunaId?: string) => {
    setTarefaAtual(null);
    setDefaultColuna(colunaId ?? colunas[0]?.id ?? null);
    setTarefaDialog(true);
  };

  const openEditarTarefa = (t: ProjetoTarefa) => {
    setTarefaAtual(t);
    setDefaultColuna(null);
    setTarefaDialog(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projetos')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-6 w-1 rounded" style={{ backgroundColor: projeto.cor ?? '#7552FF' }} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold truncate">{projeto.nome}</h1>
          {projeto.descricao && <p className="text-sm text-muted-foreground line-clamp-1">{projeto.descricao}</p>}
        </div>
        <StatusBadge tone="primary" size="md">{STATUS_LABEL[projeto.status]}</StatusBadge>
        <Button variant="outline" size="sm" onClick={() => setReportDialog(true)}>
          <FileText className="h-4 w-4" /> Status report IA
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSuggestDialog(true)}>
          <Sparkles className="h-4 w-4" /> Quebrar com IA
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportTarefasCSV(projeto.nome, tarefas, colunas)}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => setProjetoDialog(true)}>
          <Settings className="h-4 w-4" /> Editar
        </Button>
        <ProjetoActionsMenu projeto={projeto} onEdit={() => setProjetoDialog(true)} variant="button" />
        <Button size="sm" onClick={() => openNovaTarefa()}>
          <Plus className="h-4 w-4" /> Nova tarefa
        </Button>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
          <TabsTrigger value="sprints">Sprints</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <KanbanBoard projetoId={projeto.id} colunas={colunas} tarefas={tarefas} onAddTarefa={(cid) => openNovaTarefa(cid)} onEditTarefa={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="lista" className="mt-4">
          <ListaTarefas tarefas={tarefas} colunas={colunas} onSelect={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="calendario" className="mt-4">
          <CalendarView tarefas={tarefas} onSelectTarefa={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="gantt" className="mt-4">
          <GanttChart tarefas={tarefas} onSelectTarefa={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="sprints" className="mt-4">
          <SprintsPanel projetoId={projeto.id} tarefas={tarefas} onSelectTarefa={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="metricas" className="mt-4">
          <MetricasPanel tarefas={tarefas} colunas={colunas} />
        </TabsContent>
        <TabsContent value="automacoes" className="mt-4">
          <AutomacoesPanel projetoId={projeto.id} colunas={colunas} />
        </TabsContent>
      </Tabs>

      <TarefaDialog
        open={tarefaDialog}
        onOpenChange={setTarefaDialog}
        projetoId={projeto.id}
        colunas={colunas}
        tarefa={tarefaAtual}
        defaultColunaId={defaultColuna}
      />
      <ProjetoDialog open={projetoDialog} onOpenChange={setProjetoDialog} projeto={projeto} />
      <SuggestTasksDialog open={suggestDialog} onOpenChange={setSuggestDialog} projetoId={projeto.id} colunas={colunas} />
      <StatusReportDialog open={reportDialog} onOpenChange={setReportDialog} projetoId={projeto.id} projetoNome={projeto.nome} />
    </div>
  );
}
