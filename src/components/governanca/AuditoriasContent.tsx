import { useState, useEffect, useMemo, useRef } from "react";
import { orIlike } from '@/lib/busca-segura';
import { IconAdd, IconDownload, IconMore, IconSuccess, IconWarning, IconTime, IconFile, IconEdit, IconDelete, IconChecklist } from '@/components/icons';
import { createPortal } from "react-dom";
import { useLocation, useSearchParams } from "react-router-dom";
import { useEmpresaId } from "@/hooks/useEmpresaId";
;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StatStrip } from "@/components/ui/stat-strip";
import {
  DropdownMenu as ActionsMenu,
  DropdownMenuContent as ActionsMenuContent,
  DropdownMenuItem as ActionsMenuItem,
  DropdownMenuTrigger as ActionsMenuTrigger,
} from "@/components/ui/dropdown-menu";
;
import { DataTable, Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { resolveAuditoriaStatusTone, resolveAuditoriaPrioridadeTone } from "@/lib/status-tone";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from '@/hooks/use-toast';
import { useUsuariosEmpresa } from "@/hooks/useAuditoriaData";
import AuditoriaDialog from "@/components/auditorias/AuditoriaDialog";
import { ItensAuditoriaDialog } from "@/components/auditorias/ItensAuditoriaDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatDateOnly, formatarDiaParaDB} from "@/lib/date-utils";
import { formatStatus } from "@/lib/text-utils";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AuditoriasContent({ actionsSlot }: { actionsSlot?: HTMLElement | null } = {}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const location = useLocation();
  const { empresaId } = useEmpresaId();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [selectedAuditoria, setSelectedAuditoria] = useState<any>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAuditoriaDialog, setShowAuditoriaDialog] = useState(false);
  const [showControlesDialog, setShowControlesDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; nome?: string }>({ open: false, id: '' });

  const { data: usuarios } = useUsuariosEmpresa();

  const { data: auditorias, isLoading, refetch } = useQuery({
    queryKey: ['auditorias', empresaId, searchTerm, statusFilter, tipoFilter],
    queryFn: async () => {
      let query = supabase
        .from('auditorias')
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('created_at', { ascending: false });

      /*
        Busca saneada: `searchTerm` vem de uma caixa de texto e ia cru para
        dentro de `or()`, que o PostgREST separa por vírgula. Ver `orIlike`.
      */
      const buscaAuditorias = orIlike(['nome', 'descricao'], searchTerm);
      if (buscaAuditorias) {
        query = query.or(buscaAuditorias);
      }

      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      if (tipoFilter !== 'todos') {
        query = query.eq('tipo', tipoFilter);
      }

      const { data, error } = await query;

      if (error) {
        toast({
          title: t("governancaComp.auditorias.toastErrorTitle"),
          description: t("governancaComp.auditorias.toastErrorLoad"),
          variant: "destructive",
        });
        throw error;
      }

      return data || [];
    },
    enabled: !!empresaId,
  });

  /**
   * KPIs do módulo — consulta própria, SEM os filtros da lista.
   *
   * Derivavam do mesmo array que a tabela, e a tabela é filtrada no servidor:
   * escolher Status="Concluída" fazia o cartão "Auditorias cadastradas" cair de
   * 3 para 1. Um KPI que muda quando se filtra a lista não é um KPI, é uma
   * segunda contagem da lista com o rótulo errado.
   */
  const { data: todasAsAuditorias } = useQuery({
    queryKey: ['auditorias-kpi', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auditorias')
        .select('id, status')
        .eq('empresa_id', empresaId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Buscar contagens de itens para todas as auditorias (inclui auditoria_itens + controles_auditorias)
  const { data: auditoriasCounts } = useQuery({
    queryKey: ['auditorias-counts', todasAsAuditorias?.map(a => a.id)],
    queryFn: async () => {
      const auditorias = todasAsAuditorias;
      if (!auditorias || auditorias.length === 0) return {};

      const counts: Record<string, { itens: number; itensConcluidos: number }> = {};
      const auditoriaIds = auditorias.map(a => a.id);
      
      // Buscar TODOS os itens de todas as auditorias de uma vez
      const [itensRes, controlesRes] = await Promise.all([
        supabase
          .from('auditoria_itens')
          // `controle_vinculado_id` e o que permite deduplicar contra
          // `controles_auditorias`, que e espelhada por gatilho a partir daqui.
          .select('id, status, auditoria_id, controle_vinculado_id')
          .in('auditoria_id', auditoriaIds),
        supabase
          .from('controles_auditorias')
          .select(`auditoria_id, controle_id, controle:controles(id, status)`)
          .in('auditoria_id', auditoriaIds)
      ]);
      
      /**
       * Progresso da auditoria — a MESMA derivação de `ItensAuditoriaDialog`.
       *
       * Havia duas contas para o mesmo número, e esta estava errada nos dois
       * lados. Somava `auditoria_itens + controles_auditorias` sem deduplicar,
       * e desde que a segunda passou a ser espelhada por gatilho a partir da
       * primeira, cada controlo importado entrava duas vezes. E contava o
       * controlo `ativo` como item concluído — estar no âmbito não é estar
       * auditado. A Deloitte-2025 saía "50/50 · 100% concluído" no cartão e no
       * CSV com zero itens de trabalho concluídos e zero testes.
       */
      for (const auditoria of auditorias) {
        const itens = itensRes.data?.filter(i => i.auditoria_id === auditoria.id) || [];
        const controles = controlesRes.data?.filter((c: any) => c.auditoria_id === auditoria.id) || [];

        const comItemProprio = new Set(
          itens.map((i: any) => i.controle_vinculado_id).filter(Boolean),
        );
        const controlesSemItem = controles.filter(
          (c: any) => c.controle?.id && !comItemProprio.has(c.controle.id),
        );

        counts[auditoria.id] = {
          itens: itens.length + controlesSemItem.length,
          // Só o trabalho de auditoria realmente concluído conta.
          itensConcluidos: itens.filter(i => i.status === 'concluido').length,
        };
      }
      
      return counts;
    },
    enabled: !!auditorias && auditorias.length > 0,
  });

  const handleEdit = (auditoria: any) => {
    setSelectedAuditoria(auditoria);
    setShowAuditoriaDialog(true);
  };

  const handleDelete = (id: string, nome?: string) => {
    setDeleteConfirm({ open: true, id, nome });
  };

  const confirmDelete = async () => {
    const { id } = deleteConfirm;
    
    const { error } = await supabase
      .from('auditorias')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: t("governancaComp.auditorias.toastErrorTitle"),
        description: t("governancaComp.auditorias.toastErrorDelete"),
        variant: "destructive",
      });
      setDeleteConfirm({ open: false, id: '' });
      return;
    }

    toast({
      title: t("governancaComp.auditorias.toastSuccessTitle"),
      description: t("governancaComp.auditorias.toastDeleted"),
    });
    setDeleteConfirm({ open: false, id: '' });
    refetch();
  };

  const handleOpenControles = (auditoria: any) => {
    setSelectedAuditoria(auditoria);
    setShowControlesDialog(true);
  };

  /*
    `?focus=<id>` abre a auditoria directamente.

    O feed de "Atividades Recentes" do painel navegava para a lista e deixava a
    pessoa a reencontrar à mão a auditoria em que tinha acabado de clicar. Aqui
    já existia o caminho por `location.state`, que só funciona quando a
    navegação é feita em JS na mesma sessão; o parâmetro no endereço funciona
    também em link colado e em recarregamento. Mesma grafia que ControlesContent.
  */
  const focoConsumido = useRef<string | null>(null);
  useEffect(() => {
    const alvo = searchParams.get('focus');
    if (!alvo || alvo === focoConsumido.current) return;
    if (!auditorias || auditorias.length === 0) return;
    focoConsumido.current = alvo;

    const auditoria = auditorias.find((a) => a.id === alvo);
    if (auditoria) {
      setSelectedAuditoria(auditoria);
      setShowAuditoriaDialog(true);
    } else {
      /*
        O id também pode ser de um ITEM.

        A busca global lista itens de auditoria como registos próprios e
        mandava-os para cá com o id do item — que nunca casa com uma
        auditoria. O efeito não encontrava nada, limpava o parâmetro e a
        pessoa ficava na lista, sem sinal de que o clique tinha feito algo.
        O item não tem ecrã próprio: vive no checklist da sua auditoria, e é
        esse que se abre.
      */
      void (async () => {
        const { data } = await supabase
          .from('auditoria_itens')
          .select('auditoria_id')
          .eq('id', alvo)
          .maybeSingle();
        const pai = data ? auditorias.find((a) => a.id === data.auditoria_id) : null;
        if (!pai) return;
        setSelectedAuditoria(pai);
        setShowControlesDialog(true);
      })();
    }

    const proximo = new URLSearchParams(searchParams);
    proximo.delete('focus');
    setSearchParams(proximo, { replace: true });
  }, [searchParams, auditorias, setSearchParams]);

  // Detectar se veio com itemId do dashboard
  useEffect(() => {
    const itemId = location.state?.itemId;
    if (itemId && auditorias && auditorias.length > 0) {
      const auditoria = auditorias.find(a => a.id === itemId);
      if (auditoria) {
        setSelectedAuditoria(auditoria);
        setShowAuditoriaDialog(true);
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, auditorias]);

  // Exportar para CSV
  const handleExportCSV = () => {
    if (!auditorias || auditorias.length === 0) return;
    
    const headers = ['Nome', 'Tipo', 'Status', 'Prioridade', 'Data Início', 'Auditor', 'Itens', 'Concluídos', '% Progresso'];
    
    const rows = auditorias.map(a => {
      const counts = auditoriasCounts?.[a.id] || { itens: 0, itensConcluidos: 0 };
      const auditor = usuarios?.find((u: any) => u.user_id === a.auditor_responsavel);
      const progresso = counts.itens > 0 ? Math.round((counts.itensConcluidos / counts.itens) * 100) : 0;
      
      return [
        a.nome,
        formatStatus(a.tipo),
        formatStatus(a.status),
        formatStatus(a.prioridade),
        a.data_inicio ? formatDateOnly(a.data_inicio) : '-',
        auditor?.nome || '-',
        counts.itens,
        counts.itensConcluidos,
        `${progresso}%`
      ].join(';');
    });
    
    const csvContent = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditorias_${formatarDiaParaDB(new Date())}.csv`;
    link.click();
    
    toast({
      title: t("governancaComp.auditorias.toastExportTitle"),
      description: t("governancaComp.auditorias.toastExportDesc", { count: auditorias.length }),
    });
  };

  /** Filtro ou pesquisa activos: o estado vazio tem de dizer "nada encontrado",
   *  e não "comece por criar" — a base pode estar cheia. */
  const filtrosAtivos =
    statusFilter !== 'todos' || tipoFilter !== 'todos' || searchTerm.trim() !== '';

  // Calcular estatísticas
  const totalItens = Object.values(auditoriasCounts || {}).reduce((acc, c) => acc + c.itens, 0);
  const totalConcluidos = Object.values(auditoriasCounts || {}).reduce((acc, c) => acc + c.itensConcluidos, 0);


  /*
     A mesma tabela do resto do produto.

     Isto era uma pilha de cartoes com o nome a 220 px fixos e o resto
     empurrado para uma fila de pilulas: nao havia cabecalho, nao se
     ordenava por nada, e as colunas nao alinhavam de linha para linha.
     Ao lado, na aba dos Controles, estava a `DataTable` de sempre.

     A `DataTable` traz o cabecalho, a ordenacao, o estado vazio e a
     paginacao — tudo o que aqui estava escrito a mao, e que ja estava a
     paginar duas vezes desde que a tabela passou a paginar sozinha.
  */
  const auditoriaColumns: Column<any>[] = [
    {
      key: 'nome',
      label: t("governancaComp.auditorias.columnNome"),
      sortable: true,
      render: (_v: any, a: any) => (
        <div className="min-w-0">
          <button
            type="button"
            className="font-medium text-left hover:text-primary hover:underline transition-colors"
            onClick={(e) => { e.stopPropagation(); handleOpenControles(a); }}
          >
            {a.nome}
          </button>
          {a.descricao && (
            <p className="text-micro text-muted-foreground line-clamp-1">{a.descricao}</p>
          )}
        </div>
      ),
    },
    {
      key: 'tipo',
      label: t("governancaComp.auditorias.columnTipo"),
      sortable: true,
      render: (_v: any, a: any) => (
        <StatusBadge tone="neutral" variant="outline">{formatStatus(a.tipo)}</StatusBadge>
      ),
    },
    {
      key: 'status',
      label: t("governancaComp.auditorias.columnStatus"),
      sortable: true,
      render: (_v: any, a: any) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge {...resolveAuditoriaStatusTone(a.status)}>{formatStatus(a.status)}</StatusBadge>
          {a.conclusao_forcada && (
            <span title={a.conclusao_justificativa || undefined}>
              <StatusBadge tone="warning">{t('t4.gates.forcadaCurta')}</StatusBadge>
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'prioridade',
      label: t("governancaComp.auditorias.columnPrioridade"),
      sortable: true,
      render: (_v: any, a: any) => (
        <StatusBadge {...resolveAuditoriaPrioridadeTone(a.prioridade)}>{formatStatus(a.prioridade)}</StatusBadge>
      ),
    },
    {
      key: 'itens',
      label: t("governancaComp.auditorias.columnItens"),
      /* Sem itens nao ha barra: uma barra a zero le-se como «nao comecou»,
         quando o que se passa e que nao ha nada para fazer. */
      render: (_v: any, a: any) => {
        const c = auditoriasCounts?.[a.id] || { itens: 0, itensConcluidos: 0 };
        if (c.itens === 0) return <span className="text-muted-foreground">-</span>;
        const pct = Math.round((c.itensConcluidos / c.itens) * 100);
        return (
          <div className="flex items-center gap-2 min-w-[110px]">
            <span className="text-xs tabular-nums whitespace-nowrap">{c.itensConcluidos}/{c.itens}</span>
            <Progress value={pct} className="h-1.5 flex-1" />
            <span className="text-micro text-muted-foreground tabular-nums">{pct}%</span>
          </div>
        );
      },
    },
    {
      key: 'auditor_responsavel',
      label: t("governancaComp.auditorias.columnAuditor"),
      sortable: true,
      render: (_v: any, a: any) => {
        const u = usuarios?.find((x: any) => x.user_id === a.auditor_responsavel);
        return u?.nome
          ? <span className="text-xs">{u.nome}</span>
          : <span className="text-muted-foreground">-</span>;
      },
    },
    {
      key: 'data_inicio',
      label: t("governancaComp.auditorias.columnInicio"),
      sortable: true,
      render: (_v: any, a: any) => (
        a.data_inicio
          ? <span className="text-xs tabular-nums">{formatDateOnly(a.data_inicio)}</span>
          : <span className="text-muted-foreground">-</span>
      ),
    },
    {
      key: 'acoes',
      label: t("governancaComp.auditorias.columnAcoes"),
      render: (_v: any, a: any) => (
        <ActionsMenu>
          <ActionsMenuTrigger asChild>
            {/* O nome da auditoria distingue as linhas na arvore de acessibilidade. */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={`${t('layout.moreActions')}: ${a.nome}`}
            >
              <IconMore className="h-4 w-4" />
            </Button>
          </ActionsMenuTrigger>
          <ActionsMenuContent align="end">
            <ActionsMenuItem onClick={() => handleEdit(a)}>
              <IconEdit className="h-4 w-4 mr-2" />
              {t("controlesAuditorias.acaEditar")}
            </ActionsMenuItem>
            <ActionsMenuItem onClick={() => handleOpenControles(a)}>
              <IconChecklist className="h-4 w-4 mr-2" />
              {t("controlesAuditorias.acaGerenciarItens")}
            </ActionsMenuItem>
            <ActionsMenuItem onClick={() => handleDelete(a.id, a.nome)} className="text-destructive focus:text-destructive">
              <IconDelete className="h-4 w-4 mr-2" />
              {t("controlesAuditorias.acaExcluir")}
            </ActionsMenuItem>
          </ActionsMenuContent>
        </ActionsMenu>
      ),
    },
  ];
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <StatStrip
        loading={isLoading}
        items={[
          { key: 'total', label: t("governancaComp.auditorias.statTotal"), value: todasAsAuditorias?.length || 0, drillDown: 'auditorias' },
          { key: 'em_andamento', label: t("governancaComp.auditorias.statEmAndamento"), value: todasAsAuditorias?.filter(a => a.status === 'em_andamento').length || 0, drillDown: 'auditorias_andamento' },
          { key: 'controles', label: t("governancaComp.auditorias.statControles"), value: `${totalConcluidos}/${totalItens}`, drillDown: 'auditorias_itens' },
          { key: 'pendentes', label: t("governancaComp.auditorias.statPendentes"), value: todasAsAuditorias?.filter(a => a.status === 'planejamento').length || 0, tone: 'warning', drillDown: 'auditorias_pendentes' },
        ]}
      />

      {actionsSlot && createPortal(
        <>
          <ActionsMenu>
            <ActionsMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("layout.moreActions")} title={t("layout.moreActions")}>
                <IconMore className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </ActionsMenuTrigger>
            <ActionsMenuContent align="end" className="w-56">
              <ActionsMenuItem onClick={handleExportCSV} disabled={!auditorias || auditorias.length === 0}>
                <IconDownload className="mr-2 h-4 w-4" strokeWidth={1.5} />
                {t("governancaComp.auditorias.buttonExportar")}
              </ActionsMenuItem>
            </ActionsMenuContent>
          </ActionsMenu>
          <Button size="sm" onClick={() => setShowAuditoriaDialog(true)}>
            <IconAdd className="h-4 w-4 mr-2" />
            {t("governancaComp.auditorias.buttonNova")}
          </Button>
        </>,
        actionsSlot
      )}

      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            paginated
            pageSize={20}
            data={auditorias || []}
            columns={auditoriaColumns}
            onRowClick={(a: any) => handleOpenControles(a)}
            loading={isLoading}
            searchable
            searchPlaceholder={t("governancaComp.auditorias.searchPlaceholder")}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filters={[
              {
                key: 'status',
                label: t("governancaComp.auditorias.filterStatus"),
                options: [
                  { value: 'todos', label: t("governancaComp.auditorias.filterStatusAll") },
                  { value: 'planejamento', label: t("governancaComp.auditorias.statusPlanejamento") },
                  { value: 'em_andamento', label: t("governancaComp.auditorias.statusEmAndamento") },
                  { value: 'concluida', label: t("governancaComp.auditorias.statusConcluida") },
                  { value: 'cancelada', label: t("governancaComp.auditorias.statusCancelada") },
                ],
                value: statusFilter,
                onChange: setStatusFilter,
              },
              {
                key: 'tipo',
                label: t("governancaComp.auditorias.filterTipo"),
                options: [
                  { value: 'todos', label: t("governancaComp.auditorias.filterTipoAll") },
                  { value: 'interna', label: t("governancaComp.auditorias.tipoInterna") },
                  { value: 'externa', label: t("governancaComp.auditorias.tipoExterna") },
                  { value: 'compliance', label: t("governancaComp.auditorias.tipoCompliance") },
                  { value: 'operacional', label: t("governancaComp.auditorias.tipoOperacional") },
                  { value: 'ti', label: t("governancaComp.auditorias.tipoTi") },
                ],
                value: tipoFilter,
                onChange: setTipoFilter,
              },
            ]}
            emptyState={{
              icon: <IconFile className="h-8 w-8" />,
              title: t("governancaComp.auditorias.emptyTitle"),
              description: t("governancaComp.auditorias.emptyDescription"),
              action: {
                label: t("governancaComp.auditorias.emptyAction"),
                onClick: () => { setSelectedAuditoria(null); setShowAuditoriaDialog(true); },
              },
            }}
          />
        </CardContent>
      </Card>
      
      <AuditoriaDialog
        open={showAuditoriaDialog}
        onOpenChange={setShowAuditoriaDialog}
        auditoria={selectedAuditoria}
        onSuccess={() => {
          refetch();
          setShowAuditoriaDialog(false);
        }}
      />

      <ItensAuditoriaDialog
        open={showControlesDialog}
        onOpenChange={setShowControlesDialog}
        auditoriaId={selectedAuditoria?.id}
        auditoriaNome={selectedAuditoria?.nome}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title={t("governancaComp.auditorias.deleteTitle")}
        description={t("governancaComp.auditorias.deleteDescription", { nome: deleteConfirm.nome })}
        confirmText={t("governancaComp.auditorias.deleteConfirm")}
        cancelText={t("governancaComp.auditorias.deleteCancel")}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
