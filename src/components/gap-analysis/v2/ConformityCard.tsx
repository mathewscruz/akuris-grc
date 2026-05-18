/**
 * ConformityCard — donut + legenda + tríade de KPIs.
 * Substitui o FrameworkHeroSummary na aba Avaliação, pareado lado a lado
 * com PriorityQueueCard. Identidade Akuris (DM Sans, tokens semânticos).
 */
import { ArrowUpRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { getMaturityLevel } from './MaturityScale';

interface ConformityCardProps {
  overallScore: number;
  totalRequirements: number;
  evaluatedRequirements: number;
  conforme: number;
  parcial: number;
  naoConforme: number;
  naoAplicavel: number;
  /** Meta opcional do trimestre (placeholder). */
  targetScore?: number;
  /** Pontos ganhos nos últimos 30d. */
  delta30d?: number;
}

const DONUT_SIZE = 132;
const STROKE = 14;
const RADIUS = (DONUT_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ConformityCard({
  overallScore,
  totalRequirements,
  evaluatedRequirements,
  conforme,
  parcial,
  naoConforme,
  naoAplicavel,
  targetScore = 60,
  delta30d = 0,
}: ConformityCardProps) {
  const maturity = getMaturityLevel(overallScore);
  const total = conforme + parcial + naoConforme + naoAplicavel || 1;
  const segs = [
    { kind: 'conforme', value: conforme, color: 'hsl(var(--success))' },
    { kind: 'parcial', value: parcial, color: 'hsl(var(--warning))' },
    { kind: 'nao_conforme', value: naoConforme, color: 'hsl(var(--destructive))' },
    { kind: 'nao_aplicavel', value: naoAplicavel, color: 'hsl(var(--info))' },
  ];

  let offset = 0;
  const arcs = segs.map((s) => {
    const len = (s.value / total) * CIRCUMFERENCE;
    const arc = { ...s, len, off: offset };
    offset += len;
    return arc;
  });
  const deltaPositive = delta30d >= 0;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Conformidade</h3>
        <StatusBadge tone="info" size="sm">
          Nível {maturity.id} — {maturity.label}
        </StatusBadge>
      </div>

      <div className="flex items-center gap-5">
        {/* Donut */}
        <div className="relative shrink-0" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
          <svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
            <circle
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={STROKE}
            />
            {arcs.map((a, i) => (
              <circle
                key={i}
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={a.color}
                strokeWidth={STROKE}
                strokeDasharray={`${a.len} ${CIRCUMFERENCE - a.len}`}
                strokeDashoffset={-a.off}
                transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums leading-none tracking-tight text-foreground">
              {overallScore}%
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mt-1">
              Conformidade
            </span>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex-1 grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
          <LegendItem dot="bg-success" label="Conforme" value={conforme} />
          <LegendItem dot="bg-warning" label="Parcial" value={parcial} />
          <LegendItem dot="bg-destructive" label="Não Conf." value={naoConforme} />
          <LegendItem dot="bg-info" label="N/A" value={naoAplicavel} />
        </div>
      </div>

      {/* Tríade */}
      <div className="mt-5 pt-4 border-t border-border/60 grid grid-cols-3 gap-3">
        <Triple
          eyebrow="Progresso"
          value={`${evaluatedRequirements}/${totalRequirements}`}
        />
        <Triple
          eyebrow="Meta Q1"
          value={`${targetScore}%`}
          tone={overallScore >= targetScore ? 'success' : 'warning'}
        />
        <Triple
          eyebrow="Δ 30d"
          value={
            <span className={`inline-flex items-center gap-0.5 ${deltaPositive ? 'text-success' : 'text-destructive'}`}>
              <ArrowUpRight className={`h-3.5 w-3.5 ${deltaPositive ? '' : 'rotate-90'}`} strokeWidth={2} />
              {deltaPositive ? '+' : ''}{delta30d.toFixed(1)}
            </span>
          }
        />
      </div>
    </article>
  );
}

function LegendItem({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-semibold tabular-nums text-foreground">{value}</span>
    </span>
  );
}

function Triple({
  eyebrow,
  value,
  tone = 'neutral',
}: {
  eyebrow: string;
  value: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const tc = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-foreground';
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </div>
      <div className={`mt-1 text-base font-semibold tabular-nums ${tc}`}>
        {value}
      </div>
    </div>
  );
}
