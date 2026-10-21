import React, { useEffect, useRef, useState } from 'react';
import { IconAdd, IconDownload, IconFile, IconArrowLeft, IconSettings } from '@/components/icons';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ModuleLoadingSkeleton } from '@/components/ui/module-loading-skeleton';
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
import { useSprints, useAutomacoes } from '@/hooks/useProjetoExtras';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { IconSearch } from '@/components/icons';
import { useUsuariosEmpresa } from '@/hooks/useUsuariosEmpresa';
import { matchesSearch } from '@/lib/search-utils';

function TabCount({ n }: { n: number }) {
  return <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{n}</span>;
}

export default function ProjetoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: projeto, isLoading } = useProjeto(id);
  const { data: colunas = [] } = useProjetoColunas(id);
  const { data: tarefas = [] } = useProjetoTarefas(id);
  const { data: sprints = [] } = useSprints(id);
  const { data: automacoes = [] } = useAutomacoes(id);
  const { data: usuarios = [] } = useUsuariosEmpresa();
  const [aba, setAba] = useState('kanban');
  const [busca, setBusca] = useState('');
  const [fResp, setFResp] = useState('todos');
  // Filtro partilhado por Kanban, Calendário e Gantt: mantém os agrupadores (fase/domínio) das tarefas que casam.
  const tarefasFiltradas = React.useMemo(() => {
    if (!busca && fResp === 'todos') return tarefas;
    const porId = new Map(tarefas.map((x) => [x.id, x]));
    const ok = new Set<string>();
    tarefas.forEach((x) => {
      if (busca && !matchesSearch(busca, x.titulo)) return;
      if (fResp !== 'todos' && (x.responsavel_id ?? 'none') !== fResp) return;
      let c: ProjetoTarefa | undefined = x; let n = 0;
      while (c && n++ < 10) { ok.add(c.id); c = c.parent_task_id ? porId.get(c.parent_task_id) : undefined; }
    });
    return tarefas.filter((x) => ok.has(x.id));
  }, [tarefas, busca, fResp]);
  const nAtividades = React.useMemo(() => { const pais = new Set(tarefas.map((x) => x.parent_task_id).filter(Boolean)); return tarefas.filter((x) => !pais.has(x.id)).length; }, [tarefas]);

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

  if (isLoading) return <ModuleLoadingSkeleton statCards={3} />;
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
        <Button variant="ghost" size="icon" onClick={() => navigate('/projetos')} aria-label={t('common.back')} title={t('common.back')}>
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

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="kanban">{t('projetos.detalhe.tabKanban')}<TabCount n={nAtividades} /></TabsTrigger>
          <TabsTrigger value="lista">{t('projetos.detalhe.tabLista')}<TabCount n={tarefas.length} /></TabsTrigger>
          <TabsTrigger value="calendario">{t('projetos.detalhe.tabCalendario')}</TabsTrigger>
          <TabsTrigger value="gantt">{t('projetos.detalhe.tabGantt')}</TabsTrigger>
          <TabsTrigger value="sprints">{t('projetos.detalhe.tabSprints')}<TabCount n={sprints.length} /></TabsTrigger>
          <TabsTrigger value="metricas">{t('projetos.detalhe.tabMetricas')}</TabsTrigger>
          <TabsTrigger value="automacoes">{t('projetos.detalhe.tabAutomacoes')}<TabCount n={automacoes.filter((a) => a.ativa).length} /></TabsTrigger>
        </TabsList>

        {['kanban', 'calendario', 'gantt'].includes(aba) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('projetos.lista.searchPlaceholder')} className="h-9 pl-8" />
            </div>
            <Select value={fResp} onValueChange={setFResp}>
              <SelectTrigger className="h-9 w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t('p3Projetos.lista.responsibleAll')}</SelectItem>
                <SelectItem value="none">{t('projetos.lista.notAssigned')}</SelectItem>
                {usuarios.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.nome ?? u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <TabsContent value="kanban">
          <KanbanBoard projetoId={projeto.id} colunas={colunas} tarefas={tarefasFiltradas} onAddTarefa={(cid) => openNovaTarefa(cid)} onEditTarefa={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="lista">
          <ListaTarefas tarefas={tarefas} colunas={colunas} onSelect={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="calendario">
          <CalendarView tarefas={tarefasFiltradas} colunas={colunas} onSelectTarefa={openEditarTarefa} />
        </TabsContent>
        <TabsContent value="gantt">
          <GanttChart tarefas={tarefasFiltradas} colunas={colunas} onSelectTarefa={openEditarTarefa} />
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
        tarefas={tarefas}
        projetoNome={projeto.nome}
        onOpenTarefa={openEditarTarefa}
      />
      <ProjetoDialog open={projetoDialog} onOpenChange={setProjetoDialog} projeto={projeto} />
      <SuggestTasksDialog open={suggestDialog} onOpenChange={setSuggestDialog} projetoId={projeto.id} colunas={colunas} />
      <StatusReportDialog open={reportDialog} onOpenChange={setReportDialog} projetoId={projeto.id} projetoNome={projeto.nome} />
    </div>
  );
}
