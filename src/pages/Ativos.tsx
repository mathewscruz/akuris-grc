import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIntegrationNotify } from '@/hooks/useIntegrationNotify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Server, Activity, AlertTriangle, TrendingUp, Upload, Shield, CloudCog, MoreHorizontal, Edit, Trash2, Wrench, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatStrip } from '@/components/ui/stat-strip';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAtivosStats } from '@/hooks/useAtivosStats';
import ImportacaoAtivos from '@/components/ativos/ImportacaoAtivos';
import AtivoDialog from '@/components/ativos/AtivoDialog';
import ManutencaoDialog from '@/components/ativos/ManutencaoDialog';
import TrilhaAuditoriaAtivos from '@/components/ativos/TrilhaAuditoriaAtivos';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveCriticidadeTone, resolveItemStatusTone } from '@/lib/status-tone';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Ativo {
  id: string;
  nome: string;
  tipo: string;
  descricao: string | null;
  proprietario: string | null;
  proprietario_nome?: string | null;
  proprietario_avatar?: string | null;
  localizacao: string | null;
  valor_negocio: string | null;
  criticidade: string;
  status: string;
  data_aquisicao: string | null;
  fornecedor: string | null;
  versao: string | null;
  tags: string[] | null;
  imei: string | null;
  cliente: string | null;
  quantidade: number | null;
  created_at: string;
}

const tiposAtivo = [
  { value: 'servidor', label: 'fin.ativos.tipos.servidor' },
  { value: 'aplicacao', label: 'fin.ativos.tipos.aplicacao' },
  { value: 'banco_dados', label: 'fin.ativos.tipos.banco_dados' },
  { value: 'rede', label: 'fin.ativos.tipos.rede' },
  { value: 'endpoint', label: 'fin.ativos.tipos.endpoint' },
  { value: 'dispositivo_movel', label: 'fin.ativos.tipos.dispositivo_movel' },
  { value: 'armazenamento', label: 'fin.ativos.tipos.armazenamento' },
  { value: 'software', label: 'fin.ativos.tipos.software' },
  { value: 'hardware', label: 'fin.ativos.tipos.hardware' },
  { value: 'almoxarifado_equipamento', label: 'fin.ativos.tipos.almoxarifado_equipamento' },
  { value: 'almoxarifado_ferramenta', label: 'fin.ativos.tipos.almoxarifado_ferramenta' },
  { value: 'almoxarifado_material', label: 'fin.ativos.tipos.almoxarifado_material' },
  { value: 'almoxarifado_epi', label: 'fin.ativos.tipos.almoxarifado_epi' },
  { value: 'mobiliario', label: 'fin.ativos.tipos.mobiliario' },
  { value: 'equipamento_escritorio', label: 'fin.ativos.tipos.equipamento_escritorio' },
  { value: 'equipamento_comunicacao', label: 'fin.ativos.tipos.equipamento_comunicacao' },
  { value: 'material_escritorio', label: 'fin.ativos.tipos.material_escritorio' },
  { value: 'veiculo_terrestre', label: 'fin.ativos.tipos.veiculo_terrestre' },
  { value: 'veiculo_aereo', label: 'fin.ativos.tipos.veiculo_aereo' },
  { value: 'maquina_pesada', label: 'fin.ativos.tipos.maquina_pesada' },
  { value: 'equipamento_transporte', label: 'fin.ativos.tipos.equipamento_transporte' },
  { value: 'imovel', label: 'fin.ativos.tipos.imovel' },
  { value: 'estrutura_fisica', label: 'fin.ativos.tipos.estrutura_fisica' },
  { value: 'instalacao_eletrica', label: 'fin.ativos.tipos.instalacao_eletrica' },
  { value: 'instalacao_hidraulica', label: 'fin.ativos.tipos.instalacao_hidraulica' },
  { value: 'equipamento_seguranca', label: 'fin.ativos.tipos.equipamento_seguranca' },
  { value: 'sistema_monitoramento', label: 'fin.ativos.tipos.sistema_monitoramento' },
  { value: 'controle_acesso', label: 'fin.ativos.tipos.controle_acesso' },
  { value: 'equipamento_bombeiro', label: 'fin.ativos.tipos.equipamento_bombeiro' },
  { value: 'maquina_producao', label: 'fin.ativos.tipos.maquina_producao' },
  { value: 'ferramenta_producao', label: 'fin.ativos.tipos.ferramenta_producao' },
  { value: 'equipamento_medicao', label: 'fin.ativos.tipos.equipamento_medicao' },
  { value: 'equipamento_teste', label: 'fin.ativos.tipos.equipamento_teste' },
  { value: 'equipamento_medico', label: 'fin.ativos.tipos.equipamento_medico' },
  { value: 'equipamento_laboratorio', label: 'fin.ativos.tipos.equipamento_laboratorio' },
  { value: 'outros', label: 'fin.ativos.tipos.outros' }
];

const criticidades = [
  { value: 'critico', label: 'fin.ativos.criticidade.critico', color: 'destructive' },
  { value: 'alto', label: 'fin.ativos.criticidade.alto', color: 'warning' },
  { value: 'medio', label: 'fin.ativos.criticidade.medio', color: 'default' },
  { value: 'baixo', label: 'fin.ativos.criticidade.baixo', color: 'secondary' },
];

const statusOptions = [
  { value: 'ativo', label: 'fin.ativos.status.ativo', color: 'success' },
  { value: 'inativo', label: 'fin.ativos.status.inativo', color: 'secondary' },
  { value: 'em_manutencao', label: 'fin.ativos.status.em_manutencao', color: 'warning' },
  { value: 'descontinuado', label: 'fin.ativos.status.descontinuado', color: 'destructive' },
];

const valoresNegocio = ['alto', 'medio', 'baixo'];

const initialFormData = {
  nome: '',
  tipo: '',
  descricao: '',
  proprietario: '',
  localizacao: '',
  valor_negocio: '',
  criticidade: 'medio',
  status: 'ativo',
  data_aquisicao: '',
  fornecedor: '',
  versao: '',
  tags: '',
  imei: '',
  cliente: '',
  quantidade: 1,
};

const Ativos = () => {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useAtivosStats();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const [statusFilter, setStatusFilter] = useState('todos');
  const [criticidadeFilter, setCriticidadeFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [valorNegocioFilter, setValorNegocioFilter] = useState('todos');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [azureSyncing, setAzureSyncing] = useState(false);
  const [editingAtivo, setEditingAtivo] = useState<Ativo | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; ativoId: string }>({ open: false, ativoId: '' });
  const [formData, setFormData] = useState(initialFormData);

  // Manutenção & Auditoria dialogs
  const [manutencaoDialog, setManutencaoDialog] = useState<{ open: boolean; ativoId: string; ativoNome: string }>({ open: false, ativoId: '', ativoNome: '' });
  const [trilhaDialog, setTrilhaDialog] = useState<{ open: boolean; ativoId?: string }>({ open: false });
  const [searchParams, setSearchParams] = useSearchParams();

  // Fetch ativos with React Query
  const { data: ativos = [], isLoading: loading } = useQuery<Ativo[]>({
    queryKey: ['ativos', profile?.empresa_id],
    queryFn: async (): Promise<Ativo[]> => {
      const { data, error } = await supabase
        .from('ativos')
        .select('*')
        .eq('empresa_id', profile!.empresa_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        const proprietarioIds = data.map(a => a.proprietario).filter(p => p && p.trim() !== '');
        
        if (proprietarioIds.length > 0) {
          const { data: profiles } = await supabase
            .rpc('get_profiles_by_text_ids', { text_ids: proprietarioIds });

          if (profiles) {
            const profileMap = new Map(
              profiles.map((p: any) => [p.user_id.toString(), { nome: p.nome, foto_url: p.foto_url }])
            );
            return data.map(ativo => {
              const profileData = (ativo.proprietario && ativo.proprietario.trim() !== '') 
                ? profileMap.get(ativo.proprietario) : null;
              return { ...ativo, proprietario_nome: profileData?.nome || null, proprietario_avatar: profileData?.foto_url || null } as Ativo;
            });
          }
        }
      }
      return (data || []) as Ativo[];
    },
    enabled: !!profile?.empresa_id,
  });

  // Azure integration
  const { data: azureIntegration } = useQuery({
    queryKey: ['azure-integration', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return null;
      // @ts-ignore
      const result = await supabase
        .from('integracoes_config')
        .select('id, configuracoes')
        .eq('empresa_id', profile.empresa_id)
        .eq('tipo_integracao', 'azure')
        .eq('ativo', true)
        .limit(1);
      return result.data?.[0] || null;
    },
    enabled: !!profile?.empresa_id,
  });

  const invalidateAtivos = () => queryClient.invalidateQueries({ queryKey: ['ativos'] });

  const handleAzureSync = async () => {
    if (!azureIntegration || !profile?.empresa_id) return;
    setAzureSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('azure-integration', {
        body: { action: 'sync', empresa_id: profile.empresa_id, config: azureIntegration.configuracoes }
      });
      if (error) throw error;
      toast({ title: t('fin.ativos.syncOk'), description: `${data.synced_count || 0} dispositivos sincronizados do Azure/Intune` });
      invalidateAtivos();
    } catch (error: any) {
      logger.error('Azure sync error', { error: error?.message });
      toast({ title: t('fin.ativos.syncErro'), description: error.message || t('fin.ativos.syncFalha'), variant: "destructive" });
    } finally {
      setAzureSyncing(false);
    }
  };

  const { notify } = useIntegrationNotify();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id) {
      toast({ title: t('fin.comum.erro'), description: t('fin.comum.usuarioSemEmpresa'), variant: "destructive" });
      return;
    }
    try {
      const ativoData = {
        ...formData,
        empresa_id: profile.empresa_id,
        proprietario: formData.proprietario || null,
        localizacao: formData.localizacao || null,
        data_aquisicao: formData.data_aquisicao || null,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : null,
      };
      if (editingAtivo) {
        const { error } = await supabase.from('ativos').update(ativoData).eq('id', editingAtivo.id);
        if (error) throw error;
        toast({ title: t('fin.comum.sucesso'), description: t('fin.ativos.atualizado') });
        notify('ativo_atualizado', {
          titulo: t('sweepCore.assets.updatedNotification', { name: formData.nome }),
          descricao: formData.descricao,
          link: `${window.location.origin}/ativos`,
          dados: { tipo: formData.tipo, criticidade: formData.criticidade },
        });
      } else {
        const { error } = await supabase.from('ativos').insert(ativoData);
        if (error) throw error;
        toast({ title: t('fin.comum.sucesso'), description: t('fin.ativos.criado') });
        notify('ativo_criado', {
          titulo: t('sweepCore.assets.createdNotification', { name: formData.nome }),
          descricao: formData.descricao,
          link: `${window.location.origin}/ativos`,
          dados: { tipo: formData.tipo, criticidade: formData.criticidade },
          gravidade: formData.criticidade === 'critico' ? 'critica' : formData.criticidade === 'alto' ? 'alta' : 'media',
        });
      }
      setIsDialogOpen(false);
      setEditingAtivo(null);
      setFormData(initialFormData);
      invalidateAtivos();
    } catch (error: any) {
      logger.error('Error saving ativo', { error: error?.message });
      toast({ title: t('fin.comum.erro'), description: error.message || t('fin.ativos.erroSalvar'), variant: "destructive" });
    }
  };

  const handleEdit = (ativo: Ativo) => {
    setEditingAtivo(ativo);
    setFormData({
      nome: ativo.nome,
      tipo: ativo.tipo,
      descricao: ativo.descricao || '',
      proprietario: ativo.proprietario || '',
      localizacao: ativo.localizacao || '',
      valor_negocio: ativo.valor_negocio || '',
      criticidade: ativo.criticidade,
      status: ativo.status,
      data_aquisicao: ativo.data_aquisicao || '',
      fornecedor: ativo.fornecedor || '',
      versao: ativo.versao || '',
      tags: ativo.tags ? ativo.tags.join(', ') : '',
      imei: ativo.imei || '',
      cliente: ativo.cliente || '',
      quantidade: ativo.quantidade || 1,
    });
    setIsDialogOpen(true);
  };

  // Deep link vindo da busca global (Cmd+K): abre o registo focado para edição/visualização.
  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId || ativos.length === 0) return;
    const ativo = ativos.find((a) => a.id === focusId);
    if (ativo) {
      handleEdit(ativo);
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, ativos]);

  const confirmDelete = async () => {
    try {
      const { error } = await supabase.from('ativos').delete().eq('id', deleteConfirm.ativoId);
      if (error) throw error;
      toast({ title: t('fin.comum.sucesso'), description: t('fin.ativos.excluido') });
      invalidateAtivos();
    } catch (error: any) {
      logger.error('Error deleting ativo', { error: error?.message });
      toast({ title: t('fin.comum.erro'), description: error.message || t('fin.ativos.erroExcluir'), variant: "destructive" });
    }
  };

  const getTipoLabel = (value: string) => { const o = tiposAtivo.find(x => x.value === value); return o ? t(o.label) : value; };

  const filteredAndSortedAtivos = useMemo(() => {
    let filtered = ativos.filter(ativo => {
      const matchesSearch = searchTerm === '' || 
        ativo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ativo.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ativo.proprietario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ativo.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ativo.imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ativo.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'todos' || ativo.status === statusFilter;
      const matchesCriticidade = criticidadeFilter === 'todos' || ativo.criticidade === criticidadeFilter;
      const matchesTipo = tipoFilter === 'todos' || ativo.tipo === tipoFilter;
      const matchesValorNegocio = valorNegocioFilter === 'todos' || ativo.valor_negocio === valorNegocioFilter;
      return matchesSearch && matchesStatus && matchesCriticidade && matchesTipo && matchesValorNegocio;
    });

    filtered.sort((a, b) => {
      const aValue = a[sortField as keyof Ativo];
      const bValue = b[sortField as keyof Ativo];
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if ((aValue ?? '') < (bValue ?? '')) return sortDirection === 'asc' ? -1 : 1;
      if ((aValue ?? '') > (bValue ?? '')) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [ativos, searchTerm, statusFilter, criticidadeFilter, tipoFilter, valorNegocioFilter, sortField, sortDirection]);

  const exportData = () => {
    const csvContent = [
      [t('fin.comum.nome'), t('fin.comum.tipo'), t('fin.comum.status'), t('fin.comum.criticidade'), t('fin.comum.proprietario'), t('fin.comum.localizacao'), t('fin.ativos.dataAquisicao')].join(','),
      ...filteredAndSortedAtivos.map(ativo => [
        ativo.nome,
        getTipoLabel(ativo.tipo),
        (() => { const o = statusOptions.find(s => s.value === ativo.status); return o ? t(o.label) : ativo.status; })(),
        (() => { const o = criticidades.find(c => c.value === ativo.criticidade); return o ? t(o.label) : ativo.criticidade; })(),
        ativo.proprietario_nome || '',
        ativo.localizacao || '',
        ativo.data_aquisicao ? formatDateOnly(ativo.data_aquisicao) : ''
      ].join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `ativos-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: Column<Ativo>[] = [
    {
      key: 'nome',
      label: t('fin.comum.nome'),
      sortable: true,
      render: (_: any, ativo: Ativo) => <span className="font-medium">{ativo.nome}</span>
    },
    {
      key: 'tipo',
      label: t('fin.comum.tipo'),
      sortable: true,
      render: (_: any, ativo: Ativo) => getTipoLabel(ativo.tipo)
    },
    {
      key: 'criticidade',
      label: t('fin.comum.criticidade'),
      sortable: true,
      render: (_: any, ativo: Ativo) => (
        <StatusBadge size="sm" {...resolveCriticidadeTone(ativo.criticidade)}>
          {(() => { const o = criticidades.find(c => c.value === ativo.criticidade); return o ? t(o.label) : ativo.criticidade; })()}
        </StatusBadge>
      )
    },
    {
      key: 'status',
      label: t('fin.comum.status'),
      sortable: true,
      render: (_: any, ativo: Ativo) => (
        <StatusBadge size="sm" {...resolveItemStatusTone(ativo.status)}>
          {formatStatus(ativo.status)}
        </StatusBadge>
      )
    },
    {
      key: 'proprietario',
      label: t('fin.comum.proprietario'),
      render: (_: any, ativo: Ativo) => {
        if (!ativo.proprietario_nome) return '-';
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer">
                  {ativo.proprietario_avatar && <AvatarImage src={ativo.proprietario_avatar} alt={ativo.proprietario_nome} />}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {ativo.proprietario_nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent><p>{ativo.proprietario_nome}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
    },
    {
      key: 'localizacao',
      label: t('fin.comum.localizacao'),
      sortable: true,
      render: (_: any, ativo: Ativo) => ativo.localizacao || '-'
    },
    {
      key: 'acoes',
      label: t('fin.comum.acoes'),
      render: (_: any, ativo: Ativo) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={() => handleEdit(ativo)}>
              <Edit className="h-4 w-4 mr-2" />
               {t('sweepCore.assets.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setManutencaoDialog({ open: true, ativoId: ativo.id, ativoNome: ativo.nome })}>
              <Wrench className="h-4 w-4 mr-2" />
               {t('sweepCore.assets.maintenance')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTrilhaDialog({ open: true, ativoId: ativo.id })}>
              <History className="h-4 w-4 mr-2" />
               {t('sweepCore.assets.auditTrail')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteConfirm({ open: true, ativoId: ativo.id })}
            >
              <Trash2 className="h-4 w-4 mr-2" />
               {t('sweepCore.assets.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const filters = [
    {
      key: 'status', label: t('fin.comum.status'), value: statusFilter, onChange: setStatusFilter,
      options: [{ value: 'todos', label: t('fin.comum.todosStatus') }, ...statusOptions.map(s => ({ value: s.value, label: t(s.label) }))]
    },
    {
      key: 'criticidade', label: t('fin.comum.criticidade'), value: criticidadeFilter, onChange: setCriticidadeFilter,
      options: [{ value: 'todos', label: t('fin.comum.todasF') }, ...criticidades.map(c => ({ value: c.value, label: t(c.label) }))]
    },
    {
      key: 'tipo', label: t('fin.comum.tipo'), value: tipoFilter, onChange: setTipoFilter,
      options: [{ value: 'todos', label: t('fin.comum.todosTipos') }, ...tiposAtivo.map(x => ({ value: x.value, label: t(x.label) }))]
    },
    {
      key: 'valor_negocio', label: t('fin.ativos.valorNegocio'), value: valorNegocioFilter, onChange: setValorNegocioFilter,
       options: [{ value: 'todos', label: t('sweepCore.assets.all') }, ...valoresNegocio.map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))]
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.ativos.title')}
        description={t('modules.ativos.description')}
        actions={
          <Button size="sm" onClick={() => {
            setEditingAtivo(null);
            setFormData(initialFormData);
            setIsDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            {t('sweepCore.assets.newAsset')}
          </Button>
        }
        secondaryActions={[
          ...(azureIntegration ? [{
            label: 'Azure Sync',
            icon: azureSyncing ? <AkurisPulse size={16} /> : <CloudCog className="h-4 w-4" />,
            onClick: handleAzureSync,
            disabled: azureSyncing,
          }] : []),
          {
            label: t('sweepCore.assets.import'),
            icon: <Upload className="h-4 w-4" />,
            onClick: () => setImportDialog(true),
          },
          {
            label: t('modules.ativos.auditTrail'),
            icon: <History className="h-4 w-4" />,
            onClick: () => setTrilhaDialog({ open: true }),
          },
        ]}
      />

      <AtivoDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        isEditing={!!editingAtivo}
      />

      {/* Indicadores */}
      <StatStrip
        loading={statsLoading}
        items={[
          { key: 'total', label: t('modules.ativos.total'), value: stats?.total || 0, drillDown: 'ativos' },
          { key: 'ativos', label: t('cardsKpi.sweep.ativos.ativos'), value: stats?.ativos || 0, drillDown: 'ativos' },
          { key: 'altoValor', label: t('cardsKpi.sweep.ativos.altoValor'), value: stats?.altoValorNegocio || 0, drillDown: 'ativos' },
          { key: 'criticidadeAlta', label: t('cardsKpi.sweep.ativos.criticidadeAlta'), value: (stats?.criticos || 0) + (stats?.altos || 0), tone: 'destructive', drillDown: 'ativos' },
        ]}
      />

      {/* DataTable */}
      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            data={filteredAndSortedAtivos}
            columns={columns}
            loading={loading}
            searchable
            searchPlaceholder={t('fin.ativos.buscar')}
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
            onExport={exportData}
            emptyState={{
              icon: <Server className="h-8 w-8" />,
              title: searchTerm ? t('fin.ativos.nenhumEncontrado') : t('fin.ativos.nenhumCadastrado'),
              description: searchTerm 
                ? "Tente ajustar os termos de busca ou limpe os filtros."
                : t('fin.ativos.vazioDesc'),
              action: !searchTerm ? {
                label: "Cadastrar Primeiro Ativo",
                onClick: () => setIsDialogOpen(true)
              } : undefined
            }}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        onConfirm={confirmDelete}
        title={t('fin.ativos.excluirTitle')}
        description={t('fin.ativos.excluirDesc')}
      />

      <ImportacaoAtivos
        open={importDialog}
        onOpenChange={setImportDialog}
        onSuccess={invalidateAtivos}
      />

      <ManutencaoDialog
        ativoId={manutencaoDialog.ativoId}
        ativoNome={manutencaoDialog.ativoNome}
        open={manutencaoDialog.open}
        onOpenChange={(open) => setManutencaoDialog(prev => ({ ...prev, open }))}
      />

      <TrilhaAuditoriaAtivos
        ativoId={trilhaDialog.ativoId}
        open={trilhaDialog.open}
        onOpenChange={(open) => setTrilhaDialog(prev => ({ ...prev, open }))}
      />
    </div>
  );
};

export default Ativos;
