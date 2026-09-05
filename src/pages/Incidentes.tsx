import { readAllPages, readAllPagesByIds } from '@/lib/read-all-pages';
import { norm } from '@/lib/metrics';
import { useListState } from '@/hooks/useListState';
import { useState, useMemo } from 'react';
import { useFocusRow } from '@/hooks/useFocusRow';
import { IconFilter, IconEdit, IconDelete, IconDownload, IconUpload, IconMore, IconSuccess, IconWarning, IconInfo, IconError, IconTime, IconCalendar, IconFile, IconShield, IconMessage, IconChecklist, IconAttach, IconMegaphone, IncidentesIcon } from '@/components/icons';
import { logger } from '@/lib/logger';
import { exportCSV } from '@/lib/csv-utils';
import { useIncidentesStats } from '@/hooks/useIncidentesStats';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { StatStrip } from '@/components/ui/stat-strip';
import { PageHeader } from '@/components/ui/page-header';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveCriticidadeTone, resolveWorkflowStatusTone } from '@/lib/status-tone';
import { estadoIncidente } from '@/lib/metrics';
import { formatDateOnly } from '@/lib/date-utils';
import { IncidenteDialog } from '@/components/incidentes/IncidenteDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { RecordDetailDrawer } from '@/components/common/RecordDetailDrawer';
import { TratamentoDialog } from '@/components/incidentes/TratamentoDialog';
import { ComunicacaoDialog } from '@/components/incidentes/ComunicacaoDialog';
import { EvidenciaDialog } from '@/components/incidentes/EvidenciaDialog';
import ImportIncidentesDialog from '@/components/incidentes/ImportIncidentesDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { CriarTarefaMenuItem } from '@/components/projetos/CriarTarefaMenuItem';
import { useLanguage } from '@/contexts/LanguageContext';
import { isUuid } from '@/lib/uuid';

import { severidadeDeFaixas } from '@/lib/metrics/riscos';
import { compararEscala } from '@/lib/ordem-de-escala';
interface Incidente {
  id: string;
  titulo: string;
  descricao: string;
  tipo_incidente: string;
  categoria: string;
  criticidade: string;
  status: string;
  data_ocorrencia: string;
  data_deteccao: string;
  data_resolucao: string;
  responsavel_deteccao: string;
  responsavel_tratamento: string;
  origem_deteccao?: string | null;
  impacto_estimado?: string | null;
  dados_afetados?: string | null;
  sistemas_afetados?: string[] | null;
  ativos_afetados?: string[] | null;
  riscos_relacionados?: string[] | null;
  created_at: string;
  tratamentos_count?: number;
  proximo_prazo?: string | null;
  comunicacoes_count?: number;
  evidencias_count?: number;
}

export default function Incidentes() {
  /*
    O `?focus=<id>` que a busca global, o `EntidadeSelect` e o sino já
    emitiam para aqui não tinha do lado de cá quem o lesse: a página abria a
    lista inteira e o registo procurado ficava por encontrar à mão. O
    `DataTable` já marca cada linha com `data-focus-id`; faltava só chamar o
    gancho que a procura e a destaca.
  */
  useFocusRow();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useListState('searchTerm', '');
  const [selectedIncidente, setSelectedIncidente] = useState<Incidente | null>(null);
  const [detalheIncidente, setDetalheIncidente] = useState<Incidente | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [comunicacaoDialogOpen, setComunicacaoDialogOpen] = useState(false);
  const [evidenciaDialogOpen, setEvidenciaDialogOpen] = useState(false);
  const [tratamentoDialogOpen, setTratamentoDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; incidenteId: string }>({
    open: false,
    incidenteId: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useListState<string>('statusFilter', "todos");
  const [tipoFilter, setTipoFilter] = useListState<string>('tipoFilter', "todos");
  const [criticidadeFilter, setCriticidadeFilter] = useListState<string>('criticidadeFilter', "todos");
  const [sortField, setSortField] = useListState<string>('sortField', 'data_deteccao');
  const [sortDirection, setSortDirection] = useListState<'asc' | 'desc'>('sortDirection', 'desc');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  
  const { data: statsIncidentes, isLoading: statsLoading, isError: statsError } = useIncidentesStats();

  // React Query for incidentes
  const { data: incidentes = [], isLoading: loading, isError, refetch } = useQuery({
    queryKey: ['incidentes', empresaId],
    queryFn: async ({ signal }) => {
      const incidentesResult = await readAllPages((from, to) => supabase
        .from('incidentes').select('*').eq('empresa_id', empresaId!)
        .order('created_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal);
      const incidentIds = incidentesResult.data.map(incident => incident.id);
      const [tratamentosResult, comunicacoesResult, evidenciasResult] = await Promise.all([
        readAllPagesByIds(incidentIds, (ids, from, to) => supabase.from('incidentes_tratamentos')
          .select('incidente_id, data_prazo, status').in('incidente_id', ids).order('id').range(from, to).abortSignal(signal), signal),
        readAllPagesByIds(incidentIds, (ids, from, to) => supabase.from('incidentes_comunicacoes')
          .select('incidente_id').in('incidente_id', ids).order('id').range(from, to).abortSignal(signal), signal),
        readAllPagesByIds(incidentIds, (ids, from, to) => supabase.from('incidentes_evidencias')
          .select('incidente_id').in('incidente_id', ids).order('id').range(from, to).abortSignal(signal), signal),
      ]);

      if (incidentesResult.error) throw incidentesResult.error;
      if (tratamentosResult.error) throw tratamentosResult.error;
      if (comunicacoesResult.error) throw comunicacoesResult.error;
      if (evidenciasResult.error) throw evidenciasResult.error;

      const contar = (linhas: Array<{ incidente_id: string }> | null) => {
        const mapa = new Map<string, number>();
        (linhas || []).forEach(({ incidente_id }) => mapa.set(incidente_id, (mapa.get(incidente_id) || 0) + 1));
        return mapa;
      };
      const tratamentos = contar(tratamentosResult.data);
      const comunicacoes = contar(comunicacoesResult.data);
      const evidencias = contar(evidenciasResult.data);
      const deadlines = new Map<string, string>();
      for (const treatment of tratamentosResult.data ?? []) {
        if (!treatment.data_prazo || ['concluido', 'cancelado'].includes(norm(treatment.status))) continue;
        const previous = deadlines.get(treatment.incidente_id);
        if (!previous || treatment.data_prazo < previous) deadlines.set(treatment.incidente_id, treatment.data_prazo);
      }
      return (incidentesResult.data || []).map((incidente) => ({
        ...incidente,
        tratamentos_count: tratamentos.get(incidente.id) || 0,
        proximo_prazo: deadlines.get(incidente.id) ?? null,
        comunicacoes_count: comunicacoes.get(incidente.id) || 0,
        evidencias_count: evidencias.get(incidente.id) || 0,
      })) as Incidente[];
    },
    enabled: !!empresaId,
    staleTime: 1000 * 60 * 2,
  });

  const { data: perfisIncidentes = [] } = useQuery({
    queryKey: ['incidentes-perfis', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, nome, email')
        .eq('empresa_id', empresaId!);
      if (error) throw error;
      return data || [];
    },
  });
  const nomePorUsuario = useMemo(() => {
    const mapa = new Map<string, string>();
    perfisIncidentes.forEach((perfil) => {
      const nome = perfil.nome || perfil.email || perfil.user_id;
      mapa.set(perfil.user_id, nome);
      mapa.set(perfil.id, nome);
    });
    return mapa;
  }, [perfisIncidentes]);
  const nomeResponsavel = (valor?: string | null) => {
    if (!valor) return null;
    return nomePorUsuario.get(valor) || (isUuid(valor) ? t('sweepRiscos.incidentes.responsavelIndisponivel') : valor);
  };

  const invalidateIncidentes = () => {
    queryClient.invalidateQueries({ queryKey: ['incidentes'] });
    queryClient.invalidateQueries({ queryKey: ['incidentes-stats'] });
  };

  // Aplicar filtros
  const filteredIncidentes = incidentes.filter(incidente => {
    const matchesSearch = searchTerm === '' || 
      incidente.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incidente.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nomeResponsavel(incidente.responsavel_tratamento)?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Mesmo predicado dos cartões (camada única de métricas)
    const matchesStatus = statusFilter === 'todos' || estadoIncidente(incidente) === statusFilter;
    const matchesTipo = tipoFilter === 'todos' || incidente.tipo_incidente === tipoFilter;
    const matchesCriticidade =
      criticidadeFilter === 'todos' ||
      severidadeDeFaixas(incidente.criticidade) === criticidadeFilter;

    return matchesSearch && matchesStatus && matchesTipo && matchesCriticidade;
  });

  // Ordenar
  const sortedIncidentes = [...filteredIncidentes].sort((a, b) => {
    const aValue = a[sortField as keyof Incidente];
    const bValue = b[sortField as keyof Incidente];

    /* Critíco > Alto > Médio > Baixo. O alfabeto põe Alto antes de Baixo
       antes de Crítico — ao contrário do que a coluna promete. */
    const escala = compararEscala(aValue, bValue);
    if (escala !== null) return sortDirection === 'asc' ? escala : -escala;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleEdit = (incidente: Incidente) => {
    setSelectedIncidente(incidente);
    setEditDialogOpen(true);
  };

  const handleComunicacao = (incidente: Incidente) => {
    setSelectedIncidente(incidente);
    setComunicacaoDialogOpen(true);
  };

  const handleEvidencias = (incidente: Incidente) => {
    setSelectedIncidente(incidente);
    setEvidenciaDialogOpen(true);
  };

  const handleTratamentos = (incidente: Incidente) => {
    setSelectedIncidente(incidente);
    setTratamentoDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ open: true, incidenteId: id });
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('incidentes')
        .delete()
        .eq('id', deleteConfirm.incidenteId);

      if (error) throw error;

      toast({
        title: t('fin.comum.sucesso'),
        description: t('fin.incidentes.excluido'),
      });

      invalidateIncidentes();
      setDeleteConfirm({ open: false, incidenteId: '' });
    } catch (error: any) {
      logger.error(t('fin.incidentes.erroExcluir'), { error: error instanceof Error ? error.message : String(error) });
      toast({
        title: t('fin.comum.erro'),
        description: error.message || t('fin.incidentes.erroExcluir'),
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      aberto: IconError,
      investigacao: IconInfo,
      contido: IconTime,
      resolvido: IconSuccess,
      fechado: IconSuccess,
    };
    
    return icons[status as keyof typeof icons] || IconInfo;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const incidentesColumns = [
    {
      key: "titulo" as keyof Incidente,
      label: t('fin.comum.titulo'),
      sortable: true,
      render: (_v: any, item: Incidente) => (
        <div className="font-medium">{item.titulo}</div>
      )
    },
    {
      key: "tipo_incidente" as keyof Incidente,
      label: t('fin.comum.tipo'),
      sortable: true,
      render: (_v: any, item: Incidente) => (
        <span className="text-muted-foreground">{formatStatus(item.tipo_incidente)}</span>
      )
    },
    {
      key: "criticidade" as keyof Incidente,
      label: t('sweepRiscos.incidentes.colCriticidade'),
      sortable: true,
      render: (_v: any, item: Incidente) => (
        <StatusBadge {...resolveCriticidadeTone(item.criticidade)}>
          {formatStatus(item.criticidade)}
        </StatusBadge>
      )
    },
    {
      key: "status" as keyof Incidente,
      label: t('sweepRiscos.incidentes.colStatus'),
      sortable: true,
      render: (_v: any, item: Incidente) => {
        return (
          <div className="flex items-center gap-2">
            <StatusBadge {...resolveWorkflowStatusTone(item.status)}>
              {formatStatus(item.status)}
            </StatusBadge>
          </div>
        );
      }
    },
    {
      key: "responsavel_tratamento" as keyof Incidente,
      label: t("experience.assignedTo"),
      mobilePriority: 2,
      render: (_value: any, item: Incidente) => nomeResponsavel(item.responsavel_tratamento) || t("experience.notAssigned"),
    },
    {
      key: "proximo_prazo" as keyof Incidente,
      label: t("experience.treatmentDeadline"),
      mobilePriority: 3,
      render: (_value: any, item: Incidente) => item.proximo_prazo ? formatDateOnly(item.proximo_prazo) : t("experience.noDeadline"),
    },
    {
      key: "data_deteccao" as keyof Incidente,
      label: t('fin.incidentes.dataDeteccao'),
      sortable: true,
      render: (_v: any, item: Incidente) => formatDateOnly(item.data_deteccao)
    },
    {
      key: "actions" as keyof Incidente,
      label: t('fin.comum.acoes'),
      render: (_v: any, item: Incidente) => (
        <TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('layout.moreActions')} title={t('layout.moreActions')}>
                <IconMore className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(item)}>
                <IconEdit className="mr-2 h-4 w-4" />
                {t('sweepRiscos.incidentes.actionEditar')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleComunicacao(item)}>
                <IconMessage className="mr-2 h-4 w-4" />
                {t('sweepRiscos.incidentes.actionComunicacao')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEvidencias(item)}>
                <IconFile className="mr-2 h-4 w-4" />
                {t('sweepRiscos.incidentes.actionEvidencias')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTratamentos(item)}>
                <IconShield className="mr-2 h-4 w-4" />
                {t('sweepRiscos.incidentes.actionTratamentos')}
              </DropdownMenuItem>
              <CriarTarefaMenuItem
                entidadeTipo="incidente"
                entidadeId={item.id}
                tituloSugerido={t('sweepRiscos.incidentes.tarefaTituloSugerido', { titulo: item.titulo ?? '' })}
              />
              <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive">
                <IconDelete className="mr-2 h-4 w-4" />{t('fin.comum.excluir')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      )
    }
  ];

  const statsCards = [
    {
      title: t('sweepRiscos.incidentes.statTotalTitulo'),
      value: statsIncidentes?.total || 0,
      description: t('sweepRiscos.incidentes.statAbertosDesc', { count: statsIncidentes?.abertos || 0 }),
      icon: <IconWarning />,
      drillDown: 'incidentes' as const,
      segments: [
        { label: t('fin.comum.criticosLower'), value: statsIncidentes?.criticos || 0, tone: 'destructive' as const },
        { label: t('sweepRiscos.incidentes.segAltos'), value: statsIncidentes?.altos || 0, tone: 'warning' as const },
        { label: t('sweepRiscos.incidentes.segDemais'), value: Math.max(0, (statsIncidentes?.total || 0) - (statsIncidentes?.criticos || 0) - (statsIncidentes?.altos || 0)), tone: 'neutral' as const },
      ],
      emptyHint: t('sweepRiscos.incidentes.emptyHintRegistrar'),
    },
    {
      title: t('fin.incidentes.criticosAltos'),
      value: (statsIncidentes?.criticos || 0) + (statsIncidentes?.altos || 0),
      description: t('fin.incidentes.atencaoImediata'),
      icon: <IconShield />,
      variant: 'destructive' as const,
      drillDown: 'incidentes_criticos' as const,
    },
    {
      title: t('fin.incidentes.emInvestigacao'),
      value: statsIncidentes?.investigacao || 0,
      description: t('sweepRiscos.incidentes.statInvestigacaoDesc'),
      icon: <IconTime />,
      variant: 'info' as const,
      drillDown: 'incidentes_investigacao' as const,
    },
    {
      title: t('fin.comum.esteMes'),
      value: statsIncidentes?.mes || 0,
      description: t('fin.incidentes.novos'),
      icon: <IconCalendar />,
    }
  ];

  const filters = [
    {
      key: 'status',
      label: t('sweepRiscos.incidentes.filterStatusLabel'),
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: 'todos', label: t('sweepRiscos.incidentes.filterStatusTodos') },
        { value: 'aberto', label: t('sweepRiscos.incidentes.filterStatusAberto') },
        { value: 'investigacao', label: t('fin.incidentes.investigacao') },
        { value: 'contido', label: t('sweepRiscos.incidentes.filterStatusContido') },
        { value: 'resolvido', label: t('sweepRiscos.incidentes.filterStatusResolvido') },
        { value: 'fechado', label: t('sweepRiscos.incidentes.filterStatusFechado') },
      ]
    },
    {
      key: 'tipo',
      label: t('fin.comum.tipo'),
      value: tipoFilter,
      onChange: setTipoFilter,
      options: [
        { value: 'todos', label: t('fin.comum.todosTipos') },
        { value: 'seguranca', label: t('sweepRiscos.incidentes.filterTipoSeguranca') },
        { value: 'privacidade', label: t('sweepRiscos.incidentes.filterTipoPrivacidade') },
        { value: 'disponibilidade', label: t('sweepRiscos.incidentes.filterTipoDisponibilidade') },
      ]
    },
    {
      key: 'criticidade',
      label: t('sweepRiscos.incidentes.filterCriticidadeLabel'),
      value: criticidadeFilter,
      onChange: setCriticidadeFilter,
      // Vocabulário canónico. Com 'alta'/'critica' o filtro comparava com o
      // texto gravado e devolvia "Nenhum incidente encontrado" numa lista com
      // dois incidentes "Alto" à vista — o mesmo defeito que o filtro de nível
      // do módulo de Riscos tinha.
      options: [
        { value: 'todos', label: t('sweepRiscos.incidentes.filterCriticidadeTodas') },
        { value: 'baixo', label: t('sweepRiscos.incidentes.filterCriticidadeBaixa') },
        { value: 'medio', label: t('sweepRiscos.incidentes.filterCriticidadeMedia') },
        { value: 'alto', label: t('sweepRiscos.incidentes.filterCriticidadeAlta') },
        { value: 'critico', label: t('fin.comum.criticaF') },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.incidentes.title')}
        description={t('modules.incidentes.description')}
        actions={
          <IncidenteDialog
            onSuccess={() => {
              invalidateIncidentes();
            }}
          />
        }
        secondaryActions={[
          {
            label: t('p3Import.importButtonLabel'),
            icon: <IconUpload className="h-4 w-4" />,
            onClick: () => setImportDialogOpen(true),
          },
          {
            label: t('sweepRiscos.incidentes.exportBtnLabel'),
            icon: <IconDownload className="h-4 w-4" />,
            disabled: incidentes.length === 0,
            onClick: () => {
              exportCSV(
                [t('sweepRiscos.incidentes.exportColTitulo'), t('fin.comum.tipo'), t('sweepRiscos.incidentes.exportColCategoria'), t('sweepRiscos.incidentes.exportColCriticidade'), t('sweepRiscos.incidentes.exportColStatus'), t('sweepRiscos.incidentes.exportColDataDeteccao'), t('sweepRiscos.incidentes.exportColDataResolucao')],
                // Exportar o que esta na tabela: iterava `incidentes` (a base
                // inteira) enquanto o ecra mostrava `sortedIncidentes`. E a
                // coluna e `tipo_incidente`, nao `tipo`.
                sortedIncidentes.map((inc: any) => [
                  inc.titulo, inc.tipo_incidente || '', inc.categoria || '', inc.criticidade || '',
                  inc.status || '', inc.data_deteccao || '', inc.data_resolucao || ''
                ]),
                'incidentes'
              );
            },
          },
        ]}
      />

      <StatStrip
        loading={loading || statsLoading}
        error={isError || statsError}
        items={[
          { key: 'total', label: statsCards[0].title, value: statsCards[0].value, drillDown: 'incidentes' },
          { key: 'criticosAltos', label: statsCards[1].title, value: statsCards[1].value, tone: 'destructive', drillDown: 'incidentes_criticos' },
          { key: 'investigacao', label: statsCards[2].title, value: statsCards[2].value, drillDown: 'incidentes_investigacao' },
          { key: 'mes', label: statsCards[3].title, value: statsCards[3].value },
        ]}
      />

      <ImportIncidentesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={invalidateIncidentes}
      />

      {/* Dialog de Edição - controlado pelo dropdown */}
      {selectedIncidente && editDialogOpen && (
        <IncidenteDialog
          incidente={selectedIncidente}
          externalOpen={editDialogOpen}
          onExternalOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setSelectedIncidente(null);
          }}
          onSuccess={() => {
            invalidateIncidentes();
            setEditDialogOpen(false);
            setSelectedIncidente(null);
          }}
        />
      )}

      {/* Lista de Incidentes com DataTable */}
      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            paginated
            pageSize={20}
            data={sortedIncidentes}
            columns={incidentesColumns}
            onRowClick={(item) => setDetalheIncidente(item)}
            loading={loading}
            error={isError}
            onRefresh={() => void refetch()}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={t('fin.incidentes.buscar')}
            filters={filters}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            emptyState={{
              icon: <IncidentesIcon className="h-8 w-8" />,
              title: t('fin.incidentes.nenhum'),
              description: t('sweepRiscos.incidentes.emptyStateDesc')
            }}
          />
        </CardContent>
      </Card>

      <RecordDetailDrawer
        open={!!detalheIncidente && !tratamentoDialogOpen && !evidenciaDialogOpen && !comunicacaoDialogOpen}
        onOpenChange={(o) => !o && setDetalheIncidente(null)}
        title={detalheIncidente?.titulo}
        eyebrow={t('sweepRiscos.incidentes.detailEyebrow')}
        icon={IncidentesIcon}
        subtitle={detalheIncidente ? formatStatus(detalheIncidente.tipo_incidente) : undefined}
        badges={detalheIncidente ? (
          <>
            <StatusBadge {...resolveWorkflowStatusTone(detalheIncidente.status)}>
              {formatStatus(detalheIncidente.status)}
            </StatusBadge>
            <StatusBadge {...resolveCriticidadeTone(detalheIncidente.criticidade)}>
              {formatStatus(detalheIncidente.criticidade)}
            </StatusBadge>
          </>
        ) : undefined}
        actions={detalheIncidente ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
            <Button
              size="sm"
              className="h-11 shrink-0 justify-start px-4 shadow-sm"
              onClick={() => { const i = detalheIncidente; setDetalheIncidente(null); handleEdit(i); }}
            >
              <IconEdit className="mr-2 h-4 w-4" />
              {t('sweepRiscos.incidentes.actionEditar')}
            </Button>
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 rounded-lg border border-border/80 bg-surface-1 p-1 sm:grid-cols-3">
              <Button
                variant="ghost"
                size="sm"
                className="group h-9 min-w-0 justify-start gap-2 px-2.5 text-muted-foreground hover:bg-popover hover:text-foreground hover:shadow-sm"
                onClick={() => { setSelectedIncidente(detalheIncidente); setTratamentoDialogOpen(true); }}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-primary/[0.07] text-primary">
                  <IconChecklist className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 truncate">{t('sweepRiscos.incidentes.actionTratamentos')}</span>
                <span className="ml-auto border-l border-border/70 pl-2 text-xs font-semibold tabular-nums text-muted-foreground">
                  {detalheIncidente.tratamentos_count || 0}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="group h-9 min-w-0 justify-start gap-2 px-2.5 text-muted-foreground hover:bg-popover hover:text-foreground hover:shadow-sm"
                onClick={() => { setSelectedIncidente(detalheIncidente); setEvidenciaDialogOpen(true); }}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-primary/[0.07] text-primary">
                  <IconAttach className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 truncate">{t('sweepRiscos.incidentes.actionEvidencias')}</span>
                <span className="ml-auto border-l border-border/70 pl-2 text-xs font-semibold tabular-nums text-muted-foreground">
                  {detalheIncidente.evidencias_count || 0}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="group h-9 min-w-0 justify-start gap-2 px-2.5 text-muted-foreground hover:bg-popover hover:text-foreground hover:shadow-sm"
                onClick={() => { setSelectedIncidente(detalheIncidente); setComunicacaoDialogOpen(true); }}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-primary/[0.07] text-primary">
                  <IconMegaphone className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 truncate">{t('sweepRiscos.incidentes.actionComunicacao')}</span>
                <span className="ml-auto border-l border-border/70 pl-2 text-xs font-semibold tabular-nums text-muted-foreground">
                  {detalheIncidente.comunicacoes_count || 0}
                </span>
              </Button>
            </div>
          </div>
        ) : undefined}
        fields={detalheIncidente ? [
          { label: t('fin.comum.categoria'), value: detalheIncidente.categoria ? formatStatus(detalheIncidente.categoria) : null },
          { label: t('sweepRiscos.incidentes.origemDeteccao'), value: detalheIncidente.origem_deteccao ? formatStatus(detalheIncidente.origem_deteccao) : null },
          { label: t('sweepRiscos.incidentes.impactoEstimado'), value: detalheIncidente.impacto_estimado },
          { label: t('sweepRiscos.incidentes.responsavelDeteccao'), value: nomeResponsavel(detalheIncidente.responsavel_deteccao) },
          { label: t('sweepRiscos.incidentes.responsavelTratamento'), value: nomeResponsavel(detalheIncidente.responsavel_tratamento) || t('experience.notAssigned') },
          { label: t('experience.treatmentDeadline'), value: detalheIncidente.proximo_prazo ? formatDateOnly(detalheIncidente.proximo_prazo) : t('experience.noDeadline') },
          { label: t('fin.incidentes.dataOcorrencia'), value: detalheIncidente.data_ocorrencia ? formatDateOnly(detalheIncidente.data_ocorrencia) : null },
          { label: t('fin.incidentes.dataDeteccao'), value: detalheIncidente.data_deteccao ? formatDateOnly(detalheIncidente.data_deteccao) : null },
          { label: t('fin.incidentes.dataResolucao'), value: detalheIncidente.data_resolucao ? formatDateOnly(detalheIncidente.data_resolucao) : null },
          { label: t('sweepRiscos.incidentes.dadosAfetados'), value: detalheIncidente.dados_afetados, full: true },
          { label: t('sweepRiscos.incidentes.sistemasAfetados'), value: detalheIncidente.sistemas_afetados?.join(', '), full: true },
          { label: t('sweepRiscos.incidentes.ativosAfetados'), value: detalheIncidente.ativos_afetados?.join(', '), full: true },
          { label: t('fin.comum.descricao'), value: detalheIncidente.descricao, full: true },
        ] : []}
        createdAt={detalheIncidente?.created_at}
      />

      {/* Dialog de Comunicação - controlado pelo dropdown */}
      {selectedIncidente && (
        <ComunicacaoDialog
          incidenteId={selectedIncidente.id}
          onSuccess={invalidateIncidentes}
          trigger={<span className="hidden" />}
          externalOpen={comunicacaoDialogOpen}
          onExternalOpenChange={(open) => {
            setComunicacaoDialogOpen(open);
            if (!open) setSelectedIncidente(null);
          }}
        />
      )}

      {/* Dialog de Evidências - controlado pelo dropdown */}
      {selectedIncidente && (
        <EvidenciaDialog
          incidenteId={selectedIncidente.id}
          onSuccess={invalidateIncidentes}
          trigger={<span className="hidden" />}
          externalOpen={evidenciaDialogOpen}
          onExternalOpenChange={(open) => {
            setEvidenciaDialogOpen(open);
            if (!open) setSelectedIncidente(null);
          }}
        />
      )}

      {/* Dialog de Tratamentos - controlado pelo dropdown */}
      {selectedIncidente && (
        <TratamentoDialog
          incidenteId={selectedIncidente.id}
          onSuccess={invalidateIncidentes}
          externalOpen={tratamentoDialogOpen}
          onExternalOpenChange={(open) => {
            setTratamentoDialogOpen(open);
            if (!open) setSelectedIncidente(null);
          }}
        />
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title={t('fin.incidentes.excluirTitle')}
        description={t('fin.incidentes.excluirDesc')}
        confirmText={t('fin.comum.excluir')}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
