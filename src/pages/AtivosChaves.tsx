import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Upload, Key, AlertTriangle, CheckCircle, Clock, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ChaveDialog } from '@/components/ativos/ChaveDialog';
import ImportChavesDialog from '@/components/ativos/ImportChavesDialog';
import { StatStrip } from '@/components/ui/stat-strip';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useChavesStats } from '@/hooks/useChavesStats';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveCriticidadeTone, resolveItemStatusTone } from '@/lib/status-tone';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChaveCriptografica {
  id: string;
  nome: string;
  tipo_chave: string;
  ambiente: string;
  sistema_aplicacao?: string;
  localizacao: string;
  data_criacao: string;
  data_ultima_rotacao?: string;
  data_proxima_rotacao: string;
  periodicidade_rotacao?: string;
  criticidade: string;
  status: string;
  algoritmo?: string;
  observacoes?: string;
  responsavel?: string;
  responsavel_nome?: string | null;
  responsavel_avatar?: string | null;
  rotacao_automatica: boolean;
}

export default function AtivosChaves() {
  const { t } = useLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedChave, setSelectedChave] = useState<ChaveCriptografica | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [criticidadeFilter, setCriticidadeFilter] = useState('todos');
  const [ambienteFilter, setAmbienteFilter] = useState('todos');
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
  const { data: stats, isLoading: statsLoading } = useChavesStats();

  // Buscar chaves
  const { data: chaves = [], refetch, isLoading } = useQuery({
    queryKey: ['ativos-chaves', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ativos_chaves_criptograficas')
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('data_proxima_rotacao');

      if (error) throw error;
      
      // Fetch responsible user profiles
      if (data && data.length > 0) {
        const responsavelIds = data
          .map(c => c.responsavel)
          .filter(r => r && r.trim() !== '');
        
        if (responsavelIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .rpc('get_profiles_by_text_ids', { text_ids: responsavelIds });
          
          if (!profilesError && profiles) {
            const profileMap = new Map(
              profiles.map((p: any) => [p.user_id.toString(), { nome: p.nome, foto_url: p.foto_url }])
            );
            
            return data.map(chave => {
              const profileData = (chave.responsavel && chave.responsavel.trim() !== '')
                ? profileMap.get(chave.responsavel)
                : null;
              
              return {
                ...chave,
                responsavel_nome: profileData?.nome || null,
                responsavel_avatar: profileData?.foto_url || null
              };
            }) as ChaveCriptografica[];
          }
        }
      }
      
      return (data || []) as ChaveCriptografica[];
    },
    enabled: !!empresaId,
  });

  const handleNew = () => {
    setSelectedChave(null);
    setDialogOpen(true);
  };

  const handleEdit = (chave: ChaveCriptografica) => {
    setSelectedChave(chave);
    setDialogOpen(true);
  };

  const [searchParams, setSearchParams] = useSearchParams();

  // Deep link vindo da busca global (Cmd+K): abre o registo focado para edição/visualização.
  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId || chaves.length === 0) return;
    const item = chaves.find((chave) => chave.id === focusId);
    if (item) {
      handleEdit(item);
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, chaves]);

  const handleDelete = (id: string, nome: string) => {
    setDeleteConfirm({ open: true, id, nome });
  };

  const confirmDelete = async () => {
    const { error } = await supabase
      .from('ativos_chaves_criptograficas')
      .delete()
      .eq('id', deleteConfirm.id);

    if (error) {
      toast({
        title: t('fin.chaves.erroExcluir'),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t('fin.chaves.excluida'),
      description: t('fin.chaves.excluidaDesc'),
    });
    
    refetch();
    setDeleteConfirm({ open: false, id: '', nome: '' });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: React.ComponentType<any>, label: string }> = {
      'ativa': { icon: CheckCircle, label: t('sweepDados.ativos.statusAtiva') },
      'expirada': { icon: AlertTriangle, label: t('sweepDados.ativos.statusExpirada') },
      'revogada': { icon: AlertTriangle, label: t('sweepDados.ativos.statusRevogada') },
      'em_rotacao': { icon: Clock, label: t('fin.chaves.emRotacao') },
    };

    const config = statusConfig[status] || statusConfig.ativa;
    const Icon = config.icon;

    return (
      <StatusBadge size="sm" {...resolveItemStatusTone(status)} icon={<Icon className="h-3 w-3" strokeWidth={1.5} />}>
        {config.label}
      </StatusBadge>
    );
  };

  const getCriticidadeBadge = (criticidade: string) => {
    return (
      <StatusBadge size="sm" {...resolveCriticidadeTone(criticidade)}>
        {formatStatus(criticidade)}
      </StatusBadge>
    );
  };


  // Filtrar e ordenar chaves
  const filteredAndSortedChaves = useMemo(() => {
    let filtered = chaves.filter(chave => {
      const matchesSearch = searchTerm === '' || 
        chave.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chave.tipo_chave.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chave.sistema_aplicacao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chave.localizacao.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'todos' || chave.status === statusFilter;
      const matchesCriticidade = criticidadeFilter === 'todos' || chave.criticidade === criticidadeFilter;
      const matchesAmbiente = ambienteFilter === 'todos' || chave.ambiente === ambienteFilter;
      const matchesTipo = tipoFilter === 'todos' || chave.tipo_chave === tipoFilter;

      return matchesSearch && matchesStatus && matchesCriticidade && matchesAmbiente && matchesTipo;
    });

    // Ordenar
    filtered.sort((a, b) => {
      const aValue = a[sortField as keyof ChaveCriptografica];
      const bValue = b[sortField as keyof ChaveCriptografica];

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
  }, [chaves, searchTerm, statusFilter, criticidadeFilter, ambienteFilter, tipoFilter, sortField, sortDirection]);

  // Configuração das colunas
  const columns = [
    {
      key: 'nome',
      label: t('sweepDados.ativos.colNomeChave'),
      sortable: true,
      render: (_: any, chave: ChaveCriptografica) => (
        <div>
          <div className="font-medium">{chave.nome}</div>
          {chave.sistema_aplicacao && (
            <div className="text-sm text-muted-foreground">{chave.sistema_aplicacao}</div>
          )}
        </div>
      )
    },
    {
      key: 'tipo_chave',
      label: t('fin.comum.tipo'),
      sortable: true,
      render: (_: any, chave: ChaveCriptografica) => (
        <Badge variant="outline">{formatStatus(chave.tipo_chave)}</Badge>
      )
    },
    {
      key: 'ambiente',
      label: t('fin.comum.ambiente'),
      sortable: true,
      render: (_: any, chave: ChaveCriptografica) => (
        <Badge variant="secondary">{chave.ambiente}</Badge>
      )
    },
    {
      key: 'localizacao',
      label: t('fin.comum.localizacao'),
      sortable: true,
    },
    {
      key: 'data_proxima_rotacao',
      label: t('fin.chaves.proximaRotacao'),
      sortable: true,
      render: (_: any, chave: ChaveCriptografica) => formatDateOnly(chave.data_proxima_rotacao)
    },
    {
      key: 'criticidade',
      label: t('sweepDados.ativos.colCriticidade'),
      sortable: true,
      render: (_: any, chave: ChaveCriptografica) => getCriticidadeBadge(chave.criticidade)
    },
    {
      key: 'status',
      label: t('sweepDados.ativos.colStatus'),
      sortable: true,
      render: (_: any, chave: ChaveCriptografica) => getStatusBadge(chave.status)
    },
    {
      key: 'responsavel',
      label: t('fin.comum.responsavel'),
      render: (_: any, chave: ChaveCriptografica) => {
        if (!chave.responsavel_nome) return '-';
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer">
                  {chave.responsavel_avatar && (
                    <AvatarImage src={chave.responsavel_avatar} alt={chave.responsavel_nome} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {chave.responsavel_nome
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{chave.responsavel_nome}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
    },
    {
      key: 'acoes',
      label: t('fin.comum.acoes'),
      render: (_: any, chave: ChaveCriptografica) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(chave)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('sweepDados.ativos.editar')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDelete(chave.id, chave.nome)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />{t('fin.comum.excluir')}</DropdownMenuItem>
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
        { value: 'expirada', label: t('sweepDados.ativos.statusExpirada') },
        { value: 'revogada', label: t('sweepDados.ativos.statusRevogada') },
        { value: 'em_rotacao', label: t('fin.chaves.emRotacao') },
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
      key: 'ambiente',
      label: t('fin.comum.ambiente'),
      value: ambienteFilter,
      onChange: setAmbienteFilter,
      options: [
        { value: 'todos', label: t('sweepDados.ativos.filtroTodosAmbientes') },
        { value: 'producao', label: t('fin.comum.producao') },
        { value: 'homologacao', label: t('fin.comum.homologacao') },
        { value: 'desenvolvimento', label: t('sweepDados.ativos.ambienteDesenvolvimento') },
        { value: 'qa', label: t('sweepDados.ativos.ambienteQa') },
      ]
    },
    {
      key: 'tipo',
      label: t('fin.comum.tipo'),
      value: tipoFilter,
      onChange: setTipoFilter,
      options: [
        { value: 'todos', label: t('sweepDados.ativos.filtroTodosTipos') },
        { value: 'api_key', label: t('sweepDados.ativos.tipoApiKey') },
        { value: 'certificado_ssl', label: t('sweepDados.ativos.tipoCertificadoSsl') },
        { value: 'ssh_key', label: t('sweepDados.ativos.tipoSshKey') },
        { value: 'token_acesso', label: t('sweepDados.ativos.tipoTokenAcesso') },
        { value: 'secret_key', label: t('sweepDados.ativos.tipoSecretKey') },
        { value: 'outro', label: t('sweepDados.ativos.tipoOutro') },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.chaves.title')}
        description={t('modules.chaves.description')}
        actions={
          <Button size="sm" onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            {t('sweepDados.ativos.novaChave')}
          </Button>
        }
        secondaryActions={[
          {
            label: t('p3Import.importButtonLabel'),
            icon: <Upload className="h-4 w-4" />,
            onClick: () => setImportDialogOpen(true),
          },
        ]}
      />

      <StatStrip
        loading={statsLoading}
        items={[
          { key: 'total', label: t('cardsKpi.chaves.totalChaves'), value: stats?.total ?? 0, drillDown: 'ativos_chaves' },
          { key: 'ativas', label: t('sweepDados.ativos.kpiChavesAtivasTitle'), value: stats?.ativas ?? 0, drillDown: 'ativos_chaves' },
          { key: 'rotacoesPendentes', label: t('fin.chaves.rotacoesPendentes'), value: stats?.rotacao30dias ?? 0, tone: 'warning', drillDown: 'ativos_chaves' },
          { key: 'criticas', label: t('fin.comum.criticasF'), value: stats?.criticas ?? 0, tone: 'destructive', drillDown: 'ativos_chaves' },
        ]}
      />

      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            data={filteredAndSortedChaves}
            columns={columns}
            loading={isLoading}
            searchable
            searchPlaceholder={t('fin.chaves.buscar')}
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
              const csvContent = [
                [t('fin.comum.nome'), t('fin.comum.tipo'), t('fin.comum.ambiente'), t('fin.comum.localizacao'), t('fin.chaves.proximaRotacao'), t('sweepDados.ativos.colCriticidade'), t('sweepDados.ativos.colStatus'), t('fin.comum.responsavel')].join(','),
                ...filteredAndSortedChaves.map(c => [
                  c.nome,
                  c.tipo_chave,
                  c.ambiente,
                  c.localizacao,
                  formatDateOnly(c.data_proxima_rotacao),
                  c.criticidade,
                  c.status,
                  c.responsavel_nome || ''
                ].join(','))
              ].join('\n');

              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `chaves-criptograficas-${new Date().toISOString().split('T')[0]}.csv`;
              link.click();
            }}
            emptyState={{
              icon: <Key className="h-8 w-8" />,
              title: searchTerm ? t('fin.chaves.nenhumaEncontrada') : t('fin.chaves.nenhumaCadastrada'),
              description: searchTerm 
                ? t('sweepDados.ativos.buscaSemResultadosDesc')
                : t('fin.chaves.vazioDesc'),
              action: !searchTerm ? {
                label: t('sweepDados.ativos.cadastrarPrimeiraChave'),
                onClick: handleNew
              } : undefined
            }}
            onRefresh={refetch}
          />
        </CardContent>
      </Card>

      {/* Diálogos */}
      <ChaveDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedChave(null);
            refetch();
          }
        }}
        chave={selectedChave}
      />

      <ImportChavesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={refetch}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title={t('fin.chaves.excluirTitle')}
        description={t('fin.chaves.excluirDesc', { nome: deleteConfirm.nome })}
        confirmText={t('fin.comum.excluir')}
        cancelText={t('fin.comum.cancelar')}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}