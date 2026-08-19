import { useState, useMemo, useEffect } from 'react';
import { IconAdd, IconEdit, IconDelete, IconUpload, IconMore, IconSuccess, IconWarning, IconTime, IconFileCheck, IconRefresh, IconBan } from '@/components/icons';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { LicencaDialog } from '@/components/ativos/LicencaDialog';
import ImportLicencasDialog from '@/components/ativos/ImportLicencasDialog';
import { StatStrip } from '@/components/ui/stat-strip';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLicencasStats } from '@/hooks/useLicencasStats';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { exportCSV } from '@/lib/csv-utils';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveCriticidadeTone, resolveItemStatusTone } from '@/lib/status-tone';
import { RecordDetailDrawer } from '@/components/common/RecordDetailDrawer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmpresaMoeda } from '@/hooks/useEmpresaMoeda';

interface Licenca {
  id: string;
  nome: string;
  tipo_licenca: string;
  fornecedor: string;
  chave_licenca?: string;
  quantidade_licencas: number;
  data_aquisicao: string;
  data_vencimento: string;
  valor_renovacao?: number;
  criticidade: string;
  status: string;
  observacoes?: string;
  responsavel?: string;
  responsavel_nome?: string | null;
  responsavel_avatar?: string | null;
}

export default function AtivosLicencas() {
  const { t } = useLanguage();
  const { format: formatMoedaEmpresa } = useEmpresaMoeda();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedLicenca, setSelectedLicenca] = useState<Licenca | null>(null);
  const [detalheLicenca, setDetalheLicenca] = useState<Licenca | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [criticidadeFilter, setCriticidadeFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [sortField, setSortField] = useState('nome');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string;
    nome: string;
  }>({ open: false, id: '', nome: '' });
  const { toast } = useToast();
  const { empresaId } = useEmpresaId();

  // Buscar estatísticas
  const { data: stats, isLoading: statsLoading } = useLicencasStats();

  // Buscar licenças
  const { data: licencas = [], refetch, isLoading } = useQuery({
    queryKey: ['ativos-licencas', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ativos_licencas')
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('data_vencimento');

      if (error) throw error;
      
      // Fetch responsible user profiles
      if (data && data.length > 0) {
        const responsavelIds = data
          .map(l => l.responsavel)
          .filter(r => r && r.trim() !== '');
        
        if (responsavelIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .rpc('get_profiles_by_text_ids', { text_ids: responsavelIds });
          
          if (!profilesError && profiles) {
            const profileMap = new Map(
              profiles.map((p: any) => [p.user_id.toString(), { nome: p.nome, foto_url: p.foto_url }])
            );
            
            return data.map(licenca => {
              const profileData = (licenca.responsavel && licenca.responsavel.trim() !== '')
                ? profileMap.get(licenca.responsavel)
                : null;
              
              return {
                ...licenca,
                responsavel_nome: profileData?.nome || null,
                responsavel_avatar: profileData?.foto_url || null
              };
            }) as Licenca[];
          }
        }
      }
      
      return (data || []) as Licenca[];
    },
    enabled: !!empresaId,
  });

  const handleNew = () => {
    setSelectedLicenca(null);
    setDialogOpen(true);
  };

  const handleEdit = (licenca: Licenca) => {
    setSelectedLicenca(licenca);
    setDialogOpen(true);
  };

  const [searchParams, setSearchParams] = useSearchParams();

  // Deep link vindo da busca global (Cmd+K): abre o registo focado para edição/visualização.
  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId || licencas.length === 0) return;
    const item = licencas.find((licenca) => licenca.id === focusId);
    if (item) {
      handleEdit(item);
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, licencas]);

  const handleDelete = (id: string, nome: string) => {
    setDeleteConfirm({ open: true, id, nome });
  };

  const confirmDelete = async () => {
    const { error } = await supabase
      .from('ativos_licencas')
      .delete()
      .eq('id', deleteConfirm.id);

    if (error) {
      toast({
        title: t('fin.licencas.erroExcluir'),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t('fin.licencas.excluida'),
      description: t('fin.licencas.excluidaDesc'),
    });
    
    refetch();
    setDeleteConfirm({ open: false, id: '', nome: '' });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: React.ComponentType<any>, label: string }> = {
      'ativa': { icon: IconSuccess, label: t('sweepDados.ativos.statusAtiva') },
      'vencida': { icon: IconWarning, label: t('sweepDados.ativos.statusVencida') },
      'a_vencer': { icon: IconTime, label: t('sweepDados.ativos.statusAVencer') },
      'em_renovacao': { icon: IconRefresh, label: t('fin.licencas.emRenovacao') },
      'cancelada': { icon: IconBan, label: t('sweepDados.ativos.statusCancelada') },
    };

    const config = statusConfig[status] || statusConfig.ativa;

    return (
      <StatusBadge {...resolveItemStatusTone(status)}>
        {config.label}
      </StatusBadge>
    );
  };

  const getCriticidadeBadge = (criticidade: string) => {
    return (
      <StatusBadge {...resolveCriticidadeTone(criticidade)}>
        {formatStatus(criticidade)}
      </StatusBadge>
    );
  };

  // Filtrar e ordenar licenças
  const filteredAndSortedLicencas = useMemo(() => {
    let filtered = licencas.filter(licenca => {
      const matchesSearch = searchTerm === '' || 
        licenca.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        licenca.tipo_licenca.toLowerCase().includes(searchTerm.toLowerCase()) ||
        licenca.fornecedor.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'todos' || licenca.status === statusFilter;
      const matchesCriticidade = criticidadeFilter === 'todos' || licenca.criticidade === criticidadeFilter;
      const matchesTipo = tipoFilter === 'todos' || licenca.tipo_licenca === tipoFilter;

      return matchesSearch && matchesStatus && matchesCriticidade && matchesTipo;
    });

    // Ordenar
    filtered.sort((a, b) => {
      const aValue = a[sortField as keyof Licenca];
      const bValue = b[sortField as keyof Licenca];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [licencas, searchTerm, statusFilter, criticidadeFilter, tipoFilter, sortField, sortDirection]);

  // Configuração das colunas
  const columns = [
    {
      key: 'nome',
      label: t('sweepDados.ativos.colNomeLicenca'),
      sortable: true,
      render: (_: any, licenca: Licenca) => (
        <div>
          <div className="font-medium">{licenca.nome}</div>
          <div className="text-sm text-muted-foreground">{licenca.fornecedor}</div>
        </div>
      )
    },
    {
      key: 'tipo_licenca',
      label: t('fin.comum.tipo'),
      sortable: true,
      render: (_: any, licenca: Licenca) => (
        <Badge variant="outline">{formatStatus(licenca.tipo_licenca)}</Badge>
      )
    },
    {
      key: 'quantidade_licencas',
      label: t('sweepDados.ativos.colQuantidade'),
      sortable: true,
    },
    {
      key: 'data_vencimento',
      label: t('sweepDados.ativos.colDataVencimento'),
      sortable: true,
      render: (_: any, licenca: Licenca) => formatDateOnly(licenca.data_vencimento)
    },
    {
      key: 'valor_renovacao',
      label: t('fin.licencas.valorRenovacao'),
      sortable: true,
      render: (_: any, licenca: Licenca) => (
        licenca.valor_renovacao 
          ? formatMoedaEmpresa(licenca.valor_renovacao)
          : '-'
      )
    },
    {
      key: 'criticidade',
      label: t('sweepDados.ativos.colCriticidade'),
      sortable: true,
      render: (_: any, licenca: Licenca) => getCriticidadeBadge(licenca.criticidade)
    },
    {
      key: 'status',
      label: t('sweepDados.ativos.colStatus'),
      sortable: true,
      render: (_: any, licenca: Licenca) => getStatusBadge(licenca.status)
    },
    {
      key: 'responsavel',
      label: t('fin.comum.responsavel'),
      render: (_: any, licenca: Licenca) => {
        if (!licenca.responsavel_nome) return '-';
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer">
                  {licenca.responsavel_avatar && (
                    <AvatarImage src={licenca.responsavel_avatar} alt={licenca.responsavel_nome} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {licenca.responsavel_nome
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{licenca.responsavel_nome}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
    },
    {
      key: 'acoes',
      label: t('fin.comum.acoes'),
      render: (_: any, licenca: Licenca) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <IconMore className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(licenca)}>
              <IconEdit className="h-4 w-4 mr-2" />
              {t('sweepDados.ativos.editar')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDelete(licenca.id, licenca.nome)}
              className="text-destructive focus:text-destructive"
            >
              <IconDelete className="h-4 w-4 mr-2" />{t('fin.comum.excluir')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  // Configuração dos filtros
  const filters = [
    {
      key: 'status',
      label: t('sweepDados.ativos.colStatus'),
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: 'todos', label: t('sweepDados.ativos.filtroTodosStatus') },
          { value: 'ativa', label: t('sweepDados.ativos.statusAtiva') },
          { value: 'vencida', label: t('sweepDados.ativos.statusVencida') },
          { value: 'a_vencer', label: t('sweepDados.ativos.statusAVencer') },
          { value: 'em_renovacao', label: t('fin.licencas.emRenovacao') },
          { value: 'cancelada', label: t('sweepDados.ativos.statusCancelada') },
      ]
    },
    {
      key: 'criticidade',
      label: t('sweepDados.ativos.colCriticidade'),
      value: criticidadeFilter,
      onChange: setCriticidadeFilter,
      options: [
        { value: 'todos', label: t('sweepDados.ativos.filtroTodasCriticidades') },
        { value: 'critica', label: t('fin.comum.criticaF') },
        { value: 'alta', label: t('sweepDados.ativos.criticidadeAlta') },
        { value: 'media', label: t('sweepDados.ativos.criticidadeMedia') },
        { value: 'baixa', label: t('sweepDados.ativos.criticidadeBaixa') },
      ]
    },
    {
      key: 'tipo',
      label: t('fin.comum.tipo'),
      value: tipoFilter,
      onChange: setTipoFilter,
      options: [
        { value: 'todos', label: t('sweepDados.ativos.filtroTodosTipos') },
          { value: 'software', label: t('sweepDados.ativos.tipoSoftware') },
          { value: 'servico', label: t('sweepDados.ativos.tipoServico') },
          { value: 'certificacao', label: t('fin.licencas.certificacao') },
          { value: 'outro', label: t('sweepDados.ativos.tipoOutro') },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.licencas.title')}
        description={t('modules.licencas.description')}
        actions={
          <Button size="sm" onClick={handleNew}>
            <IconAdd className="h-4 w-4 mr-2" />
            {t('sweepDados.ativos.novaLicenca')}
          </Button>
        }
        secondaryActions={[
          {
            label: t('p3Import.importButtonLabel'),
            icon: <IconUpload className="h-4 w-4" />,
            onClick: () => setImportDialogOpen(true),
          },
        ]}
      />

      <StatStrip
        loading={statsLoading}
        items={[
          { key: 'total', label: t('cardsKpi.licencas.totalLicencas'), value: stats?.total ?? 0, drillDown: 'ativos_licencas' },
          { key: 'ativas', label: t('cardsKpi.licencas.licencasAtivas'), value: stats?.ativas ?? 0, drillDown: 'ativos_licencas' },
          { key: 'aVencer', label: t('sweepDados.ativos.statusAVencer'), value: stats?.vencendo30dias ?? 0, tone: 'warning', drillDown: 'ativos_licencas' },
          { key: 'vencidas', label: t('sweepDados.ativos.kpiVencidasTitle'), value: stats?.vencidas ?? 0, tone: 'destructive', drillDown: 'ativos_licencas' },
        ]}
      />

      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            data={filteredAndSortedLicencas}
            columns={columns}
            onRowClick={(licenca) => setDetalheLicenca(licenca)}
            loading={isLoading}
            searchable
            searchPlaceholder={t('fin.licencas.buscar')}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filters={filters}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={(field) => {
              if (sortField === field) {
                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
              } else {
                setSortField(field);
                setSortDirection('asc');
              }
            }}
            onExport={() => {
              // Sem BOM o Excel lia "ÁÇÁÇ" em vez dos acentos, e sem escape um
              // valor com vírgula partia a linha em colunas erradas.
              // `exportCSV` trata os dois — é o mesmo caminho do resto do produto.
              exportCSV(
                [t('fin.comum.nome'), t('fin.comum.tipo'), t('fin.comum.fornecedor'), t('fin.comum.vencimento'), t('fin.licencas.valorRenovacao'), t('sweepDados.ativos.colCriticidade'), t('sweepDados.ativos.colStatus'), t('fin.comum.responsavel')],
                filteredAndSortedLicencas.map(l => [
                  l.nome,
                  l.tipo_licenca,
                  l.fornecedor,
                  formatDateOnly(l.data_vencimento),
                  l.valor_renovacao?.toString() || '',
                  l.criticidade,
                  l.status,
                  l.responsavel_nome || ''
                ]),
                `licencas-${new Date().toISOString().split('T')[0]}.csv`,
              );
            }}
            emptyState={{
              icon: <IconFileCheck className="h-8 w-8" />,
              title: searchTerm ? t('fin.licencas.nenhumaEncontrada') : t('fin.licencas.nenhumaCadastrada'),
              description: searchTerm 
                ? t('sweepDados.ativos.buscaSemResultadosDesc')
                : t('fin.licencas.vazioDesc'),
              action: !searchTerm ? {
                label: t('sweepDados.ativos.cadastrarPrimeiraLicenca'),
                onClick: handleNew
              } : undefined
            }}
            onRefresh={refetch}
          />
        </CardContent>
      </Card>

      {/* Diálogos */}
      <LicencaDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedLicenca(null);
            refetch();
          }
        }}
        licenca={selectedLicenca}
      />

      <ImportLicencasDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={refetch}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title={t('fin.licencas.excluirTitle')}
        description={t('fin.licencas.excluirDesc', { nome: deleteConfirm.nome })}
        confirmText={t('fin.comum.excluir')}
        cancelText={t('fin.comum.cancelar')}
        variant="destructive"
        onConfirm={confirmDelete}
      />
      <RecordDetailDrawer
        open={!!detalheLicenca}
        onOpenChange={(o) => !o && setDetalheLicenca(null)}
        title={detalheLicenca?.nome}
        subtitle={detalheLicenca ? formatStatus(detalheLicenca.tipo_licenca) : undefined}
        badges={detalheLicenca ? (
          <>
            <StatusBadge {...resolveItemStatusTone(detalheLicenca.status)}>{formatStatus(detalheLicenca.status)}</StatusBadge>
            <StatusBadge {...resolveCriticidadeTone(detalheLicenca.criticidade)}>{formatStatus(detalheLicenca.criticidade)}</StatusBadge>
          </>
        ) : undefined}
        actions={detalheLicenca ? (
          <Button variant="outline" size="sm" onClick={() => { const l = detalheLicenca; setDetalheLicenca(null); handleEdit(l); }}>
            {t('fin.comum.editar')}
          </Button>
        ) : undefined}
        fields={detalheLicenca ? [
          { label: t('detalheRegisto.fornecedor'), value: detalheLicenca.fornecedor },
          { label: t('detalheRegisto.quantidade'), value: detalheLicenca.quantidade_licencas },
          { label: t('detalheRegisto.responsavel'), value: detalheLicenca.responsavel_nome },
          { label: t('detalheRegisto.vencimento'), value: detalheLicenca.data_vencimento ? formatDateOnly(detalheLicenca.data_vencimento) : null },
          { label: t('detalheRegisto.valorRenovacao'), value: detalheLicenca.valor_renovacao != null ? formatMoedaEmpresa(detalheLicenca.valor_renovacao) : null },
          { label: t('detalheRegisto.observacoes'), value: detalheLicenca.observacoes, full: true },
        ] : []}
      />

    </div>
  );
}
