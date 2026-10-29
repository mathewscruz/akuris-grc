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

  const items: StatStripItem[] = sevs.map((sev) => {
    const label = t(`riscosVisoes.matrix.severityKpiRow.labels.${sev}`);
    const delta = trends?.[sev]?.delta;
    return {
      key: sev,
      label,
      value: counts[sev] ?? 0,
      tone: SEV_TONE[sev],
      series: series[sev],
      attentionPulse: sev === 'critico' && criticalArrival,
      context: delta == null ? undefined : t('riscosVisoes.matrix.severityKpiRow.vsMesAnterior'),
      hint: delta == null ? label : `${label} — ${t('riscosVisoes.matrix.severityKpiRow.vsMesAnterior')}: ${trendLabel(delta)}`,
      trend: delta === null || delta === undefined
        ? undefined
        : {
            label: trendLabel(delta),
            direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
            favorable: delta === 0 ? undefined : delta < 0,
          },
      onClick: onSelect ? () => onSelect(sev) : undefined,
    };
  });

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

  return <StatStrip items={[hero, ...items]} />;
}
