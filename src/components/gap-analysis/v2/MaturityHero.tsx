/**
 * MaturityHero — dashboard editorial de abertura (Frameworks).
 * 4 colunas: Maturidade · Próximo Marco · Gaps a Tratar · Insight da IA.
 * Identidade Akuris (DM Sans, tokens semânticos, sem cores cruas).
 */
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { StatusBadge } from '@/components/ui/status-badge';
import { MaturityScale, getMaturityLevel } from './MaturityScale';
import type { StackSegment } from './StackBar';
import { useLanguage } from '@/contexts/LanguageContext';

interface MaturityHeroProps {
  overallScore: number;
  /** Mantido por compat — não usado no layout 4-col atual. */
  segments?: StackSegment[];
  totalRequirements: number;
  totalEvaluated: number;
  criticalCount: number;
  activeFrameworksCount: number;
  delta30d?: number;
  nextMilestone?: {
    label: string;
    date: string;
    targetScore?: number;
  };
  onSeePlan?: () => void;
}

function formatDateBR(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function daysUntil(iso: string): number {
  const d = new Date(iso).getTime();
  return Math.max(0, Math.ceil((d - Date.now()) / 86400000));
}

export function MaturityHero({
  overallScore,
  totalRequirements,
  totalEvaluated,
  criticalCount,
  activeFrameworksCount,
  delta30d = 0,
  nextMilestone,
  onSeePlan,
}: MaturityHeroProps) {
  const { t } = useLanguage();
  const score = Math.round(Number(overallScore) || 0);
  const maturity = getMaturityLevel(score);
  const coverage = totalRequirements > 0
    ? Math.round((totalEvaluated / totalRequirements) * 100)
    : 0;
  const deltaPositive = delta30d >= 0;

  // Insight contextual gerado client-side
  const insightCopy = (() => {
    if (totalEvaluated === 0) {
      return {
        body: <>{t('gapV2.maturityHero.insightStartBody')}</>,
        cta: t('gapV2.maturityHero.insightStartCta'),
      };
    }
    if (delta30d > 0 && nextMilestone?.targetScore) {
      const projected = Math.min(100, Math.round(score + delta30d));
      return {
        body: <>{t('gapV2.maturityHero.insightProjectedPrefix')} <strong className="text-foreground">{projected}%</strong> {t('gapV2.maturityHero.insightProjectedUntil')} {formatDateBR(nextMilestone.date)}, {projected >= nextMilestone.targetScore ? <>{t('gapV2.maturityHero.insightHitsTarget')}</> : <>{t('gapV2.maturityHero.insightBelowTarget', { target: nextMilestone.targetScore })}</>}.</>,
        cta: t('gapV2.maturityHero.insightSeePlanCta'),
      };
    }
    if (criticalCount > 0) {
      return {
        body: <>{t('gapV2.maturityHero.insightCriticalPrefix')} <strong className="text-foreground">{criticalCount}</strong> {t('gapV2.maturityHero.insightCriticalSuffix', { pts: Math.min(15, criticalCount) })}</>,
        cta: t('gapV2.maturityHero.insightSeePlanCta'),
      };
    }
    return {
      body: <>{t('gapV2.maturityHero.insightCoveragePrefix')} <strong className="text-foreground">{coverage}%</strong>. {t('gapV2.maturityHero.insightCoverageSuffix')}</>,
      cta: t('gapV2.maturityHero.insightContinueCta'),
    };
  })();

  const gapTone = criticalCount > 0 ? 'text-destructive' : 'text-success';

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <CornerAccent position="top-left" />
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_0.9fr_1.2fr]">
        {/* Coluna 1 — Maturidade */}
        <div className="p-6 lg:pr-7">
          <div className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
            {t('gapV2.maturityHero.maturityIndex')} · {activeFrameworksCount} {activeFrameworksCount === 1 ? t('gapV2.maturityHero.activeFrameworkSingular') : t('gapV2.maturityHero.activeFrameworkPlural')}
          </div>
          <div className="mt-2 flex items-end gap-3 flex-wrap">
            <div className="flex items-baseline">
              <span className="text-6xl font-bold tabular-nums leading-none tracking-tight text-foreground">
                {score}
              </span>
              <span className="text-2xl text-muted-foreground ml-0.5">%</span>
            </div>
            <StatusBadge tone="info" size="sm">
              {t('gapV2.maturityHero.level', { id: maturity.id, label: maturity.label })}
            </StatusBadge>
          </div>
          <div className={`mt-2 inline-flex items-center gap-1.5 text-xs ${deltaPositive ? 'text-success' : 'text-destructive'}`}>
            <ArrowUpRight className={`h-3.5 w-3.5 ${deltaPositive ? '' : 'rotate-90'}`} strokeWidth={2} />
            <span className="font-medium tabular-nums">
              {deltaPositive ? '+' : ''}{delta30d.toFixed(1)} pts
            </span>
            <span className="text-muted-foreground">{t('gapV2.maturityHero.days30')}</span>
          </div>
          <div className="mt-4">
            <MaturityScale score={score} />
          </div>
        </div>

        {/* Coluna 2 — Próximo Marco */}
        <div className="p-6 border-t lg:border-t-0 lg:border-l border-border/60">
          <div className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
            {t('gapV2.maturityHero.nextMilestone')}
          </div>
          {nextMilestone ? (
            <>
              <h3 className="mt-2 text-base font-semibold leading-snug text-foreground">
                {nextMilestone.label}
              </h3>
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                {formatDateBR(nextMilestone.date)} · {t('gapV2.maturityHero.inDays', { days: daysUntil(nextMilestone.date) })}
              </div>
              {nextMilestone.targetScore && (
                <div className="mt-4">
                  <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary"
                      style={{ width: `${score}%` }}
                    />
                    <div
                      className="absolute inset-y-0 w-0.5 bg-foreground/40"
                      style={{ left: `${nextMilestone.targetScore}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] font-sans uppercase tracking-wider text-muted-foreground tabular-nums">
                    <span>{score}%</span>
                    <span>{t('gapV2.maturityHero.target', { target: nextMilestone.targetScore })}</span>
                    <span>100%</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {t('gapV2.maturityHero.defineMilestoneBody')}
              </p>
              <button
                type="button"
                className="mt-3 text-xs font-medium text-primary hover:underline"
                onClick={() => { /* TODO: abrir dialog quando schema existir */ }}
              >
                {t('gapV2.maturityHero.defineMilestoneCta')}
              </button>
            </>
          )}
        </div>

        {/* Coluna 3 — Gaps a Tratar */}
        <div className="p-6 border-t lg:border-t-0 lg:border-l border-border/60">
          <div className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
            {t('gapV2.maturityHero.gapsToTreat')}
          </div>
          <div className={`mt-2 text-5xl font-bold tabular-nums leading-none tracking-tight ${gapTone}`}>
            {criticalCount}
          </div>
          <p className="mt-2 text-sm text-foreground">
            {criticalCount > 0 ? t('gapV2.maturityHero.nonCompliantReqs') : t('gapV2.maturityHero.noCriticalGap')}
          </p>
          {criticalCount > 0 && (
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span className="tabular-nums font-medium text-foreground">{Math.min(criticalCount, Math.ceil(criticalCount * 0.4))}</span>
                <span className="text-muted-foreground">{t('gapV2.maturityHero.critical')}</span>
              </span>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                <span className="tabular-nums font-medium text-foreground">0</span>
                <span className="text-muted-foreground">{t('gapV2.maturityHero.overdue')}</span>
              </span>
            </div>
          )}
        </div>

        {/* Coluna 4 — Insight contextual */}
        <div className="p-6 border-t lg:border-t-0 lg:border-l border-border/60 bg-primary/[0.02]">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-sans uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" strokeWidth={1.5} />
            {t('gapV2.maturityHero.insight')}
          </div>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {insightCopy.body}
          </p>
          {onSeePlan && (
            <button
              type="button"
              onClick={onSeePlan}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:gap-1.5 transition-all"
            >
              {insightCopy.cta} →
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
