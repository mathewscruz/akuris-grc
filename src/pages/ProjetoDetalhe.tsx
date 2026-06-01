import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { ArrowLeft, Plus, Settings, Sparkles, FileText } from 'lucide-react';
import { useProjeto, useUpsertProjeto } from '@/hooks/useProjetos';
import { useProjetoColunas, useProjetoTarefas } from '@/hooks/useProjetoTarefas';
import { KanbanBoard } from '@/components/projetos/KanbanBoard';
import { TarefaDialog } from '@/components/projetos/TarefaDialog';
import { ProjetoDialog } from '@/components/projetos/ProjetoDialog';
import { GanttChart } from '@/components/projetos/GanttChart';
import { SuggestTasksDialog } from '@/components/projetos/SuggestTasksDialog';
import { StatusReportDialog } from '@/components/projetos/StatusReportDialog';
import type { ProjetoTarefa, ProjetoTarefaPrioridade } from '@/types/projetos';
import { STATUS_LABEL, PRIORIDADE_LABEL } from '@/types/projetos';

const prioridadeTone: Record<ProjetoTarefaPrioridade, 'destructive' | 'warning' | 'info' | 'neutral'> = {
  critica: 'destructive', alta: 'warning', media: 'info', baixa: 'neutral',
};

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
        <Button variant="outline" size="sm" onClick={() => setProjetoDialog(true)}>
          <Settings className="h-4 w-4" /> Editar
        </Button>
        <Button size="sm" onClick={() => openNovaTarefa()}>
          <Plus className="h-4 w-4" /> Nova tarefa
        </Button>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <KanbanBoard
            projetoId={projeto.id}
            colunas={colunas}
            tarefas={tarefas}
            onAddTarefa={(cid) => openNovaTarefa(cid)}
            onEditTarefa={openEditarTarefa}
          />
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
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
                {tarefas.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma tarefa.</TableCell></TableRow>
                ) : tarefas.map((t) => {
                  const col = colunas.find((c) => c.id === t.coluna_id);
                  const atrasada = t.prazo && !t.concluida_em && new Date(t.prazo) < new Date();
                  return (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => openEditarTarefa(t)}>
                      <TableCell className="font-medium">{t.titulo}</TableCell>
                      <TableCell>{col?.nome ?? '—'}</TableCell>
                      <TableCell>
                        <StatusBadge tone={prioridadeTone[t.prioridade]} size="sm">{PRIORIDADE_LABEL[t.prioridade]}</StatusBadge>
                      </TableCell>
                      <TableCell className={atrasada ? 'text-destructive font-medium' : ''}>
                        {t.prazo ? new Date(t.prazo).toLocaleDateString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell>
                        {t.concluida_em ? <StatusBadge tone="success" size="sm">Concluída</StatusBadge> : <StatusBadge tone="info" size="sm">Em aberto</StatusBadge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
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
    </div>
  );
}
