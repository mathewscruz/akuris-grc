/**
 * MaturityHero — bloco editorial de abertura da página Frameworks.
 * Score global ponderado + MaturityScale (5 níveis) + StackBar consolidado + 3 KPIs.
 * Visual Akuris (Navy/Purple/DM Sans), sem cores cruas.
 */
import { CornerAccent } from '@/components/ui/CornerAccent';
import { MaturityScale, getMaturityLevel } from './MaturityScale';
import { StackBar, type StackSegment } from './StackBar';
import { SectionHead } from './SectionHead';

interface MaturityHeroProps {
  overallScore: number;
  segments: StackSegment[];
  totalRequirements: number;
  totalEvaluated: number;
  criticalCount: number;
  activeFrameworksCount: number;
}

export function MaturityHero({
  overallScore,
  segments,
  totalRequirements,
  totalEvaluated,
  criticalCount,
  activeFrameworksCount,
}: MaturityHeroProps) {
  const maturity = getMaturityLevel(overallScore);
  const coverage = totalRequirements > 0
    ? Math.round((totalEvaluated / totalRequirements) * 100)
    : 0;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <CornerAccent position="top-left" />
      <div className="p-6 md:p-8">
        <SectionHead title="MATURIDADE GERAL" count={`${activeFrameworksCount} frameworks ativos`} />

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 items-start">
          {/* Coluna esquerda: score + escala */}
          <div className="space-y-5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-6xl md:text-7xl font-semibold tabular-nums text-foreground tracking-tight">
                {overallScore}
              </span>
              <span className="font-mono text-xl text-muted-foreground">/ 100</span>
              <span className="ml-auto text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Nível {maturity.id} · {maturity.label}
              </span>
            </div>

            <MaturityScale score={overallScore} />

            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Média ponderada da conformidade dos frameworks ativos, projetada na escala CMMI
              (Inicial → Otimizado).
            </p>
          </div>

          {/* Coluna direita: distribuição + KPIs */}
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <span>Distribuição global</span>
                <span className="tabular-nums">{coverage}% avaliado</span>
              </div>
              <StackBar segments={segments} height={10} showLegend />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60">
              <KpiCell
                eyebrow="Requisitos"
                value={totalRequirements}
                hint={`${totalEvaluated} avaliados`}
              />
              <KpiCell
                eyebrow="Cobertura"
                value={`${coverage}%`}
                hint="da base ativa"
                tone={coverage >= 70 ? 'positive' : coverage >= 40 ? 'neutral' : 'critical'}
              />
              <KpiCell
                eyebrow="Críticos"
                value={criticalCount}
                hint="não conformes"
                tone={criticalCount > 0 ? 'critical' : 'positive'}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KpiCell({
  eyebrow,
  value,
  hint,
  tone = 'neutral',
}: {
  eyebrow: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'critical';
}) {
  const toneCls =
    tone === 'positive' ? 'text-success' : tone === 'critical' ? 'text-destructive' : 'text-foreground';
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${toneCls}`}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
