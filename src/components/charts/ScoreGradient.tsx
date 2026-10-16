import { useEffect, useId, useState, type ReactNode } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-tokens';

const TEAL = 'hsl(var(--chart-teal))';
const GREEN = 'hsl(var(--chart-green))';

function useMountedFlag() {
  const [m, setM] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(r); }, []);
  return m;
}

/** Anel de score do dashboard: degradê teal→verde, ponta arredondada, preenchimento animado. */
export function GradientScoreRing({ value, size = 190, strokeWidth = 12, label, children }: {
  value: number | null; size?: number; strokeWidth?: number; label?: string; children?: ReactNode;
}) {
  const id = useId().replace(/:/g, '');
  const mounted = useMountedFlag();
  const v = value == null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value));
  const r = size / 2 - strokeWidth, circ = 2 * Math.PI * r;
  const off = circ * (1 - (mounted && v != null ? v : 0) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ? `${label}: ${v == null ? '—' : `${Math.round(v)}%`}` : undefined}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={TEAL} /><stop offset="100%" stopColor={GREEN} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
        {v != null && v > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#ring-${id})`} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={off} className="motion-reduce:!transition-none"
            style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)' }} />
        )}
      </svg>
      <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
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

/** Área de evolução do dashboard: linha em degradê, preenchimento suave, destaque no último ponto. */
export function GradientScoreArea({ data, height = 128, domain, showTooltip, format = (n) => `${Math.round(n)}%`, tooltipLabel }: {
  data: { label: string; value: number }[]; height?: number; domain?: [number, number];
  showTooltip?: boolean; format?: (n: number) => string; tooltipLabel?: string;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREEN} stopOpacity={0.4} /><stop offset="100%" stopColor={GREEN} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`line-${id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={TEAL} /><stop offset="100%" stopColor={GREEN} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={16} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
          {domain && <YAxis hide domain={domain} />}
          {showTooltip && <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [format(v), tooltipLabel ?? '']} />}
          <Area type="monotone" dataKey="value" stroke={`url(#line-${id})`} strokeWidth={2} fill={`url(#area-${id})`}
            dot={(p: any) => <UltimoPonto key={p.index} {...p} dataLength={data.length} />} activeDot={{ r: 5 }} animationDuration={1500} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
