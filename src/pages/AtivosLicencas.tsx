import { useState, useMemo } from 'react';
import { Plus, FileCheck, AlertTriangle, CheckCircle, Clock, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { LicencaDialog } from '@/components/ativos/LicencaDialog';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLicencasStats } from '@/hooks/useLicencasStats';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveCriticidadeTone, resolveItemStatusTone } from '@/lib/status-tone';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLicenca, setSelectedLicenca] = useState<Licenca | null>(null);
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
        title: "Erro ao excluir licença",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Licença excluída",
      description: "A licença foi excluída com sucesso.",
    });
    
    refetch();
    setDeleteConfirm({ open: false, id: '', nome: '' });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: React.ComponentType<any>, label: string }> = {
      'ativa': { icon: CheckCircle, label: 'Ativa' },
      'vencida': { icon: AlertTriangle, label: 'Vencida' },
      'a_vencer': { icon: Clock, label: 'A Vencer' },
      'em_renovacao': { icon: Clock, label: 'Em Renovação' },
      'cancelada': { icon: Clock, label: 'Cancelada' },
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
      label: 'Nome da Licença',
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
      label: 'Tipo',
      sortable: true,
      render: (_: any, licenca: Licenca) => (
        <Badge variant="outline">{formatStatus(licenca.tipo_licenca)}</Badge>
      )
    },
    {
      key: 'quantidade_licencas',
      label: 'Quantidade',
      sortable: true,
    },
    {
      key: 'data_vencimento',
      label: 'Data Vencimento',
      sortable: true,
      render: (_: any, licenca: Licenca) => formatDateOnly(licenca.data_vencimento)
    },
    {
      key: 'valor_renovacao',
      label: 'Valor Renovação',
      sortable: true,
      render: (_: any, licenca: Licenca) => (
        licenca.valor_renovacao 
          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(licenca.valor_renovacao)
          : '-'
      )
    },
    {
      key: 'criticidade',
      label: 'Criticidade',
      sortable: true,
      render: (_: any, licenca: Licenca) => getCriticidadeBadge(licenca.criticidade)
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_: any, licenca: Licenca) => getStatusBadge(licenca.status)
    },
    {
      key: 'responsavel',
      label: 'Responsável',
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
      label: 'Ações',
      render: (_: any, licenca: Licenca) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(licenca)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDelete(licenca.id, licenca.nome)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  // Configuração dos filtros
  const filters = [
    {
      key: 'status',
      label: 'Status',
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: 'todos', label: 'Todos os status' },
          { value: 'ativa', label: 'Ativa' },
          { value: 'vencida', label: 'Vencida' },
          { value: 'a_vencer', label: 'A Vencer' },
          { value: 'em_renovacao', label: 'Em Renovação' },
          { value: 'cancelada', label: 'Cancelada' },
      ]
    },
    {
      key: 'criticidade',
      label: 'Criticidade',
      value: criticidadeFilter,
      onChange: setCriticidadeFilter,
      options: [
        { value: 'todos', label: 'Todas' },
        { value: 'critica', label: 'Crítica' },
        { value: 'alta', label: 'Alta' },
        { value: 'media', label: 'Média' },
        { value: 'baixa', label: 'Baixa' },
      ]
    },
    {
      key: 'tipo',
      label: 'Tipo',
      value: tipoFilter,
      onChange: setTipoFilter,
      options: [
        { value: 'todos', label: 'Todos os tipos' },
          { value: 'software', label: 'Software' },
          { value: 'servico', label: 'Serviço' },
          { value: 'certificacao', label: 'Certificação' },
          { value: 'outro', label: 'Outro' },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.licencas.title')}
        description={t('modules.licencas.description')}
      />

      {/* StatCards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total de Licenças"
          value={stats?.total ?? 0}
          description="Licenças registradas"
          icon={<FileCheck />}
          loading={statsLoading}
          drillDown="ativos_licencas"
          showAccent
          emptyHint="Cadastre licenças para acompanhar vencimentos."
        />

        <StatCard
          title="Licenças Ativas"
          value={stats?.ativas ?? 0}
          description="Em vigor"
          icon={<CheckCircle />}
          loading={statsLoading}
          variant="success"
        />

        <StatCard
          title="A Vencer"
          value={stats?.vencendo30dias ?? 0}
          description="Próximos 30 dias"
          icon={<Clock />}
          loading={statsLoading}
          variant="warning"
          drillDown="ativos_licencas"
        />

        <StatCard
          title="Vencidas"
          value={stats?.vencidas ?? 0}
          description="Expiradas"
          icon={<AlertTriangle />}
          loading={statsLoading}
          variant="destructive"
          drillDown="ativos_licencas"
        />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Licença
        </Button>
      </div>

      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            data={filteredAndSortedLicencas}
            columns={columns}
            loading={isLoading}
            searchable
            searchPlaceholder="Buscar licenças..."
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
                ['Nome', 'Tipo', 'Fornecedor', 'Vencimento', 'Valor Renovação', 'Criticidade', 'Status', 'Responsável'].join(','),
                ...filteredAndSortedLicencas.map(l => [
                  l.nome,
                  l.tipo_licenca,
                  l.fornecedor,
                  formatDateOnly(l.data_vencimento),
                  l.valor_renovacao?.toString() || '',
                  l.criticidade,
                  l.status,
                  l.responsavel_nome || ''
                ].join(','))
              ].join('\n');

              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `licencas-${new Date().toISOString().split('T')[0]}.csv`;
              link.click();
            }}
            emptyState={{
              icon: <FileCheck className="h-8 w-8" />,
              title: searchTerm ? "Nenhuma licença encontrada" : "Nenhuma licença cadastrada",
              description: searchTerm 
                ? "Tente ajustar os termos de busca ou limpe os filtros."
                : "Comece cadastrando as licenças de software da sua organização para monitorar renovações e custos.",
              action: !searchTerm ? {
                label: "Cadastrar Primeira Licença",
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

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title="Excluir Licença"
        description={`Tem certeza que deseja excluir a licença "${deleteConfirm.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}