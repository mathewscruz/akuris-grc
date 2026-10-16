import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useGrcMaturityScore } from '@/hooks/useGrcMaturityScore';
import { useFrameworksOverview } from '@/hooks/useFrameworksOverview';
import { fetchActivities, type Activity } from '@/components/dashboard/RecentActivities';
import { IconArrowUp, IconFile, IconShield, IconCheck, IconWarning, IconMessage } from '@/components/icons';
import { cn } from '@/lib/utils';
import { BentoTile, BentoEmpty, CountUp, useMounted } from './BentoTile';
import { diasAte, severidadeCelula, urgenciaContrato, serieSemanalConformidade, CONTRATO_VIGENTE } from './bento-utils';
import { FrameworkBadge } from '@/components/frameworks/FrameworkBadge';

const C = {
  good: 'hsl(var(--good))', success: 'hsl(var(--success))', danger: 'hsl(var(--destructive))',
  warn: 'hsl(var(--warning))', muted: 'hsl(var(--muted-foreground))', primary: 'hsl(var(--primary))',
  track: 'hsl(var(--muted))',
};

/* ───────────── Índice operacional ───────────── */

const TEAL = 'hsl(var(--chart-teal))', GREEN = 'hsl(var(--chart-green))';

function GradientRing({ value, size = 190 }: { value: number; size?: number }) {
  const mounted = useMounted();
  const sw = 12, r = size / 2 - sw, circ = 2 * Math.PI * r;
  const off = circ * (1 - (mounted ? value : 0) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <defs>
        <linearGradient id="indice-ring-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={TEAL} />
          <stop offset="100%" stopColor={GREEN} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#indice-ring-grad)" strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)' }} />
    </svg>
  );
}

function UltimoPonto(props: any) {
  const { cx, cy, index, dataLength } = props;
  if (cx == null || cy == null) return null;
  if (index === dataLength - 1) return (
    <g><circle cx={cx} cy={cy} r={9} fill={GREEN} opacity={0.25} /><circle cx={cx} cy={cy} r={5} fill={GREEN} stroke="hsl(var(--card))" strokeWidth={2} /></g>
  );
  return <circle cx={cx} cy={cy} r={3} fill={TEAL} />;
}

export function IndiceTile({ delay }: { delay?: number }) {
  const { t, locale } = useLanguage();
  const m = useGrcMaturityScore();
  const empresaId = useAuth().profile?.empresa_id;
  const { data: serie = [] } = useQuery({
    queryKey: ['bento-indice-serie-semanal', empresaId, locale],
    enabled: !!empresaId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const inicio = new Date(); inicio.setMonth(inicio.getMonth() - 5, 1); inicio.setHours(0, 0, 0, 0);
      const { data, error } = await supabase.from('gap_analysis_score_history')
        .select('framework_id, score, recorded_at').eq('empresa_id', empresaId!).gte('recorded_at', inicio.toISOString())
        .order('recorded_at').limit(5000);
      if (error) throw error;
      return serieSemanalConformidade(data ?? [], locale);
    },
  });
  const delta = serie.length >= 2 ? serie[serie.length - 1].v - serie[Math.max(0, serie.length - 5)].v : null;
  const temDados = m.status !== 'no_data';

  return (
    <BentoTile title={t('bento.index.title')} description={t('bento.index.desc')} delay={delay}>
      {!temDados ? <BentoEmpty>{t('bento.index.empty')}</BentoEmpty> : (
        <div className="flex flex-1 flex-col">
          <div className="my-auto flex items-center gap-8">
            <div className="relative shrink-0">
              <GradientRing value={m.score} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl font-semibold leading-none tabular-nums text-foreground"><CountUp value={m.score} /></span>
                <span className="mt-2 text-base text-muted-foreground">{t('bento.index.of100')}</span>
              </div>
            </div>
            {delta != null && (
              <div className="max-w-[9rem]">
                <p className={cn('flex items-center gap-1.5 text-xl font-semibold', delta >= 0 ? 'text-success' : 'text-destructive')}>
                  <IconArrowUp className={cn('h-5 w-5', delta < 0 && 'rotate-180')} />
                  {delta >= 0 ? '+' : ''}{delta}%
                </p>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">{t('bento.index.vsLastMonth')}</p>
              </div>
            )}
          </div>
          {serie.length >= 2 && (
            <div className="mt-4 h-32 w-full shrink-0">
              <ResponsiveContainer>
                <AreaChart data={serie} margin={{ top: 12, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="indice-area-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GREEN} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="indice-line-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={TEAL} />
                      <stop offset="100%" stopColor={GREEN} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" interval={0} axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 12 }} />
                  <Area type="monotone" dataKey="v" stroke="url(#indice-line-grad)" strokeWidth={2} fill="url(#indice-area-grad)"
                    dot={(p: any) => <UltimoPonto key={p.index} {...p} dataLength={serie.length} />} activeDot={{ r: 5 }} animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </BentoTile>
  );
}

/* ───────────── Riscos ───────────── */

const SEV_FILL: Record<string, string> = {
  low: 'color-mix(in oklab, hsl(var(--muted-foreground)) 45%, hsl(var(--card)))',
  medium: 'color-mix(in oklab, hsl(var(--muted-foreground)) 25%, hsl(var(--card)))',
  high: 'color-mix(in oklab, hsl(var(--primary)) 60%, hsl(var(--card)))',
  critical: 'hsl(var(--primary))',
};

/** Tom da célula: cinza claro (baixo) → roxo forte (P e I altos), como no modelo. */
function cellFill(p: number, i: number) {
  const t = (p + i - 2) / 8;
  if (p + i <= 6 || p <= 2) return `color-mix(in oklab, hsl(var(--muted-foreground)) ${Math.round(42 - t * 22)}%, hsl(var(--card)))`;
  return `color-mix(in oklab, hsl(var(--primary)) ${Math.round(45 + (t - 0.5) * 110)}%, hsl(var(--card)))`;
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
  const niveis = ['vlow', 'low', 'mid', 'high', 'vhigh'] as const;
  const legenda = useMemo(() => {
    const c: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    data?.forEach((row, i) => row.forEach((n, p) => { c[severidadeCelula(p + 1, i + 1)] += n; }));
    return c;
  }, [data]);
  
  return (
    <BentoTile title={t('bento.risks.title')} description={t('bento.risks.desc')} delay={delay}>
      {isLoading ? <AkurisPulse /> : (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-1 gap-2">
            <span className="flex items-center text-xs text-muted-foreground [writing-mode:vertical-rl] rotate-180">{t('bento.risks.impact')}</span>
            <div className="grid flex-1 grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1.5 text-xs text-muted-foreground">
              {[5, 4, 3, 2, 1].map((i, ri) => (
                <div key={i} className="contents">
                  <span className="flex items-center justify-end pr-1 text-right">{t(`bento.risks.levels.${niveis[i - 1]}`)}</span>
                  {[1, 2, 3, 4, 5].map((p) => {
                    const n = data?.[i - 1]?.[p - 1] ?? 0;
                    return (
                      <button key={p} type="button" onClick={() => navigate(`/riscos?prob=${p}&imp=${i}`)}
                        title={t('bento.risks.cell', { count: n, p, i })} aria-label={t('bento.risks.cell', { count: n, p, i })}
                        className="aspect-[5/4] min-h-9 rounded-lg text-sm font-semibold tabular-nums text-foreground opacity-0 animate-fade-in transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                        style={{ backgroundColor: cellFill(p, i), animationDelay: `${(ri * 5 + p) * 25}ms`, animationFillMode: 'both' }}>
                        {n || ''}
                      </button>
                    );
                  })}
                </div>
              ))}
              <span />
              {niveis.map((n) => <span key={n} className="text-center">{t(`bento.risks.levels.${n}`)}</span>)}
              <span />
              <span className="col-span-5 text-center">{t('bento.risks.prob')}</span>
            </div>
          </div>
          <ul className="flex flex-wrap justify-between gap-3 text-sm">
            {(['low', 'medium', 'high', 'critical'] as const).map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SEV_FILL[s] }} />
                <span className="text-foreground">{t(`bento.risks.sev.${({ low: 'baixo', medium: 'medio', high: 'alto', critical: 'critico' } as const)[s]}`)}</span>
                <span className="tabular-nums text-muted-foreground">{legenda[s]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BentoTile>
  );
}

/* ───────────── Planos de ação ───────────── */

export function PlanosTile({ pendentes, atrasados, concluidos, delay, className }: { pendentes: number; atrasados: number; concluidos: number; delay?: number; className?: string }) {
  const { t } = useLanguage();
  const noPrazo = Math.max(0, pendentes - atrasados);
  const total = noPrazo + atrasados + concluidos;
  const fatias = [
    { k: 'onTime', v: noPrazo, c: TEAL },
    { k: 'late', v: atrasados, c: C.danger },
    { k: 'done', v: concluidos, c: C.muted },
  ];
  return (
    <BentoTile title={t('bento.plans.title')} description={t('bento.plans.desc')} delay={delay} className={className}>
      {(
        <div className="flex flex-1 items-center gap-6">
          <div className="relative h-36 w-36 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={total ? fatias : [{ k: 'empty', v: 1, c: C.track }]} dataKey="v" innerRadius="62%" outerRadius="100%" stroke="none" paddingAngle={total ? 3 : 0} cornerRadius={3} startAngle={90} endAngle={-270} animationDuration={1200}>
                  {(total ? fatias : [{ k: 'empty', v: 1, c: C.track }]).map((f) => <Cell key={f.k} fill={f.c} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold leading-none tabular-nums"><CountUp value={total} /></span>
              <span className="text-xs text-muted-foreground">{t('bento.plans.total')}</span>
            </div>
          </div>
          <ul className="flex-1 space-y-4 text-sm">
            {fatias.map((f) => (
              <li key={f.k} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.c }} />
                <span className="flex-1 text-foreground">{t(`bento.plans.${f.k}`)}</span>
                <span className="w-8 text-right font-semibold tabular-nums">{f.v}</span>
                <span className="w-10 text-right tabular-nums text-muted-foreground">{total ? Math.round((f.v / total) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BentoTile>
  );
}

/* ───────────── Incidentes ───────────── */

export function IncidentesTile({ emCurso, criticos, altos, medios, baixos, delay, className }: { emCurso: number; criticos: number; altos: number; medios: number; baixos: number; delay?: number; className?: string }) {
  const { t } = useLanguage();
  const chips = [
    { k: 'critical', v: criticos, c: C.danger },
    { k: 'high', v: altos, c: C.warn },
    { k: 'medium', v: medios, c: 'hsl(var(--caution, 45 90% 55%))' },
    { k: 'low', v: baixos, c: C.muted },
  ];
  return (
    <BentoTile title={t('bento.incidents.title')} description={t('bento.incidents.desc')} href="/incidentes" delay={delay} className={className}>
      {(
        <div className="flex flex-1 flex-col justify-center space-y-4">
          <p className="flex items-baseline gap-3"><span className="text-5xl font-semibold leading-none tabular-nums"><CountUp value={emCurso} /></span><span className="text-sm text-muted-foreground">{t('bento.incidents.inProgress')}</span></p>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <span key={c.k} className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.c }} />
                {t(`bento.incidents.${c.k}`)} <span className="tabular-nums" style={{ color: c.v ? c.c : undefined }}>{c.v}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </BentoTile>
  );
}

/* ───────────── Conformidade ───────────── */

export function ConformidadeTile({ delay }: { delay?: number }) {
  const { t } = useLanguage();
  const { data, isLoading } = useFrameworksOverview() as any;
  const mounted = useMounted(150);
  const lista = ((data ?? []) as any[]).filter((f) => f.status !== 'nao_iniciado' || f.mediaConformidade > 0).slice(0, 3);
  return (
    <BentoTile title={t('bento.compliance.title')} description={t('bento.compliance.desc')} delay={delay}
      footerHref="/gap-analysis/frameworks" footerLabel={t('bento.compliance.more')}>
      {isLoading ? <AkurisPulse /> : !lista.length ? <BentoEmpty>{t('bento.compliance.empty')}</BentoEmpty> : (
        <ul className="flex flex-1 flex-col justify-center gap-6">
          {lista.map((f) => (
            <li key={f.id}>
              <div className="mb-2 flex items-center gap-3 text-base">
                <FrameworkBadge name={f.nome} versao={f.versao ?? undefined} tipo={f.tipo} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{f.nome}</span>
                <span className="tabular-nums text-foreground">{Math.round(f.mediaConformidade)}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: mounted ? `${f.mediaConformidade}%` : 0, transition: 'width 1.1s cubic-bezier(.4,0,.2,1)' }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </BentoTile>
  );
}

/* ───────────── Contratos ───────────── */

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
        .eq('empresa_id', empresaId!).in('status', CONTRATO_VIGENTE as unknown as string[])
        .gte('data_fim', hoje).lte('data_fim', limite)
        .order('data_fim').limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });
  const fmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <BentoTile title={t('bento.contracts.title')} description={t('bento.contracts.desc')} delay={delay}
      footerHref="/contratos" footerLabel={t('bento.contracts.more')}>
      {isLoading ? <AkurisPulse /> : !data?.length ? <BentoEmpty>{t('bento.contracts.empty')}</BentoEmpty> : (
        <ol className="relative flex flex-1 flex-col justify-around gap-4 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-border">
          {data.map((c: any, idx: number) => {
            const dias = diasAte(c.data_fim);
            const urg = urgenciaContrato(dias);
            const cor = urg === 'urgente' ? 'text-destructive' : urg === 'proximo' ? 'text-warning' : 'text-muted-foreground';
            return (
              <li key={c.id} className="animate-fade-in" style={{ animationDelay: `${idx * 90}ms`, animationFillMode: 'both' }}>
                <button type="button" onClick={() => navigate(`/contratos?focus=${c.id}`)} className="group relative flex w-full items-center gap-4 pl-6 text-left">
                  <span aria-hidden className={cn('absolute left-0 h-3 w-3 rounded-full ring-4 ring-card',
                    urg === 'urgente' ? 'bg-destructive' : urg === 'proximo' ? 'bg-warning' : 'bg-muted-foreground')} />
                  <span className={cn('w-24 shrink-0 text-sm tabular-nums', cor)}>{fmt.format(new Date(c.data_fim + 'T12:00:00'))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{c.fornecedores?.nome || c.nome}</span>
                    {c.fornecedores?.nome && <span className="block truncate text-xs text-muted-foreground">{c.nome}</span>}
                  </span>
                  <span className={cn('shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium',
                    urg === 'urgente' ? 'bg-destructive/15 text-destructive' : urg === 'proximo' ? 'bg-warning/15 text-warning' : 'bg-muted text-foreground')}>
                    {dias === 0 ? t('bento.contracts.today') : t('bento.contracts.inDays', { count: dias })}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </BentoTile>
  );
}

/* ───────────── Atividade recente ───────────── */

const ICONE: Record<string, typeof IconFile> = {
  riscos: IconShield, planos: IconCheck, contratos: IconFile, controles: IconCheck, documentos: IconFile, auditorias: IconCheck, denuncias: IconMessage, incidentes: IconWarning,
};
const ROTA: Record<string, string> = {
  riscos: '/riscos', planos: '/planos-acao', incidentes: '/incidentes', contratos: '/contratos', controles: '/governanca/controles', documentos: '/documentos', auditorias: '/governanca/auditorias', denuncias: '/denuncia',
};

function relativo(iso: string, locale: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}

export function AtividadeTile({ delay, dias }: { delay?: number; dias: number }) {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const empresaId = useAuth().profile?.empresa_id;
  const { data = [], isLoading } = useQuery({
    queryKey: ['recent-activities', empresaId],
    queryFn: () => fetchActivities(empresaId!, t),
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });
  const corte = Date.now() - dias * 86400000;
  const lista = (data as Activity[]).filter((a) => new Date(a.created_at).getTime() >= corte).slice(0, 5);
  return (
    <BentoTile title={t('bento.activity.title')} description={t('bento.activity.desc')} delay={delay}>
      {isLoading ? <AkurisPulse /> : !lista.length ? <BentoEmpty>{t('bento.activity.empty')}</BentoEmpty> : (
        <ul className="flex flex-1 flex-col justify-between gap-3">
          {lista.map((a, idx) => {
            const Icon = ICONE[a.module] ?? IconFile;
            return (
              <li key={a.id} className="animate-fade-in" style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}>
                <button type="button" onClick={() => ROTA[a.module] && navigate(`${ROTA[a.module]}?${a.module === 'riscos' ? 'risco' : 'focus'}=${a.recordId}`)}
                  className="group flex w-full items-start gap-3 text-left">
                  <span className="mt-0.5 flex shrink-0 items-center justify-center text-muted-foreground"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{a.description}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativo(a.created_at, locale)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BentoTile>
  );
}
