import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { TrendAreaChart, type TrendBreakdown } from '@/components/ui/trend-area-chart';
import { PeriodoSelect, type OpcaoPeriodo } from '@/components/ui/periodo-select';
import { SegmentedBar, type Segmento } from '@/components/ui/segmented-bar';
import { PanelAction } from '@/components/ui/panel-action';
import { useRiscosStats } from '@/hooks/useRiscosStats';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAppLocale } from '@/lib/i18n-locale';
import { IconChartLine } from '@/components/icons';
import { useMatrizConfigEmpresa } from '@/hooks/useMatrizConfigEmpresa';
import { apetiteScoreDaConfig } from '@/components/riscos/matriz-config';
import {
  avaliacoesPorRisco,
  avaliacaoVigente,
  jaExistiaEm,
  type AvaliacaoNoTempo,
} from '@/lib/risco-vigente';

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface PointData {
  date: string;
  /** Score médio da carteira no fim do período. `null` sem riscos avaliados. */
  score: number | null;
  /** Riscos acima do apetite — o número que dispara o alerta. */
  acima: number;
  total: number;
  criticos: number;
  altos: number;
}

/**
 * A meta de riscos acima do apetite é zero — não há outro número defensável.
 *
 * O que estava aqui era um índice 0–100: a média das severidades ponderada
 * (crítico 4, alto 3, médio 2, baixo 1), normalizada pelo pior caso, com meta
 * fixa em 20. Sendo uma média, cadastrar riscos BAIXOS melhorava o número — o
 * painel premiava aumentar a carteira sem tratar nada. E `bucketOf`
 * classificava por `nivel.includes('alt')`, a quarta leitura de rótulo do
 * produto, cega a qualquer faixa renomeada.
 *
 * Passa a ser a mesma contagem da aba Visão geral: riscos cujo score excede o
 * apetite da matriz vigente.
 */
const GOAL_VALUE = 0;

export function RiskScoreTimeline() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<TimeRange>('monthly');
  const { data: matriz } = useMatrizConfigEmpresa();
  const apetite = apetiteScoreDaConfig(matriz);
  // Mesma chave de query do painel: a composição não custa um pedido extra.
  const { data: stats } = useRiscosStats();

  const { data: base, isLoading } = useQuery({
    queryKey: ['riscos-timeline', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return { riscos: [], historico: [] };
      const { data: riscos, error } = await supabase
        .from('riscos')
        .select('id, score_inicial, severidade_inicial, created_at')
        .eq('empresa_id', profile.empresa_id);
      if (error) throw error;

      /*
        O histórico é o que faz a curva poder DESCER.

        Sem ele, a série aplicava a severidade de hoje a todos os meses desde a
        criação do risco: tratar um risco de Crítico para Baixo não movia o
        gráfico nenhum — só cadastrar riscos novos movia. Ver `risco-vigente.ts`.
      */
      const ids = (riscos || []).map((r) => r.id);
      let historico: AvaliacaoNoTempo[] = [];
      if (ids.length > 0) {
        const { data: hist, error: histErr } = await supabase
          .from('riscos_historico_avaliacoes')
          .select('risco_id, created_at, score, severidade, tipo')
          .in('risco_id', ids)
          .order('created_at', { ascending: true });
        if (histErr) throw histErr;
        historico = (hist || []) as AvaliacaoNoTempo[];
      }
      return { riscos: riscos || [], historico };
    },
    enabled: !!profile?.empresa_id,
    staleTime: 5 * 60 * 1000,
  });

  const riscos = base?.riscos;
  const historico = base?.historico;

  /**
   * Só os períodos que a empresa tem histórico para preencher.
   *
   * Eram sempre quatro. Numa empresa com quatro meses de vida, "Ano" desenhava
   * cinco pontos anuais com quatro vazios, e "Dia" sete dias em que nada
   * aconteceu — dois gráficos em branco a um clique de distância do painel
   * principal, oferecidos como se tivessem conteúdo. Um selector que leva a
   * um ecrã vazio ensina a não clicar em selectores.
   */
  const idadeEmDias = useMemo(() => {
    if (!riscos || riscos.length === 0) return 0;
    const maisAntigo = Math.min(...riscos.map((r) => new Date(r.created_at).getTime()));
    return Math.floor((Date.now() - maisAntigo) / 86400000);
  }, [riscos]);

  const periods = useMemo(() => {
    const todos: { value: TimeRange; label: string; minDias: number }[] = [
      { value: 'daily', label: t('dashWidgets.timeline.day'), minDias: 7 },
      { value: 'weekly', label: t('dashWidgets.timeline.week'), minDias: 21 },
      { value: 'monthly', label: t('dashWidgets.timeline.month'), minDias: 0 },
      { value: 'yearly', label: t('dashWidgets.timeline.year'), minDias: 365 },
    ];
    // O mês fica sempre: é o padrão e tem de haver para onde voltar.
    return todos.filter((p) => p.value === 'monthly' || idadeEmDias >= p.minDias);
  }, [idadeEmDias, t]);

  // Se o período escolhido deixar de estar disponível, volta ao mês.
  useEffect(() => {
    if (!periods.some((p) => p.value === period)) setPeriod('monthly');
  }, [periods, period]);

  const intlLocale = getAppLocale() === 'en' ? 'en-US' : 'pt-BR';

  const { displayData, latestScore, delta, totalAtual } = useMemo(() => {
    const empty = {
      displayData: [] as PointData[],
      latestScore: null as number | null,
      delta: null as null | { value: number; dir: 'up' | 'down' | 'flat' },
      totalAtual: 0,
    };
    if (!riscos || riscos.length === 0) return empty;

    const now = new Date();
    const buckets: { end: Date; label: string }[] = [];

    if (period === 'daily') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(23, 59, 59, 999);
        buckets.push({ end: d, label: d.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short' }) });
      }
    } else if (period === 'weekly') {
      for (let i = 3; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        d.setHours(23, 59, 59, 999);
        buckets.push({ end: d, label: t('dashWidgets.timeline.weekShort', { n: 4 - i }) });
      }
    } else if (period === 'monthly') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        buckets.push({ end: d, label: d.toLocaleDateString(intlLocale, { month: 'short' }) });
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59);
        buckets.push({ end: d, label: d.getFullYear().toString() });
      }
    }

    /*
      A severidade de cada risco é a que VIGORAVA no fim daquele período — a
      última reavaliação registada até lá, ou o nível inicial se ainda não
      tinha sido reavaliado. Antes usava-se `nivel_risco_residual` de hoje para
      todos os meses passados, e por isso a linha nunca podia cair.
    */
    const porRisco = avaliacoesPorRisco(historico ?? []);

    const points: PointData[] = buckets.map(({ end, label }) => {
      let acima = 0;
      let criticos = 0;
      let altos = 0;
      let existentes = 0;
      let somaScores = 0;
      for (const r of riscos) {
        if (!jaExistiaEm(r.created_at, end)) continue;
        const vigente = avaliacaoVigente(porRisco.get(r.id), end);
        const score = vigente?.score ?? r.score_inicial;
        const sev = vigente?.severidade ?? r.severidade_inicial;
        if (score === null || score === undefined) continue; // ainda por avaliar
        existentes += 1;
        somaScores += score;
        if (apetite !== null && score > apetite) acima += 1;
        if (sev === 'critico') criticos += 1;
        if (sev === 'alto') altos += 1;
      }
      return {
        date: label,
        score: existentes === 0 ? null : Math.round((somaScores / existentes) * 10) / 10,
        acima,
        total: existentes,
        criticos,
        altos,
      };
    });

    // Filtra pontos sem dados para computar last/delta — mas mantém os null no chart (gap visual).
    const valid = points.filter((p) => p.score !== null) as (PointData & { score: number })[];
    if (valid.length === 0) return empty;

    const last = valid[valid.length - 1];
    const prev = valid[valid.length - 2];
    const diff = prev ? Math.round((last.score - prev.score) * 10) / 10 : 0;
    return {
      displayData: points,
      latestScore: last.score,
      // Em exposição, queda (diff < 0) é BOM. Invertemos a direção visual.
      delta: !prev
        ? null
        : Math.abs(diff) < 0.5
        ? { value: 0, dir: 'flat' as const }
        : { value: diff, dir: diff < 0 ? ('down' as const) : ('up' as const) },
      totalAtual: last.total,
    };
  }, [riscos, historico, period, intlLocale, t, apetite]);

  /**
   * O tooltip mostra a repartição do período: quantos excedem o apetite e
   * quantos ficam dentro. Os dois números já vinham calculados por bucket —
   * só não havia onde os mostrar, e o tooltip antigo escrevia "· 2 crít · 5
   * altos" numa linha de texto corrido.
   */
  const divisaoDoPonto = (i: number): TrendBreakdown[] => {
    const p = displayData[i];
    if (!p || p.score === null) return [];
    return [
      { label: t('dashWidgets.timeline.aboveAppetite'), valor: p.acima, tom: 'destaque' },
      {
        label: t('dashWidgets.timeline.withinAppetite'),
        valor: Math.max(p.total - p.acima, 0),
        tom: 'neutro',
      },
    ];
  };

  if (isLoading) {
    return (
      <Card className="relative h-full w-full flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.riskEvolution')}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[260px] flex flex-col items-center justify-center gap-2">
          <AkurisPulse size={56} />
          <p className="text-xs text-muted-foreground">{t('dashWidgets.timeline.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  if (displayData.length === 0 || latestScore === null) {
    return (
      <Card className="relative h-full w-full flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.riskEvolution')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[260px] gap-3 rounded-lg border border-dashed border-border bg-muted/20">
            <IconChartLine className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-center space-y-1 max-w-[280px]">
              <p className="text-sm font-medium text-foreground">{t('dashWidgets.timeline.emptyTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('dashWidgets.timeline.emptyDescription')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalDoPonto = (i: number) => displayData[i]?.total ?? 0;
  const acimaAtual = displayData.length
    ? displayData[displayData.length - 1].acima
    : 0;

  const opcoesPeriodo: OpcaoPeriodo<TimeRange>[] = periods.map((p) => ({
    value: p.value,
    label: p.label,
  }));

  // Sem parâmetro de tipo no JSX (`<PeriodoSelect<TimeRange> …>`): é TSX
  // válido e o `tsc` aceita-o, mas o SWC do plugin do Lovable falha a
  // analisá-lo. O tipo vem da anotação de `opcoesPeriodo`.
  const seletorPeriodo = (
    <PeriodoSelect valor={period} onChange={(v: TimeRange) => setPeriod(v)} opcoes={opcoesPeriodo} />
  );

  /*
    A composição da carteira, numa barra só.

    A curva diz para onde a carteira vai; isto diz de que é feita hoje. Antes
    os mesmos números só existiam como texto no tooltip do gráfico e como
    linha de apoio noutro cartão — em nenhum dos dois sítios se via a
    proporção, que é o que decide se "7 altos" é muito.

    Só a severidade tem escala semântica: o resto do conjunto vai a cinzento.
  */
  const outros = Math.max((stats?.medios ?? 0) + (stats?.baixos ?? 0), 0);
  const segmentos: Segmento[] = [
    {
      id: 'critico',
      label: t('dashWidgets.timeline.sevCritico'),
      valor: stats?.criticos ?? 0,
      cor: 'bg-severity-critical',
      onClick: () => navigate('/riscos?nivel=critico'),
    },
    {
      id: 'alto',
      label: t('dashWidgets.timeline.sevAlto'),
      valor: stats?.altos ?? 0,
      cor: 'bg-severity-high',
      onClick: () => navigate('/riscos?nivel=alto'),
    },
    {
      // Médio e baixo juntos: não há um valor de nível que os cubra aos dois,
      // e prometer um filtro que não existe é pior do que não o oferecer.
      id: 'outros',
      label: t('dashWidgets.timeline.sevOutros'),
      valor: outros,
      cor: 'bg-muted-foreground/30',
    },
  ];

  const composicao =
    stats && stats.total > 0 ? (
      <SegmentedBar
        segmentos={segmentos}
        resumo={t('dashWidgets.timeline.resumoComposicao', {
          total: stats.total,
          criticos: stats.criticos,
          altos: stats.altos,
        })}
      />
    ) : null;

  return (
    <TrendAreaChart
      className="h-full w-full"
      eyebrow={t('dashboard.riskEvolution')}
      valor={latestScore}
      sufixo={t('dashWidgets.timeline.sufixoScoreMedio')}
      delta={delta ? delta.value : null}
      pontos={displayData.map((p) => ({ label: p.date, valor: p.score }))}
      tooltipLabel={t('dashWidgets.timeline.tooltipTotal')}
      divisao={divisaoDoPonto}
      tooltipValor={totalDoPonto}
      seletor={seletorPeriodo}
      resumo={composicao}
      rodape={
        <PanelAction
          limpo={acimaAtual === 0}
          onClick={() => navigate('/riscos')}
        >
          {acimaAtual === 0
            ? t('dashWidgets.timeline.dentroDoApetite')
            : t('dashWidgets.timeline.acimaDoApetiteAcao', { count: acimaAtual })}
        </PanelAction>
      }
    />
  );
}
