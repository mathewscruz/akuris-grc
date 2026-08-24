import { useEffect, useState } from 'react';
import { filterUuids } from '@/lib/uuid';
import { IconView, IconMore, IconSuccess, IconWarning, IconError, IconTime, IconCalendarClock, IconTimer, IconBan } from '@/components/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/ui/page-header';
import { StatStrip } from '@/components/ui/stat-strip';
import { DataTable, Column } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDateOnly, formatarDiaParaDB, parseDataLocal } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone } from '@/lib/status-tone';
import { differenceInCalendarDays } from 'date-fns';
import { AceiteDetalheDialog } from '@/components/riscos/AceiteDetalheDialog';
import { AprovacaoRiscoDialog } from '@/components/riscos/AprovacaoRiscoDialog';
import { useLanguage } from '@/contexts/LanguageContext';

import { useMatrizConfigEmpresa } from '@/hooks/useMatrizConfigEmpresa';
interface RiscoAceito {
  id: string;
  nome: string;
  nivel_risco_inicial: string;
  nivel_risco_residual?: string;
  justificativa_aceite?: string;
  data_aceite?: string;
  aprovador_aceite?: string;
  data_proxima_revisao?: string;
  aceite_valido_ate?: string;
  responsavel?: string;
  created_at: string;
  created_by?: string;
  status_aceite?: string;
  aprovador_nome?: string;
  responsavel_nome?: string;
}

/** Comparação de rótulo insensível a acento e caixa. */
const rotuloNivel = (v?: string | null) =>
  (v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const SELECT_ACEITE = `
  id, nome, nivel_risco_inicial, nivel_risco_residual, severidade_efetiva, score_efetivo,
  justificativa_aceite, data_aceite, aprovador_aceite, aceite_valido_ate,
  data_proxima_revisao, responsavel, created_at, created_by, status_aceite
`;

export default function RiscosAceite({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: matriz } = useMatrizConfigEmpresa();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTermPendente, setSearchTermPendente] = useState('');
  const [revisaoFilter, setRevisaoFilter] = useState('');
  const [nivelFilter, setNivelFilter] = useState('');
  const [selectedRisco, setSelectedRisco] = useState<RiscoAceito | null>(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [aprovacaoOpen, setAprovacaoOpen] = useState(false);
  const [aprovacaoRisco, setAprovacaoRisco] = useState<any>(null);

  // Rede de segurança: além da rotina diária no servidor, reavalia expirações ao carregar.
  useEffect(() => {
    if (!profile?.empresa_id) return;
    supabase.rpc('expirar_aceites_riscos').then(({ error }) => {
      if (error) return;
      queryClient.invalidateQueries({ queryKey: ['riscos-aceitos'] });
      queryClient.invalidateQueries({ queryKey: ['riscos-aceites-expirados'] });
    });
  }, [profile?.empresa_id]);

  // Riscos aceitos (aprovados)
  const { data: riscos = [], isLoading } = useQuery({
    queryKey: ['riscos-aceitos', profile?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riscos')
        .select(SELECT_ACEITE)
        .eq('empresa_id', profile!.empresa_id)
        .eq('aceito', true)
        .order('data_aceite', { ascending: false });

      if (error) throw error;
      return await enrichWithNames(data || []);
    },
    enabled: !!profile?.empresa_id,
  });

  // Riscos pendentes de aprovação de aceite
  const { data: riscosPendentes = [], isLoading: isLoadingPendentes } = useQuery({
    queryKey: ['riscos-aceite-pendentes', profile?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riscos')
        .select(SELECT_ACEITE)
        .eq('empresa_id', profile!.empresa_id)
        .eq('status_aceite', 'pendente')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return await enrichWithNames(data || []);
    },
    enabled: !!profile?.empresa_id,
  });

  // Aceites expirados / invalidados (risco reaberto)
  const { data: riscosExpirados = [], isLoading: isLoadingExpirados } = useQuery({
    queryKey: ['riscos-aceites-expirados', profile?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riscos')
        .select(SELECT_ACEITE)
        .eq('empresa_id', profile!.empresa_id)
        .in('status_aceite', ['expirado', 'invalidado'])
        .order('aceite_valido_ate', { ascending: false });

      if (error) throw error;
      return await enrichWithNames(data || []);
    },
    enabled: !!profile?.empresa_id,
  });

  async function enrichWithNames(data: any[]) {
    const userIds = new Set<string>();
    data.forEach(r => {
      if (r.aprovador_aceite) userIds.add(r.aprovador_aceite);
      if (r.responsavel) userIds.add(r.responsavel);
    });

    let profileMap = new Map<string, string>();
    // `responsavel` guarda UUID OU texto livre. Mandar "TI" num `.in()` sobre
    // coluna `uuid` faz o Postgres recusar a consulta inteira — e o `error`
    // era descartado, portanto TODOS os nomes da aba desapareciam de uma vez.
    const idsValidos = filterUuids(Array.from(userIds));
    if (idsValidos.length > 0) {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, nome')
        .in('user_id', idsValidos);
      if (error) throw error;
      profiles?.forEach(p => profileMap.set(p.user_id, p.nome));
    }

    return data.map(r => ({
      ...r,
      aprovador_nome: r.aprovador_aceite ? profileMap.get(r.aprovador_aceite) || null : null,
      responsavel_nome: r.responsavel ? profileMap.get(r.responsavel) || null : null,
    }));
  }

  const getRevisaoStatus = (dataRevisao?: string): 'vencida' | 'proxima' | 'ok' | 'sem_data' => {
    if (!dataRevisao) return 'sem_data';
    const dias = differenceInCalendarDays(parseDataLocal(dataRevisao), new Date());
    if (dias < 0) return 'vencida';
    if (dias <= 7) return 'proxima';
    return 'ok';
  };

  const filteredRiscos = riscos.filter(r => {
    const matchesSearch = r.nome.toLowerCase().includes(searchTerm.toLowerCase());
    // `a || b || c === x` avalia como `a || b || (c === x)`: bastava ter nível
    // residual para a expressão dar verdadeiro, e o filtro nunca filtrava nada.
    const matchesNivel =
      !nivelFilter || nivelFilter === 'all' ||
      rotuloNivel(r.nivel_risco_residual || r.nivel_risco_inicial) === rotuloNivel(nivelFilter);
    const matchesRevisao = !revisaoFilter || revisaoFilter === 'all' || getRevisaoStatus(r.data_proxima_revisao) === revisaoFilter;
    return matchesSearch && matchesNivel && matchesRevisao;
  });

  const filteredPendentes = riscosPendentes.filter(r =>
    r.nome.toLowerCase().includes(searchTermPendente.toLowerCase())
  );

  const totalAceitos = riscos.length;
  const totalPendentes = riscosPendentes.length;
  const revisoesVencidas = riscos.filter(r => getRevisaoStatus(r.data_proxima_revisao) === 'vencida').length;
  const revisoesProximas = riscos.filter(r => getRevisaoStatus(r.data_proxima_revisao) === 'proxima').length;
  const aceitesAExpirar = riscos.filter(r => {
    if (!r.aceite_valido_ate) return false;
    const dias = differenceInCalendarDays(parseDataLocal(r.aceite_valido_ate), new Date());
    return dias >= 0 && dias <= 30;
  }).length;
  const totalExpirados = riscosExpirados.length;

  const filteredExpirados = riscosExpirados.filter(r =>
    r.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getValidadeBadge = (validoAte?: string) => {
    if (!validoAte) return <StatusBadge tone="neutral">{t('riscos.aceite.validity.none')}</StatusBadge>;
    const dias = differenceInCalendarDays(parseDataLocal(validoAte), new Date());
    if (dias < 0) return <StatusBadge tone="destructive">{t('riscos.aceite.validity.expired')}</StatusBadge>;
    if (dias <= 30) return <StatusBadge tone="warning">{dias}d</StatusBadge>;
    return <StatusBadge tone="success">{dias}d</StatusBadge>;
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['riscos-aceitos'] });
    queryClient.invalidateQueries({ queryKey: ['riscos-aceite-pendentes'] });
    queryClient.invalidateQueries({ queryKey: ['riscos-aceites-expirados'] });
    queryClient.invalidateQueries({ queryKey: ['riscos'] });
    queryClient.invalidateQueries({ queryKey: ['riscos-stats'] });
  };

  const handleRevogarAceite = async (risco: RiscoAceito) => {
    try {
      const { error } = await supabase
        .from('riscos')
        .update({ aceito: false, justificativa_aceite: null, data_aceite: null, aprovador_aceite: null, status_aceite: null })
        .eq('id', risco.id)
        .eq('empresa_id', profile!.empresa_id);

      if (error) throw error;
      toast({ title: t('riscos.aceite.toast.successTitle'), description: t('riscos.aceite.toast.revokeSuccess') });
      invalidateAll();
    } catch (error: any) {
      toast({ title: t('riscos.aceite.toast.errorTitle'), description: error.message, variant: "destructive" });
    }
  };

  const handleAgendarRevisao = async (risco: RiscoAceito, dias: number) => {
    const novaData = new Date();
    novaData.setDate(novaData.getDate() + dias);
    try {
      const { error } = await supabase
        .from('riscos')
        .update({ data_proxima_revisao: formatarDiaParaDB(novaData) })
        .eq('id', risco.id)
        .eq('empresa_id', profile!.empresa_id);

      if (error) throw error;
      toast({ title: t('riscos.aceite.toast.successTitle'), description: `${t('riscos.aceite.toast.reviewScheduled')} ${formatDateOnly(novaData.toISOString())}` });
      invalidateAll();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const columns: Array<Column<RiscoAceito>> = [
    { key: 'nome', label: t('riscos.aceite.columns.risk'), sortable: true, render: (value: any) => <span className="font-medium">{value}</span> },
    // Severidade efectiva, como na tabela de Riscos. Mostrar aqui a inerente
    // punha o mesmo risco com dois níveis diferentes em dois ecrãs.
    { key: 'nivel_risco_inicial', label: t('riscos.aceite.columns.level'), render: (_v: string, r: any) => { const n = r.nivel_risco_residual || r.nivel_risco_inicial; return <StatusBadge {...resolveNivelRiscoTone(n)}>{formatStatus(n)}</StatusBadge>; } },
    { key: 'justificativa_aceite', label: t('riscos.aceite.columns.justification'), render: (value: string) => value ? <span className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">{value}</span> : '-' },
    { key: 'data_aceite', label: t('riscos.aceite.columns.acceptDate'), sortable: true, render: (value: string) => value ? formatDateOnly(value) : '-' },
    { key: 'aprovador_nome', label: t('riscos.aceite.columns.approver'), render: (value: string) => value || '-' },
    {
      key: 'data_proxima_revisao', label: t('riscos.aceite.columns.review'), sortable: true,
      /* Só a data: o selo por baixo repetia o que ela já diz. */
      render: (value: string) => <span className="text-sm">{value ? formatDateOnly(value) : '-'}</span>,
    },
    {
      key: 'aceite_valido_ate', label: 'Válido até', sortable: true,
      render: (value: string) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm">{value ? formatDateOnly(value) : '-'}</span>
          {getValidadeBadge(value)}
        </div>
      ),
    },
    {
      key: 'actions', label: t('riscos.aceite.columns.actions'), className: 'w-[60px]',
      render: (_: any, risco: RiscoAceito) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><IconMore className="h-4 w-4" strokeWidth={1.5} /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedRisco(risco); setDetalheOpen(true); }}>
              <IconView className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.aceite.actions.viewDetails')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAgendarRevisao(risco, 30)}>
              <IconCalendarClock className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.aceite.actions.scheduleReview30')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAgendarRevisao(risco, 90)}>
              <IconCalendarClock className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.aceite.actions.scheduleReview90')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRevogarAceite(risco)} className="text-destructive focus:text-destructive">
              <IconError className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.aceite.actions.revoke')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const pendentesColumns: Array<Column<RiscoAceito>> = [
    { key: 'nome', label: t('riscos.aceite.columns.risk'), sortable: true, render: (value: any) => <span className="font-medium">{value}</span> },
    // Severidade efectiva, como na tabela de Riscos. Mostrar aqui a inerente
    // punha o mesmo risco com dois níveis diferentes em dois ecrãs.
    { key: 'nivel_risco_inicial', label: t('riscos.aceite.columns.level'), render: (_v: string, r: any) => { const n = r.nivel_risco_residual || r.nivel_risco_inicial; return <StatusBadge {...resolveNivelRiscoTone(n)}>{formatStatus(n)}</StatusBadge>; } },
    { key: 'justificativa_aceite', label: t('riscos.aceite.columns.justification'), render: (value: string) => value ? <span className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">{value}</span> : '-' },
    { key: 'aprovador_nome', label: t('riscos.aceite.columns.approver'), render: (value: string) => value || '-' },
    { key: 'data_proxima_revisao', label: t('riscos.aceite.columns.reviewDate'), render: (value: string) => value ? formatDateOnly(value) : '-' },
    {
      key: 'actions', label: t('riscos.aceite.columns.actions'), className: 'w-[60px]',
      render: (_: any, risco: RiscoAceito) => (
        <Button variant="outline" size="sm" onClick={() => { setAprovacaoRisco(risco); setAprovacaoOpen(true); }}>
          <IconView className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.aceite.actions.review')}
        </Button>
      ),
    },
  ];

  const filters = [
    {
      key: 'revisao', label: t('riscos.aceite.filters.reviewStatus'), type: 'select' as const,
      options: [
        { value: 'all', label: t('riscos.aceite.filters.all') }, { value: 'vencida', label: t('riscos.aceite.review.overdue') },
        { value: 'proxima', label: t('riscos.aceite.filters.upcoming7d') }, { value: 'ok', label: t('riscos.aceite.review.onTrack') },
        { value: 'sem_data', label: t('riscos.aceite.review.noDate') },
      ],
      value: revisaoFilter, onChange: (value: string) => setRevisaoFilter(value === 'all' ? '' : value),
    },
    {
      key: 'nivel', label: t('riscos.aceite.columns.level'), type: 'select' as const,
      // As faixas da matriz vigente, como na aba Tabela. A lista fixa
      // comparava com o texto gravado e não devolvia nada.
      options: [
        { value: 'all', label: t('riscos.aceite.filters.all') },
        ...[...(matriz?.niveis_risco ?? [])]
          .sort((a, b) => b.min - a.min)
          .map((n) => ({ value: n.nivel, label: n.nivel })),
      ],
      value: nivelFilter, onChange: (value: string) => setNivelFilter(value === 'all' ? '' : value),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AkurisPulse size={40} />
        <p className="text-sm text-muted-foreground">{t('riscos.page.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title={t('riscos.aceite.title')}
          description={t('riscos.aceite.description')}
        />
      )}

      <StatStrip
        items={[
          { key: 'aceitos', label: t('riscos.aceite.stats.acceptedTitle'), value: totalAceitos, icon: IconSuccess, hint: t('riscos.aceite.stats.acceptedDesc'), drillDown: 'riscos_aceite' },
          { key: 'pendentes', label: t('riscos.aceite.stats.pendingTitle'), value: totalPendentes, icon: IconTime, tone: 'warning', hint: t('riscos.aceite.stats.pendingDesc'), drillDown: 'riscos_aceite_pendentes' },
          { key: 'aExpirar', label: t('riscos.aceite.stats.expiringTitle'), value: aceitesAExpirar, icon: IconTimer, tone: 'warning', hint: t('riscos.aceite.stats.expiringDesc') },
          { key: 'expirados', label: t('riscos.aceite.stats.expiredTitle'), value: totalExpirados, icon: IconBan, tone: 'destructive', hint: t('riscos.aceite.stats.expiredDesc') },
          { key: 'revisoesVencidas', label: t('riscos.aceite.stats.overdueTitle'), value: revisoesVencidas, icon: IconCalendarClock, tone: 'destructive', hint: t('riscos.aceite.stats.overdueDesc'), drillDown: 'riscos_aceite_revisoes' },
          { key: 'revisoesProximas', label: t('riscos.aceite.stats.upcomingTitle'), value: revisoesProximas, icon: IconWarning, tone: 'warning', hint: t('riscos.aceite.stats.upcomingDesc') },
        ]}
      />

      <Tabs defaultValue={totalPendentes > 0 ? "pendentes" : "aceitos"} className="space-y-4">
        <TabsList className="h-auto bg-transparent p-0 gap-1 rounded-none border-b border-border w-full justify-start">
          <TabsTrigger
            value="pendentes"
            className="relative text-xs gap-1.5 px-3 py-2.5 -mb-px rounded-none border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold text-muted-foreground hover:text-foreground/85 transition-colors"
          >
            {t('riscos.aceite.tabs.pending')}
            {totalPendentes > 0 && (
              <StatusBadge tone="warning" className="ml-2">{totalPendentes}</StatusBadge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="aceitos"
            className="text-xs gap-1.5 px-3 py-2.5 -mb-px rounded-none border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold text-muted-foreground hover:text-foreground/85 transition-colors"
          >
            {t('riscos.aceite.tabs.accepted')} ({totalAceitos})
          </TabsTrigger>
          <TabsTrigger
            value="expirados"
            className="text-xs gap-1.5 px-3 py-2.5 -mb-px rounded-none border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold text-muted-foreground hover:text-foreground/85 transition-colors"
          >
            Aceites expirados ({totalExpirados})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                onRowClick={(risco) => { setSelectedRisco(risco); setDetalheOpen(true); }}
                data={filteredPendentes}
                columns={pendentesColumns}
                loading={isLoadingPendentes}
                searchable
                searchPlaceholder={t('riscos.aceite.searchPending')}
                searchValue={searchTermPendente}
                onSearchChange={setSearchTermPendente}
                emptyState={{
                  icon: <IconTime className="h-8 w-8" />,
                  title: t('riscos.aceite.empty.pendingTitle'),
                  description: t('riscos.aceite.empty.pendingDesc'),
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aceitos">
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                onRowClick={(risco) => { setSelectedRisco(risco); setDetalheOpen(true); }}
                data={filteredRiscos}
                columns={columns}
                loading={isLoading}
                searchable
                searchPlaceholder={t('riscos.aceite.searchAccepted')}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                filters={filters}
                emptyState={{
                  icon: <IconSuccess className="h-8 w-8" />,
                  title: t('riscos.aceite.empty.acceptedTitle'),
                  description: t('riscos.aceite.empty.acceptedDesc'),
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expirados">
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                onRowClick={(risco) => { setSelectedRisco(risco); setDetalheOpen(true); }}
                data={filteredExpirados}
                columns={columns.filter(c => c.key !== 'actions')}
                loading={isLoadingExpirados}
                searchable
                searchPlaceholder={t('riscos.aceite.searchAccepted')}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                emptyState={{
                  icon: <IconCalendarClock className="h-8 w-8" />,
                  title: 'Nenhum aceite expirado',
                  description: 'Aceites que ultrapassarem a validade aparecem aqui com o risco reaberto.',
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedRisco && (
        <AceiteDetalheDialog open={detalheOpen} onOpenChange={setDetalheOpen} risco={selectedRisco} />
      )}

      {aprovacaoRisco && (
        <AprovacaoRiscoDialog
          open={aprovacaoOpen}
          onOpenChange={setAprovacaoOpen}
          risco={aprovacaoRisco}
          onSuccess={() => { setAprovacaoOpen(false); invalidateAll(); }}
        />
      )}
    </div>
  );
}
