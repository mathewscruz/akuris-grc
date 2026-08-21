import { useState, useEffect, useMemo } from 'react';
import { IconView, IconSuccess, IconWarning, IconTime, IconCalendar, IconShield, IconUserCheck } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DenunciaDialog } from './DenunciaDialog';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveDenunciaStatusTone, resolveCriticidadeTone } from '@/lib/status-tone';
import { useLanguage } from '@/contexts/LanguageContext';

import { severidadeDeFaixas } from '@/lib/metrics/riscos';
interface Denuncia {
  id: string;
  protocolo: string;
  titulo: string;
  descricao: string;
  status: string;
  gravidade: string;
  anonima: boolean;
  nome_denunciante?: string;
  email_denunciante?: string;
  created_at: string;
  categoria?: {
    nome: string;
    cor: string;
  };
  responsavel?: {
    nome: string;
  } | null;
}

interface DenunciasDashboardProps {
  itemIdToOpen?: string | null;
  refreshKey?: number | string;
}

export function DenunciasDashboard({ itemIdToOpen, refreshKey }: DenunciasDashboardProps) {
  const { t } = useLanguage();
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDenuncia, setSelectedDenuncia] = useState<Denuncia | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [gravidadeFilter, setGravidadeFilter] = useState('todos');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();
  const { empresaId } = useEmpresaId();

  useEffect(() => {
    if (empresaId) carregarDenuncias();
  }, [empresaId, refreshKey]);

  // Detectar se veio com itemIdToOpen
  useEffect(() => {
    if (itemIdToOpen && denuncias.length > 0) {
      const denuncia = denuncias.find(d => d.id === itemIdToOpen);
      if (denuncia) {
        setSelectedDenuncia(denuncia);
        setDialogOpen(true);
      }
    }
  }, [itemIdToOpen, denuncias]);

  const carregarDenuncias = async () => {
    if (!empresaId) return;
    try {
      const { data, error } = await supabase
        .from('denuncias')
        .select(`
          *,
          categoria:denuncias_categorias(nome, cor)
        `)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDenuncias(data || []);
    } catch (error) {
      console.error('Erro ao carregar denúncias:', error);
      toast({
        title: t('denunciasAdmin.dashboard.errorLoad'),
        description: t('denunciasAdmin.dashboard.errorLoad'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVisualizarDenuncia = (denuncia: Denuncia) => {
    setSelectedDenuncia(denuncia);
    setDialogOpen(true);
  };

  const handleDenunciaAtualizada = () => {
    carregarDenuncias();
  };

  // Filtrar e ordenar denúncias
  const filteredAndSortedDenuncias = useMemo(() => {
    let filtered = denuncias.filter(denuncia => {
      const matchesSearch = searchTerm === '' || 
        denuncia.protocolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        denuncia.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        denuncia.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        denuncia.nome_denunciante?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'todos' || denuncia.status === statusFilter;
      // Normaliza antes de comparar: registos antigos podem ainda trazer a
      // grafia feminina, e um filtro não pode depender disso.
      const matchesGravidade =
        gravidadeFilter === 'todos' || severidadeDeFaixas(denuncia.gravidade) === gravidadeFilter;

      return matchesSearch && matchesStatus && matchesGravidade;
    });

    // Ordenar
    filtered.sort((a, b) => {
      const aValue = a[sortField as keyof Denuncia];
      const bValue = b[sortField as keyof Denuncia];

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
  }, [denuncias, searchTerm, statusFilter, gravidadeFilter, sortField, sortDirection]);

  // Configuração das colunas
  const columns = [
    {
      key: 'protocolo',
      label: t('denunciasAdmin.dashboard.colProtocolo'),
      sortable: true,
      render: (_: any, denuncia: Denuncia) => (
        <span className="font-mono text-sm">{denuncia.protocolo}</span>
      )
    },
    {
      key: 'titulo',
      label: t('denunciasAdmin.dashboard.colTitulo'),
      sortable: true,
      render: (_: any, denuncia: Denuncia) => (
        <div className="max-w-xs truncate">{denuncia.titulo}</div>
      )
    },
    {
      key: 'status',
      label: t('denunciasAdmin.dashboard.colStatus'),
      sortable: true,
      render: (_: any, denuncia: Denuncia) => (
        <StatusBadge {...resolveDenunciaStatusTone(denuncia.status)}>
          {formatStatus(denuncia.status)}
        </StatusBadge>
      )
    },
    {
      key: 'gravidade',
      label: t('denunciasAdmin.dashboard.colGravidade'),
      sortable: true,
      render: (_: any, denuncia: Denuncia) => (
        <StatusBadge {...resolveCriticidadeTone(denuncia.gravidade)}>
          {formatStatus(denuncia.gravidade)}
        </StatusBadge>
      )
    },
    {
      key: 'categoria',
      label: t('denunciasAdmin.dashboard.colCategoria'),
      sortable: true,
      render: (_: any, denuncia: Denuncia) => (
        denuncia.categoria ? (
          <Badge variant="outline" style={{ borderColor: denuncia.categoria.cor }}>
            {denuncia.categoria.nome}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      )
    },
    {
      key: 'denunciante',
      label: t('denunciasAdmin.dashboard.colDenunciante'),
      sortable: true,
      render: (_: any, denuncia: Denuncia) => (
        denuncia.anonima ? (
          <Badge variant="secondary">{t('denunciasAdmin.dashboard.anonymousBadge')}</Badge>
        ) : (
          denuncia.nome_denunciante || t('denunciasAdmin.dashboard.notInformed')
        )
      )
    },
    {
      key: 'created_at',
      label: t('denunciasAdmin.dashboard.colData'),
      sortable: true,
      render: (_: any, denuncia: Denuncia) => (
        <div className="flex items-center gap-1">
          <IconCalendar className="h-4 w-4 text-muted-foreground" />
          {formatDateOnly(denuncia.created_at)}
        </div>
      )
    },
    {
      key: 'acoes',
      label: t('denunciasAdmin.dashboard.colAcoes'),
      render: (_: any, denuncia: Denuncia) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleVisualizarDenuncia(denuncia)}
        >
          <IconView className="h-4 w-4" />
        </Button>
      )
    }
  ];

  // Configuração dos filtros
  const filters = [
    {
      key: 'status',
      label: t('denunciasAdmin.dashboard.filterStatusLabel'),
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: 'todos', label: t('denunciasAdmin.dashboard.filterStatusAll') },
        { value: 'nova', label: t('denunciasAdmin.dashboard.statusNova') },
        { value: 'em_analise', label: t('denunciasAdmin.dashboard.statusEmAnalise') },
        { value: 'em_investigacao', label: t('denunciasAdmin.dashboard.statusEmInvestigacao') },
        { value: 'resolvida', label: t('denunciasAdmin.dashboard.statusResolvida') },
        { value: 'arquivada', label: t('denunciasAdmin.dashboard.statusArquivada') },
      ]
    },
    {
      key: 'gravidade',
      label: t('denunciasAdmin.dashboard.filterGravidadeLabel'),
      value: gravidadeFilter,
      onChange: setGravidadeFilter,
      options: [
        { value: 'todos', label: t('denunciasAdmin.dashboard.filterGravidadeAll') },
        { value: 'baixo', label: t('denunciasAdmin.dashboard.gravidadeBaixa') },
        { value: 'medio', label: t('denunciasAdmin.dashboard.gravidadeMedia') },
        { value: 'alto', label: t('denunciasAdmin.dashboard.gravidadeAlta') },
        { value: 'critico', label: t('denunciasAdmin.dashboard.gravidadeCritica') },
      ]
    }
  ];

  return (
    <>
      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            data={filteredAndSortedDenuncias}
            columns={columns}
            onRowClick={(denuncia) => handleVisualizarDenuncia(denuncia)}
            loading={loading}
            searchable
            searchPlaceholder={t('denunciasAdmin.dashboard.searchPlaceholder')}
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
            emptyState={{
              icon: <IconShield className="h-8 w-8" />,
              title: searchTerm ? t('denunciasAdmin.dashboard.emptyTitleSearch') : t('denunciasAdmin.dashboard.emptyTitle'),
              description: searchTerm 
                ? t('denunciasAdmin.dashboard.emptyDescriptionSearch')
                : t('denunciasAdmin.dashboard.emptyDescription'),
            }}
            onRefresh={carregarDenuncias}
          />
        </CardContent>
      </Card>

      {/* Dialog de detalhes */}
      {selectedDenuncia && (
        <DenunciaDialog
          denuncia={selectedDenuncia}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onDenunciaAtualizada={handleDenunciaAtualizada}
        />
      )}
    </>
  );
}