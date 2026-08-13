import React, { useState, useMemo } from 'react';
import { Plus, Server, Shield, Lock, Monitor, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable } from '@/components/ui/data-table';
import ConfirmDialog from '@/components/ConfirmDialog';
import SistemaDialog from '@/components/contas-privilegiadas/SistemaDialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { formatStatus, capitalizeText } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveCriticidadeTone } from '@/lib/status-tone';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from '@/contexts/LanguageContext';

interface SistemaPrivilegiado {
  id: string;
  nome_sistema: string;
  tipo_sistema: string;
  criticidade: string;
  responsavel_sistema?: string;
  url_sistema?: string;
  categoria?: string;
  ativo: boolean;
  icone?: string;
  imagem_url?: string;
}

export default function SistemasContent() {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const [showSistemaDialog, setShowSistemaDialog] = useState(false);
  const [selectedSistema, setSelectedSistema] = useState<SistemaPrivilegiado | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [criticidadeFilter, setCriticidadeFilter] = useState('todos');
  const [sortField, setSortField] = useState('nome_sistema');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string;
    nome: string;
  }>({ open: false, id: '', nome: '' });
  const { toast } = useToast();

  const { data: sistemas = [], refetch: refetchSistemas, isLoading } = useQuery({
    queryKey: ['sistemas-privilegiados-governanca', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sistemas_privilegiados' as any)
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome_sistema');

      if (error) throw error;
      return (data || []) as unknown as SistemaPrivilegiado[];
    },
    enabled: !!empresaId,
  });

  const sistemasAtivos = sistemas.filter(s => s.ativo).length;
  const sistemasCriticos = sistemas.filter(s => ['critica', 'critico', 'alta'].includes(s.criticidade)).length;

  const handleEditSistema = (sistema: SistemaPrivilegiado) => {
    setSelectedSistema(sistema);
    setShowSistemaDialog(true);
  };

  const handleCloseSistemaDialog = () => {
    setSelectedSistema(null);
    setShowSistemaDialog(false);
    refetchSistemas();
  };

  const handleDeleteSistema = async (sistemaId: string, sistemaNome: string) => {
    const { data: contasVinculadas } = await supabase
      .from('contas_privilegiadas' as any)
      .select('id')
      .eq('sistema_id', sistemaId)
      .eq('empresa_id', empresaId);

    if (contasVinculadas && contasVinculadas.length > 0) {
      toast({
        title: t("governancaComp.sistemas.toastNaoPossivelExcluirTitle"),
        description: t("governancaComp.sistemas.toastNaoPossivelExcluirDesc", { nome: sistemaNome, count: contasVinculadas.length }),
        variant: "destructive",
      });
      return;
    }

    setDeleteConfirm({ open: true, id: sistemaId, nome: sistemaNome });
  };

  const confirmDelete = async () => {
    const { error } = await supabase
      .from('sistemas_privilegiados' as any)
      .delete()
      .eq('id', deleteConfirm.id);

    if (error) {
      toast({
        title: t("governancaComp.sistemas.toastErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("governancaComp.sistemas.toastDeletedTitle"),
      description: t("governancaComp.sistemas.toastDeletedDesc"),
    });
    refetchSistemas();
    setDeleteConfirm({ open: false, id: '', nome: '' });
  };

  const getCriticidadeBadge = (criticidade: string) => {
    return (
      <StatusBadge size="sm" {...resolveCriticidadeTone(criticidade)}>
        {formatStatus(criticidade)}
      </StatusBadge>
    );
  };

  const filteredAndSortedSistemas = useMemo(() => {
    let filtered = sistemas.filter(sistema => {
      const matchesSearch = searchTerm === '' || 
        sistema.nome_sistema.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sistema.tipo_sistema.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sistema.responsavel_sistema?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'todos' || (sistema.ativo ? 'ativo' : 'inativo') === statusFilter;
      const matchesTipo = tipoFilter === 'todos' || sistema.tipo_sistema === tipoFilter;
      const matchesCriticidade = criticidadeFilter === 'todos' || sistema.criticidade === criticidadeFilter;

      return matchesSearch && matchesStatus && matchesTipo && matchesCriticidade;
    });

    filtered.sort((a, b) => {
      const aValue = a[sortField as keyof SistemaPrivilegiado];
      const bValue = b[sortField as keyof SistemaPrivilegiado];

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
  }, [sistemas, searchTerm, statusFilter, tipoFilter, criticidadeFilter, sortField, sortDirection]);

  const sistemasColumns = [
    {
      key: 'nome_sistema',
      label: t("governancaComp.sistemas.columnSistema"),
      sortable: true,
      render: (_: any, sistema: SistemaPrivilegiado) => (
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 overflow-hidden">
            {sistema.imagem_url ? (
              <img 
                src={sistema.imagem_url} 
                alt={sistema.nome_sistema}
                className="w-full h-full object-contain"
              />
            ) : (
              <Server className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="font-medium">{sistema.nome_sistema}</div>
        </div>
      )
    },
    {
      key: 'tipo_sistema',
      label: t("governancaComp.sistemas.columnTipo"),
      sortable: true,
      render: (_: any, sistema: SistemaPrivilegiado) => (
        <Badge variant="outline">{capitalizeText(sistema.tipo_sistema)}</Badge>
      )
    },
    {
      key: 'criticidade',
      label: t("governancaComp.sistemas.columnCriticidade"),
      sortable: true,
      render: (_: any, sistema: SistemaPrivilegiado) => getCriticidadeBadge(sistema.criticidade)
    },
    {
      key: 'categoria',
      label: t("governancaComp.sistemas.columnCategoria"),
      sortable: true,
      render: (_: any, sistema: SistemaPrivilegiado) => sistema.categoria ? capitalizeText(sistema.categoria.replace('_', ' ')) : '-'
    },
    {
      key: 'ativo',
      label: t("governancaComp.sistemas.columnStatus"),
      sortable: true,
      render: (_: any, sistema: SistemaPrivilegiado) => (
        <Badge variant={sistema.ativo ? "default" : "secondary"} className="whitespace-nowrap">
          {sistema.ativo ? t("governancaComp.sistemas.statusAtivo") : t("governancaComp.sistemas.statusInativo")}
        </Badge>
      )
    },
    {
      key: 'url_sistema',
      label: t("governancaComp.sistemas.columnUrl"),
      render: (_: any, sistema: SistemaPrivilegiado) => (
        sistema.url_sistema ? (
          <a 
            href={sistema.url_sistema} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {t("governancaComp.sistemas.linkAcessar")}
          </a>
        ) : '-'
      )
    },
    {
      key: 'acoes',
      label: t("governancaComp.sistemas.columnAcoes"),
      render: (_: any, sistema: SistemaPrivilegiado) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEditSistema(sistema)}>
              <Edit className="h-4 w-4 mr-2" />
              {t("governancaComp.sistemas.buttonEditar")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeleteSistema(sistema.id, sistema.nome_sistema)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("governancaComp.sistemas.buttonExcluir")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const sistemasFilters = [
    {
      key: 'status',
      label: t("governancaComp.sistemas.filterStatus"),
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: 'todos', label: t("governancaComp.sistemas.filterAll") },
        { value: 'ativo', label: t("governancaComp.sistemas.statusAtivo") },
        { value: 'inativo', label: t("governancaComp.sistemas.statusInativo") },
      ]
    },
    {
      key: 'tipo',
      label: t("governancaComp.sistemas.filterTipo"),
      value: tipoFilter,
      onChange: setTipoFilter,
      options: [
        { value: 'todos', label: t("governancaComp.sistemas.filterAll") },
        { value: 'aplicacao', label: t("governancaComp.sistemas.tipoAplicacao") },
        { value: 'banco_dados', label: t("governancaComp.sistemas.tipoBancoDados") },
        { value: 'sistema_operacional', label: t("governancaComp.sistemas.tipoSistemaOperacional") },
        { value: 'rede', label: t("governancaComp.sistemas.tipoRede") },
        { value: 'nuvem', label: t("governancaComp.sistemas.tipoNuvem") },
        { value: 'erp', label: t("governancaComp.sistemas.tipoErp") },
        { value: 'crm', label: t("governancaComp.sistemas.tipoCrm") },
        { value: 'bi', label: t("governancaComp.sistemas.tipoBi") },
        { value: 'seguranca', label: t("governancaComp.sistemas.tipoSeguranca") },
        { value: 'outro', label: t("governancaComp.sistemas.tipoOutro") },
      ]
    },
    {
      key: 'criticidade',
      label: t("governancaComp.sistemas.filterCriticidade"),
      value: criticidadeFilter,
      onChange: setCriticidadeFilter,
      options: [
        { value: 'todos', label: t("governancaComp.sistemas.filterCriticidadeAllFem") },
        { value: 'critica', label: t("governancaComp.sistemas.criticidadeCritica") },
        { value: 'alta', label: t("governancaComp.sistemas.criticidadeAlta") },
        { value: 'media', label: t("governancaComp.sistemas.criticidadeMedia") },
        { value: 'baixa', label: t("governancaComp.sistemas.criticidadeBaixa") },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("governancaComp.sistemas.statTotal")}
          value={sistemas.length}
          icon={<Server />}
          variant="primary"
          showAccent
          emptyHint={t("governancaComp.sistemas.statTotalEmptyHint")}
          segments={[
            { label: t("governancaComp.sistemas.segmentAtivos"), value: sistemasAtivos, tone: 'success' },
            { label: t("governancaComp.sistemas.segmentInativos"), value: Math.max(0, sistemas.length - sistemasAtivos), tone: 'neutral' },
          ]}
        />
        <StatCard
          title={t("governancaComp.sistemas.statAtivos")}
          value={sistemasAtivos}
          icon={<Monitor />}
          variant="success"
        />
        <StatCard
          title={t("governancaComp.sistemas.statCriticidadeAlta")}
          value={sistemasCriticos}
          icon={<Shield />}
          variant="warning"
        />
        <StatCard
          title={t("governancaComp.sistemas.statInativos")}
          value={sistemas.length - sistemasAtivos}
          icon={<Lock />}
          variant="default"
        />
      </div>

      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <div className="p-6 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-lg font-semibold">{t("governancaComp.sistemas.title")}</h3>
            <Button onClick={() => setShowSistemaDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("governancaComp.sistemas.buttonNovo")}
            </Button>
          </div>
          
          <DataTable
            data={filteredAndSortedSistemas}
            columns={sistemasColumns}
            searchPlaceholder={t("governancaComp.sistemas.searchPlaceholder")}
            filters={sistemasFilters}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={(field) => {
              if (field === sortField) {
                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
              } else {
                setSortField(field);
                setSortDirection('asc');
              }
            }}
            emptyState={{
              title: t("governancaComp.sistemas.emptyTitle"),
              description: t("governancaComp.sistemas.emptyDescription"),
              icon: <Server className="h-12 w-12" />,
            }}
            loading={isLoading}
          />
        </CardContent>
      </Card>

      <SistemaDialog
        open={showSistemaDialog}
        onClose={handleCloseSistemaDialog}
        sistema={selectedSistema}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title={t("governancaComp.sistemas.deleteTitle")}
        description={t("governancaComp.sistemas.deleteDescription", { nome: deleteConfirm.nome })}
        confirmText={t("governancaComp.sistemas.deleteConfirm")}
        cancelText={t("governancaComp.sistemas.deleteCancel")}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
