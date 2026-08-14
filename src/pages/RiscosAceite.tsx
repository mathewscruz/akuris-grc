import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, Column } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CheckCircle, AlertTriangle, Clock, CalendarX, MoreHorizontal, Eye, CalendarClock, XCircle } from 'lucide-react';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone, resolveRevisaoTone } from '@/lib/status-tone';
import { differenceInDays } from 'date-fns';
import { AceiteDetalheDialog } from '@/components/riscos/AceiteDetalheDialog';
import { AprovacaoRiscoDialog } from '@/components/riscos/AprovacaoRiscoDialog';
import { useLanguage } from '@/contexts/LanguageContext';

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

const SELECT_ACEITE = `
  id, nome, nivel_risco_inicial, nivel_risco_residual,
  justificativa_aceite, data_aceite, aprovador_aceite, aceite_valido_ate,
  data_proxima_revisao, responsavel, created_at, created_by, status_aceite
`;

export default function RiscosAceite({ embedded = false }: { embedded?: boolean } = {}) {
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
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nome')
        .in('user_id', Array.from(userIds));
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
    const dias = differenceInDays(new Date(dataRevisao), new Date());
    if (dias < 0) return 'vencida';
    if (dias <= 7) return 'proxima';
    return 'ok';
  };

  const filteredRiscos = riscos.filter(r => {
    const matchesSearch = r.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNivel = !nivelFilter || nivelFilter === 'all' || r.nivel_risco_inicial === nivelFilter;
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
    const dias = differenceInDays(new Date(r.aceite_valido_ate), new Date());
    return dias >= 0 && dias <= 30;
  }).length;
  const totalExpirados = riscosExpirados.length;

  const filteredExpirados = riscosExpirados.filter(r =>
    r.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getValidadeBadge = (validoAte?: string) => {
    if (!validoAte) return <StatusBadge size="sm" tone="neutral">Sem validade</StatusBadge>;
    const dias = differenceInDays(new Date(validoAte), new Date());
    if (dias < 0) return <StatusBadge size="sm" tone="destructive">Expirado</StatusBadge>;
    if (dias <= 30) return <StatusBadge size="sm" tone="warning">{dias}d</StatusBadge>;
    return <StatusBadge size="sm" tone="success">{dias}d</StatusBadge>;
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
        .update({ data_proxima_revisao: novaData.toISOString().split('T')[0] })
        .eq('id', risco.id)
        .eq('empresa_id', profile!.empresa_id);

      if (error) throw error;
      toast({ title: t('riscos.aceite.toast.successTitle'), description: `${t('riscos.aceite.toast.reviewScheduled')} ${formatDateOnly(novaData.toISOString())}` });
      invalidateAll();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const getRevisaoBadge = (dataRevisao?: string) => {
    const status = getRevisaoStatus(dataRevisao);
    if (status === 'sem_data') return <StatusBadge size="sm" tone="neutral">{t('riscos.aceite.review.noDate')}</StatusBadge>;
    if (!dataRevisao) return null;
    const dias = differenceInDays(new Date(dataRevisao), new Date());
    switch (status) {
      case 'vencida': return <StatusBadge size="sm" {...resolveRevisaoTone(dias)}>{t('riscos.aceite.review.overdue')}</StatusBadge>;
      case 'proxima': return <StatusBadge size="sm" {...resolveRevisaoTone(dias)}>{dias}{t('riscos.aceite.review.daysLeftSuffix')}</StatusBadge>;
      case 'ok': return <StatusBadge size="sm" {...resolveRevisaoTone(dias)}>{t('riscos.aceite.review.onTrack')}</StatusBadge>;
    }
  };

  const columns: Array<Column<RiscoAceito>> = [
    { key: 'nome', label: t('riscos.aceite.columns.risk'), sortable: true, render: (value: any) => <span className="font-medium">{value}</span> },
    { key: 'nivel_risco_inicial', label: t('riscos.aceite.columns.level'), render: (value: string) => <StatusBadge size="sm" {...resolveNivelRiscoTone(value)}>{formatStatus(value)}</StatusBadge> },
    { key: 'justificativa_aceite', label: t('riscos.aceite.columns.justification'), render: (value: string) => value ? <span className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">{value}</span> : '-' },
    { key: 'data_aceite', label: t('riscos.aceite.columns.acceptDate'), sortable: true, render: (value: string) => value ? formatDateOnly(value) : '-' },
    { key: 'aprovador_nome', label: t('riscos.aceite.columns.approver'), render: (value: string) => value || '-' },
    {
      key: 'data_proxima_revisao', label: t('riscos.aceite.columns.review'), sortable: true,
      render: (value: string) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm">{value ? formatDateOnly(value) : '-'}</span>
          {getRevisaoBadge(value)}
        </div>
      ),
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
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" strokeWidth={1.5} /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedRisco(risco); setDetalheOpen(true); }}>
              <Eye className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.aceite.actions.viewDetails')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAgendarRevisao(risco, 30)}>
              <CalendarClock className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.aceite.actions.scheduleReview30')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAgendarRevisao(risco, 90)}>
              <CalendarClock className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.aceite.actions.scheduleReview90')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRevogarAceite(risco)} className="text-destructive focus:text-destructive">
              <XCircle className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.aceite.actions.revoke')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const pendentesColumns: Array<Column<RiscoAceito>> = [
    { key: 'nome', label: t('riscos.aceite.columns.risk'), sortable: true, render: (value: any) => <span className="font-medium">{value}</span> },
    { key: 'nivel_risco_inicial', label: t('riscos.aceite.columns.level'), render: (value: string) => <StatusBadge size="sm" {...resolveNivelRiscoTone(value)}>{formatStatus(value)}</StatusBadge> },
    { key: 'justificativa_aceite', label: t('riscos.aceite.columns.justification'), render: (value: string) => value ? <span className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">{value}</span> : '-' },
    { key: 'aprovador_nome', label: t('riscos.aceite.columns.approver'), render: (value: string) => value || '-' },
    { key: 'data_proxima_revisao', label: t('riscos.aceite.columns.reviewDate'), render: (value: string) => value ? formatDateOnly(value) : '-' },
    {
      key: 'actions', label: t('riscos.aceite.columns.actions'), className: 'w-[60px]',
      render: (_: any, risco: RiscoAceito) => (
        <Button variant="outline" size="sm" onClick={() => { setAprovacaoRisco(risco); setAprovacaoOpen(true); }}>
          <Eye className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.aceite.actions.review')}
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
      options: [
        { value: 'all', label: t('riscos.aceite.filters.all') }, { value: 'Crítico', label: t('riscos.page.level.critico') },
        { value: 'Muito Alto', label: t('riscos.page.level.muitoAlto') }, { value: 'Alto', label: t('riscos.page.level.alto') },
        { value: 'Médio', label: t('riscos.page.level.medio') }, { value: 'Baixo', label: t('riscos.page.level.baixo') },
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('riscos.aceite.stats.acceptedTitle')} value={totalAceitos} description={t('riscos.aceite.stats.acceptedDesc')} icon={<CheckCircle />} variant="success" drillDown="riscos_aceite" showAccent emptyHint={t('riscos.aceite.stats.acceptedEmptyHint')} />
        <StatCard title={t('riscos.aceite.stats.pendingTitle')} value={totalPendentes} description={t('riscos.aceite.stats.pendingDesc')} icon={<Clock />} variant={totalPendentes > 0 ? "warning" : "default"} drillDown="riscos_aceite" />
        <StatCard title={t('riscos.aceite.stats.overdueTitle')} value={revisoesVencidas} description={t('riscos.aceite.stats.overdueDesc')} icon={<CalendarX />} variant={revisoesVencidas > 0 ? "destructive" : "default"} drillDown="riscos_aceite" />
        <StatCard title={t('riscos.aceite.stats.upcomingTitle')} value={revisoesProximas} description={t('riscos.aceite.stats.upcomingDesc')} icon={<AlertTriangle />} variant={revisoesProximas > 0 ? "warning" : "default"} />
      </div>

      <Tabs defaultValue={totalPendentes > 0 ? "pendentes" : "aceitos"} className="space-y-4">
        <TabsList className="h-auto bg-transparent p-0 gap-1 rounded-none border-b border-border w-full justify-start">
          <TabsTrigger
            value="pendentes"
            className="relative text-xs gap-1.5 px-3 py-2.5 -mb-px rounded-none border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold text-muted-foreground hover:text-foreground/85 transition-colors"
          >
            {t('riscos.aceite.tabs.pending')}
            {totalPendentes > 0 && (
              <StatusBadge size="sm" tone="warning" className="ml-2">{totalPendentes}</StatusBadge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="aceitos"
            className="text-xs gap-1.5 px-3 py-2.5 -mb-px rounded-none border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold text-muted-foreground hover:text-foreground/85 transition-colors"
          >
            {t('riscos.aceite.tabs.accepted')} ({totalAceitos})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-5 data-[state=active]:animate-fade-in">
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                data={filteredPendentes}
                columns={pendentesColumns}
                loading={isLoadingPendentes}
                searchable
                searchPlaceholder={t('riscos.aceite.searchPending')}
                searchValue={searchTermPendente}
                onSearchChange={setSearchTermPendente}
                emptyState={{
                  icon: <Clock className="h-8 w-8" />,
                  title: t('riscos.aceite.empty.pendingTitle'),
                  description: t('riscos.aceite.empty.pendingDesc'),
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aceitos" className="mt-5 data-[state=active]:animate-fade-in">
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                data={filteredRiscos}
                columns={columns}
                loading={isLoading}
                searchable
                searchPlaceholder={t('riscos.aceite.searchAccepted')}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                filters={filters}
                emptyState={{
                  icon: <CheckCircle className="h-8 w-8" />,
                  title: t('riscos.aceite.empty.acceptedTitle'),
                  description: t('riscos.aceite.empty.acceptedDesc'),
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
