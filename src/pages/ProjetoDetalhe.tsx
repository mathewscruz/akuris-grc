import React, { useEffect, useRef, useState } from 'react';
import { IconAdd, IconDownload, IconFile, IconArrowLeft, IconSettings } from '@/components/icons';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
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
import { useLanguage } from '@/contexts/LanguageContext';
import { formatStatus } from '@/lib/text-utils';

export default function ProjetoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: projeto, isLoading } = useProjeto(id);
  const { data: colunas = [] } = useProjetoColunas(id);
  const { data: tarefas = [] } = useProjetoTarefas(id);

  const STATUS_LABEL: Record<string, string> = {
    ativo: t('projetos.status.ativo'),
    pausado: t('projetos.status.pausado'),
    concluido: t('projetos.status.concluido'),
    arquivado: t('projetos.status.arquivado'),
  };

  const [tarefaDialog, setTarefaDialog] = useState(false);
  const [tarefaAtual, setTarefaAtual] = useState<ProjetoTarefa | null>(null);
  const [defaultColuna, setDefaultColuna] = useState<string | null>(null);
  const [projetoDialog, setProjetoDialog] = useState(false);
  const [suggestDialog, setSuggestDialog] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  /*
    A tarefa não tem página própria: vive na ficha, que se abre a partir de
    qualquer uma das quatro vistas. A busca global já emitia
    `/projetos/<projeto>?focus=<tarefa>` e a página lia `useParams` e mais
    nada — o link abria o projeto certo e deixava a pessoa a procurar a
    tarefa no quadro. Aqui o destaque de linha não serve: a mesma tarefa
    aparece no Kanban, na lista, no calendário e no Gantt, e três dessas
    vistas estão desmontadas. Abrir a ficha é o que o clique faria.

    O efeito tem de ficar ACIMA dos retornos antecipados de carregamento —
    um gancho a seguir a um `return` não corre em todas as renderizações.
  */
  const focoConsumido = useRef<string | null>(null);
  useEffect(() => {
    const alvo = searchParams.get('focus');
    if (!alvo || alvo === focoConsumido.current) return;
    const tarefa = tarefas.find((x) => x.id === alvo);
    if (!tarefa) return;
    focoConsumido.current = alvo;
    setTarefaAtual(tarefa);
    setDefaultColuna(null);
    setTarefaDialog(true);
    const proximo = new URLSearchParams(searchParams);
    proximo.delete('focus');
    setSearchParams(proximo, { replace: true });
  }, [searchParams, tarefas, setSearchParams]);

  if (isLoading) return <div className="flex justify-center py-16"><AkurisPulse size={56} /></div>;
  if (!projeto) return <div className="p-6">{t('projetos.detalhe.notFound')}</div>;

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
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projetos')}>
          <IconArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-6 w-1 rounded" style={{ backgroundColor: projeto.cor ?? '#7552FF' }} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold truncate">{projeto.nome}</h1>
          {projeto.descricao && <p className="text-sm text-muted-foreground line-clamp-1">{projeto.descricao}</p>}
        </div>
        <StatusBadge tone="primary">{STATUS_LABEL[projeto.status] ?? formatStatus(projeto.status)}</StatusBadge>
        <Button variant="outline" size="sm" onClick={() => setReportDialog(true)}>
          <IconFile className="h-4 w-4" /> {t('projetos.detalhe.statusReportIa')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSuggestDialog(true)}>
          {t('projetos.detalhe.breakWithAi')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportTarefasCSV(projeto.nome, tarefas, colunas)}>
          <IconDownload className="h-4 w-4" /> {t('projetos.detalhe.exportCsv')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setProjetoDialog(true)}>
          <IconSettings className="h-4 w-4" /> {t('projetos.detalhe.edit')}
        </Button>
        <ProjetoActionsMenu projeto={projeto} onEdit={() => setProjetoDialog(true)} variant="button" />
        <Button size="sm" onClick={() => openNovaTarefa()}>
          <IconAdd className="h-4 w-4" /> {t('projetos.detalhe.newTask')}
        </Button>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">{t('projetos.detalhe.tabKanban')}</TabsTrigger>
          <TabsTrigger value="lista">{t('projetos.detalhe.tabLista')}</TabsTrigger>
          <TabsTrigger value="calendario">{t('projetos.detalhe.tabCalendario')}</TabsTrigger>
          <TabsTrigger value="gantt">{t('projetos.detalhe.tabGantt')}</TabsTrigger>
          <TabsTrigger value="sprints">{t('projetos.detalhe.tabSprints')}</TabsTrigger>
          <TabsTrigger value="metricas">{t('projetos.detalhe.tabMetricas')}</TabsTrigger>
          <TabsTrigger value="automacoes">{t('projetos.detalhe.tabAutomacoes')}</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <KanbanBoard projetoId={projeto.id} colunas={colunas} tarefas={tarefas} onAddTarefa={(cid) => openNovaTarefa(cid)} onEditTarefa={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="lista">
          <ListaTarefas tarefas={tarefas} colunas={colunas} onSelect={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="calendario">
          <CalendarView tarefas={tarefas} onSelectTarefa={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="gantt">
          <GanttChart tarefas={tarefas} onSelectTarefa={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="sprints">
          <SprintsPanel projetoId={projeto.id} tarefas={tarefas} onSelectTarefa={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="metricas">
          <MetricasPanel tarefas={tarefas} colunas={colunas} />
        </TabsContent>
        <TabsContent value="automacoes">
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
