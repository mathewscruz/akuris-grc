import { useState, useMemo } from 'react';
import { useFocusRow } from '@/hooks/useFocusRow';
import { matchesSearch } from '@/lib/search-utils';
import { IconAdd, IconEdit, IconDelete, IconDownload, IconView, IconMore, IconWarning, IconTime, IconShield, IconFileCheck, IconTest, IconChecklist, IconCalendarClock } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { StatStrip } from '@/components/ui/stat-strip';

import { DataTable, Column } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useContinuidadeStats } from '@/hooks/useContinuidadeStats';
import { useToast } from '@/hooks/use-toast';
import { formatDateOnly, intlLocale, parseDataLocal } from '@/lib/date-utils';
import { exportCSV } from '@/lib/csv-utils';
import { PlanoDialog } from '@/components/continuidade/PlanoDialog';
import { PlanoDetalheDialog } from '@/components/continuidade/PlanoDetalheDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/contexts/LanguageContext';

const statusMap: Record<string, { label: string; variant: any }> = {
  rascunho: { label: 'Rascunho', variant: 'secondary' },
  ativo: { label: 'Ativo', variant: 'success' },
  em_revisao: { label: 'Em Revisão', variant: 'warning' },
  desativado: { label: 'Desativado', variant: 'destructive' },
};

const tipoMap: Record<string, string> = {
  bcp: 'BCP',
  drp: 'DRP',
  ambos: 'BCP + DRP',
};

export default function Continuidade() {
  /*
    O `?focus=<id>` que a busca global, o `EntidadeSelect` e o sino já
    emitiam para aqui não tinha do lado de cá quem o lesse: a página abria a
    lista inteira e o registo procurado ficava por encontrar à mão. O
    `DataTable` já marca cada linha com `data-focus-id`; faltava só chamar o
    gancho que a procura e a destaca.
  */
  useFocusRow();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useContinuidadeStats();

  const [planoDialog, setPlanoDialog] = useState<{ open: boolean; plano?: any }>({ open: false });
  const [detalheDialog, setDetalheDialog] = useState<{ open: boolean; plano?: any }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const { data: planos = [], isLoading } = useQuery({
    queryKey: ['continuidade-planos', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('continuidade_planos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['continuidade-planos'] });
    queryClient.invalidateQueries({ queryKey: ['continuidade-stats'] });
  };

  // Insights executivos
  const insights = useMemo(() => {
    const hoje = new Date();
    const em30dias = new Date(hoje.getTime() + 30 * 86400000);
    const proximasRevisoes = planos
      .filter((p: any) => p.proxima_revisao && parseDataLocal(p.proxima_revisao) <= em30dias)
      .sort((a: any, b: any) => parseDataLocal(a.proxima_revisao).getTime() - parseDataLocal(b.proxima_revisao).getTime())
      .slice(0, 5);
    const semResponsavel = planos.filter((p: any) => !p.responsavel_id).length;
    const semRTO = planos.filter((p: any) => p.rto_horas == null).length;
    return { proximasRevisoes, semResponsavel, semRTO };
  }, [planos]);

  // A caixa de busca existia mas não estava ligada a nada: escrevia-se e o
  // campo ficava vazio. Filtra pelo que se lê na tabela -- nome, tipo, estado.
  const planosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return planos;
    return (planos as any[]).filter((p) =>
      matchesSearch(searchTerm, p.nome, p.tipo, p.status, p.descricao),
    );
  }, [planos, searchTerm]);

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('continuidade_planos').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      toast({ title: t('fin.continuidade.excluido') });
      refreshAll();
    } catch (error: any) {
      toast({ title: t('fin.comum.erroExcluir'), description: error.message, variant: 'destructive' });
    }
    setDeleteConfirm({ open: false, id: '' });
  };

  const columns: Column<any>[] = [
    {
      key: 'nome',
      label: t('fin.comum.nome'),
      sortable: true,
      render: (_val, row) => (
        <button onClick={() => setDetalheDialog({ open: true, plano: row })} className="text-left hover:text-primary transition-colors font-medium">
          {row.nome}
        </button>
      ),
    },
    {
      key: 'tipo',
      label: t('fin.comum.tipo'),
      render: (_val, row) => <Badge variant="outline">{tipoMap[row.tipo] || row.tipo}</Badge>,
    },
    {
      key: 'status',
      label: t('fin.comum.status'),
      render: (_val, row) => {
        const st = statusMap[row.status] || statusMap.rascunho;
        return <Badge variant={st.variant}>{st.label}</Badge>;
      },
    },
    {
      key: 'rto_horas',
      label: 'RTO',
      render: (_val, row) => row.rto_horas != null ? `${row.rto_horas}h` : '—',
    },
    {
      key: 'rpo_horas',
      label: 'RPO',
      render: (_val, row) => row.rpo_horas != null ? `${row.rpo_horas}h` : '—',
    },
    {
      key: 'proxima_revisao',
      label: t('fin.comum.proxRevisao'),
      render: (_val, row) => row.proxima_revisao ? formatDateOnly(row.proxima_revisao) : '—',
    },
    {
      key: 'actions',
      label: t('fin.comum.acoes'),
      render: (_val, row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('layout.moreActions')} title={t('layout.moreActions')}>
              <IconMore className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDetalheDialog({ open: true, plano: row })}>
               <IconView className="h-4 w-4 mr-2" /> {t('sweepDados.continuidade.visualizar')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPlanoDialog({ open: true, plano: row })}>
               <IconEdit className="h-4 w-4 mr-2" /> {t('sweepDados.continuidade.editar')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm({ open: true, id: row.id })}>
              <IconDelete className="h-4 w-4 mr-2" />{t('fin.comum.excluir')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title={t('fin.continuidade.title')}
        description={t('fin.continuidade.desc')}
        actions={
          <Button onClick={() => setPlanoDialog({ open: true })}>
            <IconAdd className="h-4 w-4 mr-2" /> {t('sweepDados.continuidade.novoPlano')}
          </Button>
        }
        secondaryActions={[
          {
            label: t('sweepDenuncias.contas.exportCsv'),
            icon: <IconDownload className="h-4 w-4" />,
            // Exportar o que está no ecrã: iterava `planos` (tudo) enquanto a
            // tabela mostra `planosFiltrados`. Quem filtra e exporta age sobre
            // a lista que exportou.
            disabled: planosFiltrados.length === 0,
            onClick: () => {
              exportCSV(
                [t('fin.comum.nome'), t('fin.comum.tipo'), t('fin.comum.status'), 'RTO (h)', 'RPO (h)', t('fin.comum.proxRevisao'), t('fin.comum.versao'), t('fin.comum.criadoEm')],
                planosFiltrados.map((p: any) => [
                  p.nome || '', tipoMap[p.tipo] || p.tipo || '',
                  statusMap[p.status]?.label || p.status || '',
                  p.rto_horas != null ? String(p.rto_horas) : '',
                  p.rpo_horas != null ? String(p.rpo_horas) : '',
                  p.proxima_revisao ? parseDataLocal(p.proxima_revisao).toLocaleDateString(intlLocale()) : '',
                  p.versao || '',
                  p.created_at ? new Date(p.created_at).toLocaleDateString(intlLocale()) : ''
                ]),
                'continuidade_planos'
              );
            },
          },
        ]}
      />

      <StatStrip
        loading={statsLoading}
        items={[
          { key: 'total', label: t('cardsKpi.continuidade.totalPlanos'), value: stats?.total ?? 0, drillDown: 'continuidade' },
          { key: 'ativos', label: t('cardsKpi.sweep.continuidade.planosAtivos'), value: stats?.ativos ?? 0, drillDown: 'continuidade_ativos' },
          { key: 'emRevisao', label: t('cardsKpi.continuidade.emRevisao'), value: stats?.emRevisao ?? 0, tone: 'warning', drillDown: 'continuidade_revisao' },
          { key: 'testes', label: t('cardsKpi.continuidade.testesRealizados'), value: stats?.testesRealizados ?? 0, drillDown: 'continuidade_testes' },
          { key: 'tarefasPendentes', label: t('cardsKpi.sweep.continuidade.tarefasPendentes'), value: stats?.tarefasPendentes ?? 0, tone: 'destructive', drillDown: 'continuidade_tarefas' },
        ]}
      />

      {/* Insights Executivos */}
      {planos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <IconCalendarClock className="h-4 w-4 text-warning" />
                 {t('sweepDados.continuidade.proximasRevisoesTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {insights.proximasRevisoes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('fin.continuidade.semRevisoes')}</p>
              ) : (
                <ul className="space-y-2">
                  {insights.proximasRevisoes.map((p: any) => (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <button onClick={() => setDetalheDialog({ open: true, plano: p })} className="text-left hover:text-primary truncate flex-1">
                        {p.nome}
                      </button>
                      <Badge variant="outline" className="ml-2">{formatDateOnly(p.proxima_revisao)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <IconWarning className="h-4 w-4 text-destructive" />
                 {t('sweepDados.continuidade.itensAtencaoTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('fin.continuidade.semResponsavel')}</span>
                <Badge variant={insights.semResponsavel > 0 ? 'destructive' : 'success'}>{insights.semResponsavel}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('cardsKpi.sweep.continuidade.semRto')}</span>
                <Badge variant={insights.semRTO > 0 ? 'warning' : 'success'}>{insights.semRTO}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('cardsKpi.continuidade.coberturaTestes')}</span>
                <Badge variant="outline">
                  {planos.length === 0
                    ? t('t4.continuidade.semTestes')
                    : t('t4.continuidade.coberturaPlanos', {
                        testados: stats?.planosTestados ?? 0,
                        total: planos.length,
                      })}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de Planos com DataTable */}
      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            paginated
            pageSize={20}
            data={planosFiltrados}
            columns={columns}
            onRowClick={(row) => setDetalheDialog({ open: true, plano: row })}
            searchable
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={t('fin.continuidade.buscar')}
            loading={isLoading}
            emptyState={{
              icon: <IconShield className="h-8 w-8" />,
              title: t('fin.continuidade.nenhum'),
              description: t('fin.continuidade.vazioDesc'),
              action: { label: 'Criar Plano', onClick: () => setPlanoDialog({ open: true }) },
            }}
          />
        </CardContent>
      </Card>

      {/* Dialogs */}
      <PlanoDialog
        open={planoDialog.open}
        onOpenChange={o => setPlanoDialog(p => ({ ...p, open: o }))}
        plano={planoDialog.plano}
        onSuccess={refreshAll}
      />

      <PlanoDetalheDialog
        open={detalheDialog.open}
        onOpenChange={o => setDetalheDialog(p => ({ ...p, open: o }))}
        plano={detalheDialog.plano}
        onSuccess={refreshAll}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={o => setDeleteConfirm(p => ({ ...p, open: o }))}
        title={t('fin.continuidade.excluirTitle')}
        description={t('fin.continuidade.excluirDesc')}
        confirmText={t('fin.comum.excluir')}
        cancelText={t('fin.comum.cancelar')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
