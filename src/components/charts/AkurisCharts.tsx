import * as React from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';
import { useMotionAllowed } from '@/lib/motion-preferences';
import { CHART_AXIS, CHART_GRID, CHART_TOOLTIP_BG, CHART_TOOLTIP_BORDER, CHART_TREND, chartSeries } from '@/lib/chart-tokens';
import { AnimatedMetricValue } from '@/components/ui/stat-strip';
import { FrameworkBadge } from '@/components/frameworks/FrameworkBadge';

/** Cartão comum dos gráficos: rótulo em maiúsculas, número grande e variação. */
export function ChartCard({ label, title, value, trend, actions, children, className }: {
  label?: string; title?: string; value?: number | string;
  trend?: { label: string; favorable?: boolean; direction?: 'up' | 'down' };
  actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-5 dark:shadow-none', className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {label && <p className="text-micro font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>}
          {title && <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>}
        </div>
        {actions}
      </header>
      {value !== undefined && (
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground"><AnimatedMetricValue value={value} /></span>
          {trend && (
            <span className={cn('text-xs font-medium', trend.favorable === true && 'text-state-done', trend.favorable === false && 'text-destructive', trend.favorable === undefined && 'text-muted-foreground')}>
              {trend.direction === 'up' ? '↑ ' : trend.direction === 'down' ? '↓ ' : ''}{trend.label}
            </span>
          )}
        </div>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const tooltipStyle = { background: CHART_TOOLTIP_BG, border: `1px solid ${CHART_TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 };

/** Evolução no tempo: área com degradê, balão e linha de meta opcional. */
export function AkurisArea({ data, height = 200, target, targetLabel, format }: {
  data: Array<{ label: string; value: number }>; height?: number; target?: number; targetLabel?: string; format?: (v: number) => string;
}) {
  const id = React.useId().replace(/:/g, '');
  const motion = useMotionAllowed();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id={`ar-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={CHART_TREND} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_TREND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => (format ? format(v) : v)} />
        {target !== undefined && <ReferenceLine y={target} stroke={CHART_AXIS} strokeDasharray="4 4" label={{ value: targetLabel, fill: CHART_AXIS, fontSize: 11, position: 'right' }} />}
        <Area type="monotone" dataKey="value" stroke={CHART_TREND} strokeWidth={2} fill={`url(#ar-${id})`} isAnimationActive={motion} animationDuration={900} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Volumes por período: barras arredondadas, o último (atual) em destaque. */
export function AkurisBars({ data, height = 200, highlightIndex }: {
  data: Array<{ label: string; value: number }>; height?: number; highlightIndex?: number;
}) {
  const motion = useMotionAllowed();
  const hi = highlightIndex ?? data.length - 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
        <Bar dataKey="value" radius={[6, 6, 6, 6]} maxBarSize={28} isAnimationActive={motion} animationDuration={700}>
          {data.map((_, i) => <Cell key={i} fill={i === hi ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.35)'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Distribuição: donut grosso com espaço entre fatias, total ao centro e legenda com %. */
export function AkurisDonut({ data, centerLabel, size = 180 }: {
  data: Array<{ label: string; value: number; color?: string }>; centerLabel?: string; size?: number;
}) {
  const motion = useMotionAllowed();
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="100%" paddingAngle={3} cornerRadius={4} stroke="none" isAnimationActive={motion} animationDuration={800}>
              {data.map((d, i) => <Cell key={d.label} fill={d.color ?? chartSeries(i)} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums text-foreground"><AnimatedMetricValue value={total} /></span>
          {centerLabel && <span className="text-micro text-muted-foreground">{centerLabel}</span>}
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-3 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color ?? chartSeries(i) }} />
            <span className="flex-1 truncate text-foreground">{d.label}</span>
            <span className="tabular-nums font-medium text-foreground">{d.value}</span>
            <span className="w-10 text-right tabular-nums text-muted-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Conformidade por framework: selo + barra com degradê + %. */
export function ProgressoFramework({ itens }: { itens: Array<{ nome: string; versao?: string; percent: number }> }) {
  return (
    <ul className="akuris-stagger space-y-4">
      {itens.map((f, i) => (
        <li key={f.nome} style={{ '--i': i } as React.CSSProperties} className="flex items-center gap-3">
          <FrameworkBadge name={f.nome} versao={f.versao} size="sm" />
          <span className="w-28 truncate text-sm font-medium text-foreground" title={f.nome}>{f.nome}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-gradient-to-r from-[hsl(var(--fw-teal))] to-[hsl(var(--state-done))] transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, f.percent))}%` }} />
          </span>
          <span className="w-11 text-right text-sm font-semibold tabular-nums text-foreground">{Math.round(f.percent)}%</span>
        </li>
      ))}
    </ul>
  );
}
