import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { ScoreRing } from '@/components/ui/executive-summary';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Chip } from '@/components/ui/chip';
import { CHART_SEVERITY } from '@/lib/chart-tokens';
import { operationalScoreColor } from '@/lib/operational-score-color';
import { useGrcMaturityScore } from '@/hooks/useGrcMaturityScore';
import { cn } from '@/lib/utils';
import { BentoTile, BentoEmpty } from './BentoTile';
import { diasAte, severidadeCelula, urgenciaContrato } from './bento-utils';

export function IndiceTile({ delay }: { delay?: number }) {
  const { t } = useLanguage();
  const m = useGrcMaturityScore();
  const temDados = m.status !== 'no_data';
  return (
    <BentoTile title={t('bento.index.title')} description={t('bento.index.desc')} delay={delay}>
      {temDados ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
          <ScoreRing value={m.score} label={t('bento.index.title')} colorScale="operational" className="h-36 w-36" />
          <p className="text-2xl font-semibold" style={{ color: operationalScoreColor(m.score) }}>{m.label}</p>
        </div>
      ) : <BentoEmpty>{t('bento.index.empty')}</BentoEmpty>}
    </BentoTile>
  );
}

export function RiscosTile({ delay }: { delay?: number }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const empresaId = useAuth().profile?.empresa_id;
  const { data, isLoading } = useQuery({
    queryKey: ['bento-riscos-mapa', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from('riscos')
        .select('probabilidade_inicial, impacto_inicial').eq('empresa_id', empresaId!);
      if (error) throw error;
      const grid = Array.from({ length: 5 }, () => Array(5).fill(0) as number[]);
      for (const r of data ?? []) {
        const p = Number(r.probabilidade_inicial), i = Number(r.impacto_inicial);
        if (p >= 1 && p <= 5 && i >= 1 && i <= 5) grid[i - 1][p - 1]++;
      }
      return grid;
    },
  });
  const total = data?.flat().reduce((a, b) => a + b, 0) ?? 0;
  return (
    <BentoTile title={t('bento.risks.title')} description={t('bento.risks.desc')} href="/riscos" delay={delay}>
      {isLoading ? <AkurisPulse /> : total === 0 ? <BentoEmpty>{t('bento.risks.empty')}</BentoEmpty> : (
        <div className="flex flex-1 items-stretch gap-2">
          <span className="flex items-center text-[10px] uppercase tracking-wider text-muted-foreground [writing-mode:vertical-rl] rotate-180">{t('bento.risks.impact')}</span>
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="grid flex-1 grid-cols-5 gap-1.5">
              {[5, 4, 3, 2, 1].flatMap((i) => [1, 2, 3, 4, 5].map((p) => {
                const n = data![i - 1][p - 1];
                const sev = severidadeCelula(p, i);
                return (
                  <button key={`${p}-${i}`} type="button" onClick={() => navigate(`/riscos?prob=${p}&imp=${i}`)}
                    aria-label={t('bento.risks.cell', { count: n, p, i })} title={t('bento.risks.cell', { count: n, p, i })}
                    className="flex aspect-square min-h-8 items-center justify-center rounded-md border border-border text-sm font-semibold tabular-nums transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    style={{ backgroundColor: n ? `color-mix(in oklab, ${CHART_SEVERITY[sev]} ${Math.min(25 + n * 12, 70)}%, transparent)` : undefined }}>
                    {n || ''}
                  </button>
                );
              }))}
            </div>
            <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">{t('bento.risks.prob')}</p>
          </div>
        </div>
      )}
    </BentoTile>
  );
}

export function PlanosTile({ pendentes, atrasados, concluidos, delay }: { pendentes: number; atrasados: number; concluidos: number; delay?: number }) {
  const { t } = useLanguage();
  const noPrazo = Math.max(0, pendentes - atrasados);
  const total = noPrazo + atrasados + concluidos;
  const fatias = [
    { k: 'onTime', v: noPrazo, c: 'hsl(var(--good))' },
    { k: 'late', v: atrasados, c: 'hsl(var(--destructive))' },
    { k: 'done', v: concluidos, c: 'hsl(var(--muted-foreground))' },
  ];
  return (
    <BentoTile title={t('bento.plans.title')} description={t('bento.plans.desc')} href="/planos-acao" delay={delay}>
      {total === 0 ? <BentoEmpty>{t('bento.plans.empty')}</BentoEmpty> : (
        <div className="flex flex-1 items-center gap-5">
          <div className="relative h-28 w-28 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={fatias} dataKey="v" innerRadius="70%" outerRadius="100%" stroke="none" paddingAngle={2}>
                  {fatias.map((f) => <Cell key={f.k} fill={f.c} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums">{total}</span>
              <span className="text-[10px] text-muted-foreground">{t('bento.plans.total')}</span>
            </div>
          </div>
          <ul className="flex-1 space-y-2 text-sm">
            {fatias.map((f) => (
              <li key={f.k} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: f.c }} />
                <span className="flex-1 text-muted-foreground">{t(`bento.plans.${f.k}`)}</span>
                <span className="font-semibold tabular-nums">{f.v}</span>
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round((f.v / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BentoTile>
  );
}

export function IncidentesTile({ emCurso, criticos, altos, delay }: { emCurso: number; criticos: number; altos: number; delay?: number }) {
  const { t } = useLanguage();
  const outros = Math.max(0, emCurso - criticos - altos);
  return (
    <BentoTile title={t('bento.incidents.title')} description={t('bento.incidents.desc')} href="/incidentes" delay={delay}>
      {emCurso === 0 ? <BentoEmpty>{t('bento.incidents.empty')}</BentoEmpty> : (
        <div className="space-y-3">
          <p className="flex items-baseline gap-2"><span className="text-4xl font-semibold tabular-nums">{emCurso}</span><span className="text-sm text-muted-foreground">{t('bento.incidents.inProgress')}</span></p>
          <div className="flex flex-wrap gap-2">
            <Chip family="severity" tone="critical">{t('bento.incidents.critical')} · {criticos}</Chip>
            <Chip family="severity" tone="high">{t('bento.incidents.high')} · {altos}</Chip>
            <Chip family="state" tone="neutral">{t('bento.incidents.others')} · {outros}</Chip>
          </div>
        </div>
      )}
    </BentoTile>
  );
}

export function ContratosTile({ delay }: { delay?: number }) {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const empresaId = useAuth().profile?.empresa_id;
  const { hoje, limite } = useMemo(() => {
    const d = new Date(); const f = new Date(); f.setDate(f.getDate() + 90);
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    return { hoje: iso(d), limite: iso(f) };
  }, []);
  const { data, isLoading } = useQuery({
    queryKey: ['bento-contratos-vencer', empresaId, hoje],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from('contratos')
        .select('id, nome, data_fim, fornecedores(nome)')
        .eq('empresa_id', empresaId!).eq('status', 'ativo')
        .gte('data_fim', hoje).lte('data_fim', limite)
        .order('data_fim').limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
  const fmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' });
  return (
    <BentoTile title={t('bento.contracts.title')} description={t('bento.contracts.desc')} href="/contratos" delay={delay}>
      {isLoading ? <AkurisPulse /> : !data?.length ? <BentoEmpty>{t('bento.contracts.empty')}</BentoEmpty> : (
        <ol className="relative space-y-3 border-l border-border pl-4">
          {data.map((c: any) => {
            const dias = diasAte(c.data_fim);
            const urg = urgenciaContrato(dias);
            return (
              <li key={c.id}>
                <button type="button" onClick={() => navigate(`/contratos?focus=${c.id}`)} className="group flex w-full items-center gap-3 text-left">
                  <span aria-hidden className={cn('absolute -left-[5px] h-2.5 w-2.5 rounded-full border-2 border-card',
                    urg === 'urgente' ? 'bg-destructive' : urg === 'proximo' ? 'bg-warning' : 'bg-muted-foreground')} />
                  <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">{fmt.format(new Date(c.data_fim + 'T12:00:00'))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium group-hover:text-primary">{c.nome}</span>
                    {c.fornecedores?.nome && <span className="block truncate text-xs text-muted-foreground">{c.fornecedores.nome}</span>}
                  </span>
                  <Chip family="severity" tone={urg === 'urgente' ? 'critical' : urg === 'proximo' ? 'medium' : 'none'} className="shrink-0">
                    {dias === 0 ? t('bento.contracts.today') : t('bento.contracts.inDays', { count: dias })}
                  </Chip>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </BentoTile>
  );
}
