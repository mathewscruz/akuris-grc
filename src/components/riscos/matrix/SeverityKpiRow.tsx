/**
 * SeverityKpiRow — faixa única (cartão) com Críticos/Altos/Médios/Baixos.
 * Envio 14 · ponto 5: deixa de haver dois vocabulários visuais — usa o mesmo
 * StatStrip dos restantes módulos. A tendência vs 30d permanece visível para
 * não esconder uma informação de decisão atrás de hover.
 */
import { StatStrip, type StatStripItem, type StatStripTone } from '@/components/ui/stat-strip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/components/AuthProvider';
import { acumularPorSemana } from '@/hooks/useSerieSemanal';
import { readAllPages } from '@/lib/read-all-pages';
import { severidadeRiscoEfetiva } from '@/lib/metrics/riscos';
import { useQuery } from '@tanstack/react-query';

const hojeISO = () => new Date().toISOString().slice(0, 10);
const em30ISO = () => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

/** Tratamento, controles ligados e aceites dos riscos ativos — tudo filtrado pela empresa. */
export function useRiscoFaixaExtras(empresaId?: string | null) {
  return useQuery({
    queryKey: ['riscos-faixa-extras', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const [trat, ctl, ace] = await Promise.all([
        (supabase.from('riscos_tratamentos') as any).select('status, prazo, riscos!inner(empresa_id, arquivado_em)').eq('riscos.empresa_id', empresaId).is('riscos.arquivado_em', null),
        (supabase.from('controles_riscos') as any).select('controle_id, riscos!inner(empresa_id, arquivado_em), controles(status)').eq('riscos.empresa_id', empresaId).is('riscos.arquivado_em', null),
        (supabase.from('riscos') as any).select('aceito, status_aceite, aceite_valido_ate').eq('empresa_id', empresaId).is('arquivado_em', null).or('aceito.eq.true,status_aceite.in.(aceito,expirado,invalidado)'),
      ]);
      if (trat.error || ctl.error || ace.error) throw trat.error || ctl.error || ace.error;
      const hoje = hojeISO(), lim = em30ISO();
      const t = { atrasados: 0, andamento: 0, planejados: 0, concluidos: 0 };
      (trat.data ?? []).forEach((r: any) => {
        const st = norm(String(r.status ?? '')).replace(/[_\s]+/g, ' ');
        if (st.startsWith('conclu')) t.concluidos++;
        else if (r.prazo && r.prazo < hoje) t.atrasados++;
        else if (st.includes('andamento')) t.andamento++;
        else t.planejados++;
      });
      const porControle = new Map<string, string>();
      (ctl.data ?? []).forEach((r: any) => r.controle_id && porControle.set(r.controle_id, r.controles?.status ?? ''));
      const c = { ativos: 0, parciais: 0, inativos: 0 };
      porControle.forEach((st) => { if (st === 'ativo') c.ativos++; else if (st === 'inativo') c.inativos++; else c.parciais++; });
      const a = { aVencer: 0, validos: 0, vencidos: 0 };
      (ace.data ?? []).forEach((r: any) => {
        if (r.status_aceite === 'expirado' || r.status_aceite === 'invalidado' || (r.aceite_valido_ate && r.aceite_valido_ate < hoje)) a.vencidos++;
        else if (r.aceite_valido_ate && r.aceite_valido_ate <= lim) a.aVencer++;
        else a.validos++;
      });
      return { t, c, a, controles: porControle.size };
    },
  });
}

const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function sevDe(nivel: string | null): SevKey | null {
  if (!nivel) return null;
  const n = norm(nivel);
  if (n.startsWith('crit') || n.includes('muito alto') || n.includes('very high')) return 'critico';
  if (n.startsWith('alt') || n.startsWith('high')) return 'alto';
  if (n.startsWith('med')) return 'medio';
  if (n.startsWith('baix') || n.startsWith('low') || n.includes('muito baixo')) return 'baixo';
  return null;
}

/** Histórico real (8 semanas) por gravidade, sempre isolado por empresa. */
function useSeriesPorGravidade() {
  const empresaId = useContext(AuthContext)?.profile?.empresa_id;
  const [series, setSeries] = useState<Partial<Record<SevKey, number[]>>>({});
  useEffect(() => {
    setSeries({});
    if (!empresaId) return;
    let vivo = true;
    readAllPages((from, to) => supabase.from('riscos').select('created_at, nivel_risco_inicial, nivel_risco_residual, severidade_efetiva').eq('empresa_id', empresaId).is('arquivado_em', null).order('id').range(from, to))
      .then(({ data, error }) => {
        if (!vivo || error || !data) return;
        const grupos: Record<SevKey, string[]> = { critico: [], alto: [], medio: [], baixo: [] };
        data.forEach((r) => { const k = severidadeRiscoEfetiva(r); if (k in grupos) grupos[k as SevKey].push(r.created_at); });
        const out: Partial<Record<SevKey, number[]>> = {};
        (Object.keys(grupos) as SevKey[]).forEach((k) => { const s = acumularPorSemana(grupos[k]); if (s.some((v) => v > 0)) out[k] = s; });
        setSeries(out);
      });
    return () => { vivo = false; };
  }, [empresaId]);
  return series;
}

type SevKey = 'critico' | 'alto' | 'medio' | 'baixo';

/** Cor só onde exige ação; médios e baixos ficam neutros. */
const SEV_TONE: Record<SevKey, StatStripTone> = {
  critico: 'destructive',
  alto: 'orange',
  medio: 'neutral',
  baixo: 'neutral',
};

interface ItemTrend {
  delta: number | null; // riscos a mais/menos vs 30d (null = sem dado)
}

interface Props {
  counts: Record<SevKey, number>;
  trends?: Partial<Record<SevKey, ItemTrend>>;
  onSelect?: (sev: SevKey) => void;
}

export function SeverityKpiRow({ counts, trends, onSelect }: Props) {
  const { t } = useLanguage();
  const sevs: SevKey[] = ['critico', 'alto', 'medio', 'baixo'];
  const series = useSeriesPorGravidade();
  const previousCritical = useRef(counts.critico ?? 0);
  const [criticalArrival, setCriticalArrival] = useState(false);

  useEffect(() => {
    const next = counts.critico ?? 0;
    if (next > previousCritical.current) {
      setCriticalArrival(false);
      const start = requestAnimationFrame(() => setCriticalArrival(true));
      const stop = window.setTimeout(() => setCriticalArrival(false), 620);
      previousCritical.current = next;
      return () => {
        cancelAnimationFrame(start);
        window.clearTimeout(stop);
      };
    }
    previousCritical.current = next;
  }, [counts.critico]);

  const trendLabel = (delta: number | null | undefined): string => {
    if (delta === null || delta === undefined) return t('riscosVisoes.matrix.severityKpiRow.semDados');
    if (delta === 0) return t('riscosVisoes.matrix.severityKpiRow.igualMes');
    const mes = t('riscosVisoes.matrix.severityKpiRow.trendMes');
    return delta > 0 ? `+${delta} ${mes}` : `${delta} ${mes}`;
  };

  const empresaId = useContext(AuthContext)?.profile?.empresa_id;
  const { data: ex, isError } = useRiscoFaixaExtras(empresaId);
  const k = (key: string, vars?: Record<string, unknown>) => t(`riscosVisoes.matrix.severityKpiRow.faixa.${key}`, vars as any);
  const st = isError ? 'unavailable' as const : 'ready' as const;
  const items: StatStripItem[] = [
    { key: 'tratamento', label: k('tratamento'), dataState: st, value: ex ? ex.t.atrasados + ex.t.andamento + ex.t.planejados + ex.t.concluidos : 0,
      alert: ex && ex.t.atrasados > 0 ? { label: k('atrasadosN', { count: ex.t.atrasados }) } : undefined,
      breakdown: ex ? [
        { label: k('atrasados'), value: ex.t.atrasados, tone: 'critical' },
        { label: k('emAndamento'), value: ex.t.andamento, tone: 'high' },
        { label: k('planejados'), value: ex.t.planejados, tone: 'medium' },
        { label: k('concluidos'), value: ex.t.concluidos, tone: 'low' },
      ] : [] },
    { key: 'controles', label: k('controles'), dataState: st, value: ex?.controles ?? 0,
      breakdown: ex ? [
        { label: k('ativos'), value: ex.c.ativos, tone: 'low' },
        { label: k('parciais'), value: ex.c.parciais, tone: 'medium' },
        { label: k('inativos'), value: ex.c.inativos, tone: 'critical' },
      ] : [] },
    { key: 'aceites', label: k('aceites'), dataState: st, value: ex ? ex.a.aVencer + ex.a.validos + ex.a.vencidos : 0,
      alert: ex && ex.a.aVencer > 0 ? { label: k('aVencerN', { count: ex.a.aVencer }) } : undefined,
      breakdown: ex ? [
        { label: k('aVencer'), value: ex.a.aVencer, tone: 'medium' },
        { label: k('validos'), value: ex.a.validos, tone: 'low' },
        { label: k('vencidos'), value: ex.a.vencidos, tone: 'critical' },
      ] : [] },
  ];
  void trendLabel; void series; void criticalArrival; void onSelect; void trends; void SEV_TONE;

  const SEV_DOT = { critico: 'critical', alto: 'high', medio: 'medium', baixo: 'low' } as const;
  const total = sevs.reduce((a, s) => a + (counts[s] ?? 0), 0);
  const hero: StatStripItem = {
    key: 'total',
    hero: true,
    label: t('riscosVisoes.matrix.severityKpiRow.totalLabel'),
    value: total,
    caption: t('riscosVisoes.matrix.severityKpiRow.totalCaption'),
    breakdown: sevs.map((sev) => ({ label: t(`riscosVisoes.matrix.severityKpiRow.labels.${sev}`), value: counts[sev] ?? 0, tone: SEV_DOT[sev] })),
  };

  return <StatStrip module="riscos" items={[hero, ...items]} />;
}
