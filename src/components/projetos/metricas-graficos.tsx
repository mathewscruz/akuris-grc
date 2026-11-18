import * as React from 'react';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts';
import { CHART_AXIS, CHART_GRID, CHART_FONT, CHART_TREND, CHART_SEVERITY, chartSeries } from '@/lib/chart-tokens';
import { useMotionAllowed } from '@/lib/motion-preferences';
import { cn } from '@/lib/utils';

/** Cabeçalho comum dos cartões de métricas: título, explicação curta e ação. */
export function MetricCard({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-5 dark:shadow-none animate-fade-in motion-reduce:animate-none', className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Balão padrão: título + linhas "cor · rótulo · valor". */
export function ChartTooltipBox({ title, rows }: { title: string; rows: Array<{ color?: string; label: string; value: React.ReactNode; dashed?: boolean }> }) {
  return (
    <div className="min-w-[160px] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg dark:shadow-none">
      <p className="mb-1.5 font-semibold text-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            <span className={cn('w-3', r.dashed ? 'border-t-2 border-dotted' : 'h-2 rounded-full')} style={r.dashed ? { borderColor: r.color } : { background: r.color }} />
            <span className="flex-1 text-muted-foreground">{r.label}</span>
            <span className="font-medium tabular-nums text-foreground">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BurnPoint { label: string; real?: number | null; ideal?: number | null; projecao?: number | null; escopo: number }

/** Burnup/burndown: escopo em área clara, real em degraus, ideal pontilhado e projeção tracejada. */
export function BurnChart({ data, hojeLabel, labels, height = 260 }: {
  data: BurnPoint[]; hojeLabel?: string; height?: number;
  labels: { real: string; ideal: string; projecao: string; escopo: string; hoje: string; semana: (l: string) => string };
}) {
  const id = React.useId().replace(/:/g, '');
  const motion = useMotionAllowed();
  const max = Math.max(1, ...data.map((d) => Math.max(d.escopo, d.real ?? 0, d.ideal ?? 0, d.projecao ?? 0)));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={`real-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={CHART_TREND} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CHART_TREND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: CHART_FONT.axis }} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis allowDecimals={false} domain={[0, Math.ceil(max)]} tick={{ fill: CHART_AXIS, fontSize: CHART_FONT.axis }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ stroke: CHART_AXIS, strokeDasharray: '3 3' }} content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const p = payload[0].payload as BurnPoint;
          return <ChartTooltipBox title={labels.semana(String(label))} rows={[
            ...(p.real != null ? [{ color: CHART_TREND, label: labels.real, value: `${p.real} / ${p.escopo}` }] : []),
            ...(p.ideal != null ? [{ color: CHART_AXIS, label: labels.ideal, value: p.ideal, dashed: true }] : []),
            ...(p.projecao != null && p.real == null ? [{ color: CHART_TREND, label: labels.projecao, value: p.projecao, dashed: true }] : []),
          ]} />;
        }} />
        <Area type="stepAfter" dataKey="escopo" stroke="none" fill="hsl(var(--muted))" fillOpacity={0.5} isAnimationActive={false} />
        {hojeLabel && <ReferenceLine x={hojeLabel} stroke={CHART_AXIS} strokeDasharray="2 3" label={{ value: labels.hoje, position: 'insideTopRight', fill: CHART_AXIS, fontSize: CHART_FONT.axis, offset: 6 }} />}
        <Line type="linear" dataKey="ideal" stroke={CHART_AXIS} strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" dot={false} connectNulls isAnimationActive={motion} />
        <Line type="linear" dataKey="projecao" stroke={CHART_TREND} strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls isAnimationActive={motion} animationBegin={600} />
        <Area type="stepAfter" dataKey="real" stroke={CHART_TREND} strokeWidth={2.5} fill={`url(#real-${id})`} connectNulls={false} isAnimationActive={motion} animationDuration={900} activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Barras semanais clicáveis com faixa de média e semana atual destacada. */
export function WeeklyBars({ data, media, mediaLabel, tooltip, onSelect, selected, height = 220 }: {
  data: Array<{ label: string; value: number }>; media: number; mediaLabel: string; tooltip: (l: string, v: number) => string;
  onSelect?: (index: number) => void; selected?: number | null; height?: number;
}) {
  const motion = useMotionAllowed();
  const max = Math.max(1, ...data.map((d) => d.value), Math.ceil(media));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: CHART_FONT.axis }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} domain={[0, max]} tick={{ fill: CHART_AXIS, fontSize: CHART_FONT.axis }} axisLine={false} tickLine={false} />
        {media > 0 && <ReferenceArea y1={0} y2={media} fill={CHART_TREND} fillOpacity={0.05} ifOverflow="extendDomain" />}
        {media > 0 && <ReferenceLine y={media} stroke={CHART_TREND} strokeOpacity={0.5} strokeDasharray="4 4" label={{ value: mediaLabel, position: 'insideTopRight', fill: CHART_AXIS, fontSize: CHART_FONT.axis }} />}
        <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.4)', radius: 6 } as never} content={({ active, payload, label }) => active && payload?.length
          ? <ChartTooltipBox title={String(label)} rows={[{ color: CHART_TREND, label: tooltip(String(label), payload[0].value as number), value: payload[0].value as number }]} /> : null} />
        <Bar dataKey="value" radius={[8, 8, 3, 3]} maxBarSize={36} minPointSize={3} isAnimationActive={motion} animationDuration={700}
          onClick={(_, i) => onSelect?.(i)} className={onSelect ? 'cursor-pointer' : undefined}>
          {data.map((d, i) => {
            const atual = i === data.length - 1;
            const ativo = selected == null ? (atual || d.value > 0) : selected === i;
            return <Cell key={i} fill={d.value === 0 ? 'hsl(var(--muted))' : CHART_TREND} fillOpacity={ativo ? (atual ? 1 : 0.75) : 0.3} />;
          })}
          <LabelList dataKey="value" position="top" fill={CHART_AXIS} fontSize={CHART_FONT.axis} formatter={(v: number) => (v ? v : '')} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barra empilhada por prioridade: concluídas / em aberto / atrasadas. */
export function StackedPriority({ rows, labels, onSelect }: {
  rows: Array<{ key: string; label: string; color: string; concluidas: number; abertas: number; atrasadas: number; total: number }>;
  labels: { concluidas: string; abertas: string; atrasadas: string; vazio: string };
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {rows.map((r, idx) => (
          <li key={r.key}>
            <button type="button" disabled={!r.total || !onSelect} onClick={() => onSelect?.(r.key)}
              className="group w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-default">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: r.color }} />{r.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {r.total ? <><span className="font-semibold text-foreground">{r.concluidas}</span>/{r.total}{r.atrasadas > 0 && <span className="ml-2 text-destructive">{r.atrasadas} {labels.atrasadas.toLowerCase()}</span>}</> : labels.vazio}
                </span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/60" style={{ width: `${Math.max(8, (r.total / max) * 100)}%` }}>
                {[['concluidas', r.color, 1], ['abertas', r.color, 0.35], ['atrasadas', CHART_SEVERITY.critical, 1]].map(([k, c, o]) => {
                  const v = r[k as 'concluidas' | 'abertas' | 'atrasadas'];
                  return v ? <span key={k as string} className={cn('h-full origin-left animate-scale-in motion-reduce:animate-none transition-opacity group-hover:opacity-90', k === 'atrasadas' && 'bg-[repeating-linear-gradient(135deg,transparent_0_3px,hsl(var(--card)/0.35)_3px_5px)]')}
                    style={{ width: `${(v / r.total) * 100}%`, backgroundColor: c as string, opacity: o as number, animationDelay: `${idx * 60}ms` }} /> : null;
                })}
              </div>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: chartSeries(0) }} />{labels.concluidas}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm opacity-35" style={{ background: chartSeries(0) }} />{labels.abertas}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: CHART_SEVERITY.critical }} />{labels.atrasadas}</span>
      </div>
    </div>
  );
}

/** Medidor semicircular (0–100%+); acima de 100% fica vermelho. */
export function Gauge({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const motion = useMotionAllowed();
  const pct = Math.max(0, value);
  const arco = Math.PI * 70;
  const preenchido = Math.min(1, pct / 100) * arco;
  const cor = pct > 100 ? CHART_SEVERITY.critical : pct > 85 ? CHART_SEVERITY.medium : CHART_TREND;
  return (
    <div className="relative mx-auto w-full max-w-[200px]">
      <svg viewBox="0 0 160 92" className="w-full" role="img" aria-label={`${label}: ${Math.round(pct)}%`}>
        <path d="M10 82 A70 70 0 0 1 150 82" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" strokeLinecap="round" />
        <path d="M10 82 A70 70 0 0 1 150 82" fill="none" stroke={cor} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${preenchido} ${arco}`} style={{ transition: motion ? 'stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1)' : undefined }} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-2xl font-semibold tabular-nums text-foreground">{Math.round(pct)}%</p>
        <p className="text-micro text-muted-foreground">{sub ?? label}</p>
      </div>
    </div>
  );
}
