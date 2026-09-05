import { loadPrivilegedAccounts } from '@/lib/queries/privileged-accounts';
import { privilegedAccountStatus } from '@/lib/privileged-review';
import { readAllPages } from '@/lib/read-all-pages';
import { useNavigate } from 'react-router-dom';
import { useListState } from '@/hooks/useListState';
import React, { useState, useMemo, useEffect } from 'react';
import { useFocusRow } from '@/hooks/useFocusRow';
import { IconAdd, IconEdit, IconDelete, IconDownload, IconMore, IconSuccess, IconWarning, IconTime, IconShield } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ContaDialog from '@/components/contas-privilegiadas/ContaDialog';
import { Card, CardContent } from '@/components/ui/card';
import { StatStrip } from '@/components/ui/stat-strip';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDateOnly, formatarDiaParaDB } from '@/lib/date-utils';
import { capitalizeText } from '@/lib/text-utils';
import { resolveItemStatusTone } from '@/lib/status-tone';
import { RecordDetailDrawer } from '@/components/common/RecordDetailDrawer';
import { exportCSV } from '@/lib/csv-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from '@/contexts/LanguageContext';

type ContaPrivilegiada = Awaited<ReturnType<typeof loadPrivilegedAccounts>>[number];

export default function ContasPrivilegiadas() {
  /*
    O `?focus=<id>` que a busca global, o `EntidadeSelect` e o sino já
    emitiam para aqui não tinha do lado de cá quem o lesse: a página abria a
    lista inteira e o registo procurado ficava por encontrar à mão. O
    `DataTable` já marca cada linha com `data-focus-id`; faltava só chamar o
    gancho que a procura e a destaca.
  */
  useFocusRow();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [showContaDialog, setShowContaDialog] = useState(false);
  const [selectedConta, setSelectedConta] = useState<ContaPrivilegiada | null>(null);
  const [detalheConta, setDetalheConta] = useState<ContaPrivilegiada | null>(null);
  const [searchTerm, setSearchTerm] = useListState('searchTerm', '');
  const [statusFilter, setStatusFilter] = useListState('statusFilter', 'todos');
  const [nivelFilter, setNivelFilter] = useListState('nivelFilter', 'todos');
  const [sortField, setSortField] = useListState('sortField', 'usuario_beneficiario');
  const [sortDirection, setSortDirection] = useListState<'asc' | 'desc'>('sortDirection', 'asc');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string;
    nome: string;
  }>({ open: false, id: '', nome: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaId();

  // Buscar contas privilegiadas
  const { data: contas = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['contas-privilegiadas', empresaId],
    queryFn: ({ signal }) => loadPrivilegedAccounts(empresaId!, signal),
    enabled: !!empresaId,
  });

  // Buscar sistemas para o dropdown no dialog
  const { data: sistemas = [], isError: systemsError, refetch: retrySystems } = useQuery({
    queryKey: ['sistemas-privilegiados', empresaId],
    queryFn: async ({ signal }) => {
      const { data, error } = await readAllPages<any>((from, to) => supabase
        .from('sistemas_privilegiados' as any)
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('nome_sistema').order('id').range(from, to).abortSignal(signal), signal);

      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  useEffect(() => { setDetalheConta(null); setSelectedConta(null); setShowContaDialog(false); }, [empresaId]);

  // Calcular métricas do dashboard
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em30Dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Uma conta está expirada se o status é 'expirado' OU se a data de expiração já passou
  // (o status armazenado não é atualizado automaticamente quando a data vence)
  const displayStatus = (c: ContaPrivilegiada) => privilegedAccountStatus(c, formatarDiaParaDB(hoje));
  const isExpirada = (c: ContaPrivilegiada) => displayStatus(c) === 'expirado';

  const contasExpiradas = contas.filter(isExpirada).length;
  const contasAtivas = contas.filter(c => c.status === 'ativo' && !isExpirada(c)).length;
  const contasPendentes = contas.filter(c => c.status === 'pendente_aprovacao').length;

  // Contas que vencem nos próximos 30 dias (ainda não vencidas)
  const contasVencendo = contas.filter(c => {
    const dataExpiracao = new Date(c.data_expiracao + 'T00:00:00');
    return dataExpiracao <= em30Dias && dataExpiracao >= hoje && c.status === 'ativo';
  }).length;

  const handleEditConta = (conta: ContaPrivilegiada) => {
    setSelectedConta(conta);
    setShowContaDialog(true);
  };

  const handleCloseContaDialog = () => {
    setSelectedConta(null);
    setShowContaDialog(false);
    queryClient.invalidateQueries({ queryKey: ['contas-privilegiadas'] });
  };

  const handleDeleteConta = (contaId: string, usuarioNome: string) => {
    setDeleteConfirm({ open: true, id: contaId, nome: usuarioNome });
  };

  const confirmDelete = async () => {
    const { id } = deleteConfirm;

    const { error } = await supabase
      .from('contas_privilegiadas' as any)
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: t('fin.contas.erroExcluir'),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t('fin.contas.excluida'),
      description: t('fin.contas.excluidaDesc'),
    });
    
    queryClient.invalidateQueries({ queryKey: ['contas-privilegiadas'] });
    setDeleteConfirm({ open: false, id: '', nome: '' });
  };

  /**
   * O rótulo do estado, separado de quem o desenha.
   *
   * Estava dentro do `getStatusBadge`, e só o ecrã lhe chegava: a exportação
   * escrevia o valor cru da base. Como a coluna mostra «Expirado» para uma
   * conta que a base guarda como `ativo` (é `isExpirada` que decide), o
   * ficheiro contradizia a tabela justamente no campo que manda revogar
   * acesso.
   */
  const rotuloDeStatus = (status: string) =>
    ({
      ativo: t('sweepDenuncias.contas.statusAtivo'),
      expirado: t('sweepDenuncias.contas.statusExpirado'),
      pendente_aprovacao: t('fin.contas.pendenteAprovacao'),
      revogado: t('sweepDenuncias.contas.statusRevogado'),
    } as Record<string, string>)[status] ?? t('fin.contas.pendenteAprovacao');

  const getStatusBadge = (status: string) => (
    <StatusBadge {...resolveItemStatusTone(status)}>{rotuloDeStatus(status)}</StatusBadge>
  );

  // Filtrar e ordenar contas
  const filteredAndSortedContas = useMemo(() => {
    const filtered = contas.filter(conta => {
      const matchesSearch = searchTerm === '' || 
        conta.usuario_beneficiario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conta.email_beneficiario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conta.sistemas_privilegiados?.nome_sistema.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'todos' || displayStatus(conta) === statusFilter;
      const matchesNivel = nivelFilter === 'todos' || conta.nivel_privilegio === nivelFilter;

      return matchesSearch && matchesStatus && matchesNivel;
    });

    // Ordenar
    filtered.sort((a, b) => {
      let aValue = a[sortField as keyof ContaPrivilegiada];
      let bValue = b[sortField as keyof ContaPrivilegiada];

      if (sortField === 'sistema') {
        aValue = a.sistemas_privilegiados?.nome_sistema || '';
        bValue = b.sistemas_privilegiados?.nome_sistema || '';
      }

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
  }, [contas, searchTerm, statusFilter, nivelFilter, sortField, sortDirection]);

  // Configuração das colunas para DataTable de Contas
  const contasColumns = [
    {
      key: 'usuario_beneficiario',
      label: t('fin.comum.usuario'),
      sortable: true,
      render: (_: any, conta: ContaPrivilegiada) => (
        <div>
          <div className="font-medium">{conta.usuario_beneficiario}</div>
          {conta.email_beneficiario && (
            <div className="text-sm text-muted-foreground">{conta.email_beneficiario}</div>
          )}
        </div>
      )
    },
    {
      key: 'sistema',
      mobilePriority: 6,
      label: t('sweepDenuncias.contas.colSistema'),
      sortable: true,
      render: (_: any, conta: ContaPrivilegiada) => (
        <div>
          <div className="font-medium">{conta.sistemas_privilegiados?.nome_sistema}</div>
          <div className="text-sm text-muted-foreground">
            {capitalizeText(conta.sistemas_privilegiados?.tipo_sistema || '')}
          </div>
        </div>
      )
    },
    {
      key: 'tipo_acesso',
      mobilePriority: 5,
      label: t('fin.contas.tipoAcesso'),
      sortable: true,
      render: (_: any, conta: ContaPrivilegiada) => (
        <span className="text-muted-foreground">{capitalizeText(conta.tipo_acesso)}</span>
      )
    },
    {
      key: 'nivel_privilegio',
      mobilePriority: 4,
      label: t('fin.comum.nivel'),
      sortable: true,
      render: (_: any, conta: ContaPrivilegiada) => (
        <Badge variant={conta.nivel_privilegio === 'critico' ? 'destructive' : 'secondary'}>
          {capitalizeText(conta.nivel_privilegio)}
        </Badge>
      )
    },
    {
      key: 'data_expiracao',
      mobilePriority: 2,
      label: t('fin.contas.dataExpiracao'),
      sortable: true,
      render: (_: any, conta: ContaPrivilegiada) => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const expiracao = new Date(conta.data_expiracao + 'T00:00:00');
        const diffDays = Math.ceil((expiracao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        /* Só a data: o selo repetia o que ela já diz. */
        return conta.data_expiracao ? formatDateOnly(conta.data_expiracao) : t('experience.noExpiry');
      }
    },
    {
      key: 'status',
      mobilePriority: 0,
      label: t('sweepDenuncias.contas.colStatus'),
      sortable: true,
      render: (_: any, conta: ContaPrivilegiada) => getStatusBadge(isExpirada(conta) ? 'expirado' : conta.status)
    },
    {
      key: 'system_owner_name', label: t('experience.systemOwner'), mobilePriority: 1, sortable: true,
      render: (_: unknown, c: ContaPrivilegiada) => c.system_owner_name || t('experience.notAssigned'),
    },
    {
      key: 'review_deadline', label: t('experience.systemReview'), mobilePriority: 3, sortable: true,
      render: (_: unknown, c: ContaPrivilegiada) => <div className="space-y-1">
        <span className={c.review_deadline && c.review_deadline < formatarDiaParaDB(hoje) ? 'text-destructive' : ''}>
          {c.review_deadline ? formatDateOnly(c.review_deadline) : t('experience.noOpenCampaign')}
        </span>
        {c.review_name && <p className="text-xs text-muted-foreground">{c.review_name}</p>}
      </div>,
    },
    {
      key: 'acoes',
      label: t('fin.comum.acoes'),
      render: (_: any, conta: ContaPrivilegiada) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('layout.moreActions')} title={t('layout.moreActions')}>
              <IconMore className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEditConta(conta)}>
              <IconEdit className="h-4 w-4 mr-2" />
              {t('sweepDenuncias.contas.actionEditar')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeleteConta(conta.id, conta.usuario_beneficiario)}
              className="text-destructive focus:text-destructive"
            >
              <IconDelete className="h-4 w-4 mr-2" />
              {t('sweepDenuncias.contas.actionExcluir')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const contasFilters = [
    {
      key: 'status',
      label: t('sweepDenuncias.contas.colStatus'),
      options: [
        { value: 'todos', label: t('sweepDenuncias.contas.filterTodosStatus') },
        { value: 'ativo', label: t('sweepDenuncias.contas.statusAtivo') },
        { value: 'expirado', label: t('sweepDenuncias.contas.statusExpirado') },
        { value: 'pendente_aprovacao', label: t('fin.contas.pendenteAprovacao') },
        { value: 'revogado', label: t('sweepDenuncias.contas.statusRevogado') },
      ],
      value: statusFilter,
      onChange: setStatusFilter,
    },
    {
      key: 'nivel',
      label: t('fin.comum.nivel'),
      options: [
        { value: 'todos', label: t('fin.comum.todosNiveis') },
        { value: 'critico', label: t('fin.comum.critico') },
        { value: 'alto', label: t('sweepDenuncias.contas.filterAlto') },
        { value: 'medio', label: t('sweepDenuncias.contas.filterMedio') },
        { value: 'baixo', label: t('sweepDenuncias.contas.filterBaixo') },
      ],
      value: nivelFilter,
      onChange: setNivelFilter,
    },
  ];

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.contasPrivilegiadas.title')}
        description={t('modules.contasPrivilegiadas.description')}
        actions={
          <Button onClick={() => setShowContaDialog(true)}>
            <IconAdd className="mr-2 h-4 w-4" />
            {t('sweepDenuncias.contas.novaConta')}
          </Button>
        }
        secondaryActions={[
          {
            label: t('sweepDenuncias.contas.exportCsv'),
            icon: <IconDownload className="h-4 w-4" />,
            /*
               Exportar o que está no ecrã, escrito como está no ecrã: iterava
               `contas` (tudo) enquanto a tabela mostra `filteredAndSortedContas`,
               e escrevia os valores crus da base. Aqui isso não era só feio —
               a coluna de estado mostra «Expirado» a quem já passou da data,
               e o ficheiro dizia «ativo» das mesmas linhas.
            */
            disabled: filteredAndSortedContas.length === 0,
            onClick: () => {
              exportCSV(
                [t('sweepDenuncias.contas.csvUsuario'), t('sweepDenuncias.contas.csvEmail'), t('sweepDenuncias.contas.csvTipoAcesso'), t('sweepDenuncias.contas.csvNivel'), t('sweepDenuncias.contas.csvStatus'), t('sweepDenuncias.contas.csvDataConcessao'), t('sweepDenuncias.contas.csvDataExpiracao'), t('sweepDenuncias.contas.csvSistema')],
                filteredAndSortedContas.map((c: any) => [
                  c.usuario_beneficiario || '', c.email_beneficiario || '',
                  capitalizeText(c.tipo_acesso || ''), capitalizeText(c.nivel_privilegio || ''),
                  rotuloDeStatus(isExpirada(c) ? 'expirado' : c.status),
                  c.data_concessao ? formatDateOnly(c.data_concessao) : '',
                  c.data_expiracao ? formatDateOnly(c.data_expiracao) : '',
                  c.sistemas_privilegiados?.nome_sistema || ''
                ]),
                'contas_privilegiadas'
              );
            },
          },
        ]}
      />

      <StatStrip
        loading={isLoading}
        error={isError}
        items={[
          { key: 'ativas', label: t('sweepDenuncias.contas.cardContasAtivas'), value: contasAtivas, onClick: () => { setStatusFilter('ativo'); setSearchTerm(''); setNivelFilter('todos'); } },
          { key: 'pendentes', label: t('cardsKpi.sweep.acessos.pendentes'), value: contasPendentes, onClick: () => { setStatusFilter('pendente_aprovacao'); setSearchTerm(''); setNivelFilter('todos'); } },
          { key: 'vencendo', label: t('residuos.geral.vencendo30'), value: contasVencendo, tone: 'warning', drillDown: 'contas_vencendo' },
          { key: 'expiradas', label: t('sweepDenuncias.contas.cardExpiradas'), value: contasExpiradas, tone: 'destructive', onClick: () => { setStatusFilter('expirado'); setSearchTerm(''); setNivelFilter('todos'); } },
        ]}
      />

      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            paginated
            pageSize={20}
            data={filteredAndSortedContas}
            columns={contasColumns}
            defaultHiddenColumns={['tipo_acesso']}
            onRowClick={(conta) => setDetalheConta(conta)}
            loading={isLoading}
            error={isError || systemsError}
            onRefresh={() => { void refetch(); void retrySystems(); }}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={t('fin.contas.buscar')}
            filters={contasFilters}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            emptyState={{
              title: t('fin.contas.nenhuma'),
              description: searchTerm || statusFilter !== 'todos' || nivelFilter !== 'todos'
                ? t('sweepDenuncias.contas.emptyFilteredDescription')
                : t('sweepDenuncias.contas.emptyDefaultDescription')
            }}
          />
        </CardContent>
      </Card>

      <ContaDialog
        open={showContaDialog}
        onClose={handleCloseContaDialog}
        conta={selectedConta}
        sistemas={sistemas}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => !open && setDeleteConfirm({ open: false, id: '', nome: '' })}
        onConfirm={confirmDelete}
        title={t('fin.contas.excluirTitle')}
        description={t('fin.contas.excluirDesc', { nome: deleteConfirm.nome })}
        variant="destructive"
      />
      <RecordDetailDrawer
        open={!!detalheConta}
        onOpenChange={(o) => !o && setDetalheConta(null)}
        title={detalheConta?.usuario_beneficiario}
        subtitle={detalheConta?.email_beneficiario}
        badges={detalheConta ? getStatusBadge(displayStatus(detalheConta)) : undefined}
        actions={detalheConta ? (
          <>
          <Button variant="outline" size="sm" onClick={() => navigate(detalheConta.review_id ? `/revisao-acessos?revisao=${encodeURIComponent(detalheConta.review_id)}` : `/revisao-acessos?sistema=${encodeURIComponent(detalheConta.sistema_id)}`)}>{t('experience.viewSystemReviews')}</Button>
          <Button variant="outline" size="sm" onClick={() => { const c = detalheConta; setDetalheConta(null); handleEditConta(c); }}>
            {t('fin.comum.editar')}
          </Button>
          </>
        ) : undefined}
        fields={detalheConta ? [
          { label: t('detalheRegisto.sistema'), value: detalheConta.sistemas_privilegiados?.nome_sistema },
          { label: t('experience.systemOwner'), value: detalheConta.system_owner_name || t('experience.notAssigned') },
          { label: t('experience.systemReview'), value: detalheConta.review_name || t('experience.noOpenCampaign') },
          { label: t('experience.deadline'), value: detalheConta.review_deadline ? formatDateOnly(detalheConta.review_deadline) : t('experience.noDeadline') },
          { label: t('experience.accountLastReview'), value: detalheConta.last_review_at ? formatDateOnly(detalheConta.last_review_at) : t('experience.noAccountReview') },
          { label: t('experience.reviewScopeLabel'), value: t('experience.reviewScopeHint'), full: true },
          { label: t('detalheRegisto.tipoAcesso'), value: detalheConta.tipo_acesso },
          { label: t('detalheRegisto.nivelPrivilegio'), value: detalheConta.nivel_privilegio },
          { label: t('detalheRegisto.concessao'), value: detalheConta.data_concessao ? formatDateOnly(detalheConta.data_concessao) : null },
          { label: t('detalheRegisto.expiracao'), value: detalheConta.data_expiracao ? formatDateOnly(detalheConta.data_expiracao) : t('experience.noExpiry') },
          { label: t('detalheRegisto.justificativa'), value: detalheConta.justificativa_negocio, full: true },
        ] : []}
      />

    </div>
  );
}
