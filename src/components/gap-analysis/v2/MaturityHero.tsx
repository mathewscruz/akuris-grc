/**
 * MaturityHero — dashboard editorial de abertura (Frameworks).
 * 4 colunas: Maturidade · Próximo Marco · Gaps a Tratar · Insight da IA.
 * Identidade Akuris (DM Sans, tokens semânticos, sem cores cruas).
 */
import { CornerAccent } from '@/components/identity/CornerAccent';
import { StatusBadge } from '@/components/ui/status-badge';
import { MaturityScale, getMaturityLevel } from './MaturityScale';
import type { StackSegment } from './StackBar';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconArrowUpRight } from '@/components/icons';
import { intlLocale } from '@/lib/date-utils';

interface MaturityHeroProps {
  overallScore: number;
  /** Mantido por compat — não usado no layout 4-col atual. */
  segments?: StackSegment[];
  totalRequirements: number;
  totalEvaluated: number;
  /** Requisitos não conformes (gaps em aberto). */
  openGaps?: number;
  /** Subconjunto crítico dos gaps (peso alto ou prazo vencido). */
  criticalCount: number;
  /** Subconjunto de gaps com prazo vencido. */
  overdueCount?: number;
  activeFrameworksCount: number;
  /**
   * Variação do índice nos últimos 30 dias. `null`/omitido = ainda não há
   * histórico com que comparar, e nesse caso a linha não é desenhada.
   */
  delta30d?: number | null;
  /**
   * Marco em aberto mais próximo — **de um framework**, nunca da empresa.
   *
   * A empresa escolhe quantos frameworks quiser, e "faltam 35 pontos para a
   * meta" não quer dizer nada contra a média ponderada de ISO 27001, LGPD e
   * NIST CSF. Por isso o marco vem identificado pelo framework, e a barra
   * compara o score **daquele** framework, não o índice da carteira. Definir e
   * editar acontece dentro do framework.
   */
  nextMilestone?: {
    label: string;
    date: string;
    targetScore: number;
    frameworkName: string;
    frameworkScore: number;
  };
  onSeePlan?: () => void;
  /** Abre o framework do marco, ou a lista quando ainda não há nenhum. */
  onOpenMilestone?: () => void;
}

function formatDateBR(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(intlLocale(), {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

/** Dias até a data; negativo quando o prazo já passou. */
function daysUntil(iso: string): number {
  const d = new Date(iso).getTime();
  return Math.ceil((d - Date.now()) / 86400000);
}

export function MaturityHero({
  overallScore,
  totalRequirements,
  totalEvaluated,
  openGaps,
  criticalCount,
  overdueCount = 0,
  activeFrameworksCount,
  delta30d = null,
  nextMilestone,
  onSeePlan,
  onOpenMilestone,
}: MaturityHeroProps) {
  const { t } = useLanguage();
  const score = Math.round(Number(overallScore) || 0);
  const maturity = getMaturityLevel(score, t);
  const coverage = totalRequirements > 0
    ? Math.round((totalEvaluated / totalRequirements) * 100)
    : 0;
  // Zero não é ganho, e ausência de histórico não é zero.
  //
  // A propriedade nunca era passada, portanto `delta30d` valia sempre 0; como o
  // teste era `>= 0`, todo inquilino via **"+0,0 pts" a verde com seta para
  // cima** — o produto a comemorar que nada mudou. Agora há três estados: sem
  // base de comparação a linha não existe, zero é neutro, e só variação real
  // ganha cor.
  const temDelta = typeof delta30d === 'number';
  const delta = delta30d ?? 0;
  const deltaTom = delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground';
  const gapsAbertos = typeof openGaps === 'number' ? openGaps : criticalCount;

  // Insight contextual gerado client-side
  const insightCopy = (() => {
    if (totalEvaluated === 0) {
      return {
        body: <>{t('gapV2.maturityHero.insightStartBody')}</>,
        cta: t('gapV2.maturityHero.insightStartCta'),
      };
    }
    if (delta > 0 && nextMilestone) {
      const projected = Math.min(100, Math.round(nextMilestone.frameworkScore + delta));
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

  const gapTone = gapsAbertos > 0 ? 'text-destructive' : 'text-success';
  const diasAteAoMarco = nextMilestone ? daysUntil(nextMilestone.date) : 0;

  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-card">
      <CornerAccent position="top-left" />
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_0.9fr_1.2fr]">
        {/* Coluna 1 — Maturidade */}
        <div className="p-6 lg:pr-7">
          <div className="text-xs text-muted-foreground">
            {t('gapV2.maturityHero.maturityIndex')} · {activeFrameworksCount} {activeFrameworksCount === 1 ? t('gapV2.maturityHero.activeFrameworkSingular') : t('gapV2.maturityHero.activeFrameworkPlural')}
          </div>
          <div className="mt-2 flex items-end gap-3 flex-wrap">
            <div className="flex items-baseline">
              <span className="text-6xl font-bold tabular-nums leading-none tracking-tight text-foreground">
                {score}
              </span>
              <span className="text-2xl text-muted-foreground ml-0.5">%</span>
            </div>
            <StatusBadge tone="info">
              {t('gapV2.maturityHero.level', { id: maturity.id, label: maturity.label })}
            </StatusBadge>
          </div>
          {temDelta && (
            <div className={`mt-2 inline-flex items-center gap-1.5 text-xs ${deltaTom}`}>
              {delta !== 0 && (
                <IconArrowUpRight
                  className={`h-3.5 w-3.5 ${delta > 0 ? '' : 'rotate-90'}`}
                  strokeWidth={2}
                />
              )}
              <span className="font-medium tabular-nums">
                {delta > 0 ? '+' : ''}{delta.toFixed(1)} pts
              </span>
              <span className="text-muted-foreground">{t('gapV2.maturityHero.days30')}</span>
            </div>
          )}
          <div className="mt-4">
            <MaturityScale score={score} />
          </div>
        </div>

        {/* Coluna 2 — Próximo Marco */}
        <div className="p-6 border-t lg:border-t-0 lg:border-l border-border/60">
          <div className="text-xs text-muted-foreground">
            {t('gapV2.maturityHero.nextMilestone')}
          </div>
          {nextMilestone ? (
            <>
              <div className="mt-2 text-xs text-primary truncate">
                {nextMilestone.frameworkName}
              </div>
              <h3 className="mt-0.5 text-base font-semibold leading-snug text-foreground">
                {nextMilestone.label}
              </h3>
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                {formatDateBR(nextMilestone.date)} ·{' '}
                {diasAteAoMarco < 0 ? (
                  <span className="text-destructive">{t('gapV2.marco.atrasado')}</span>
                ) : (
                  t('gapV2.maturityHero.inDays', { days: diasAteAoMarco })
                )}
              </div>
              <div className="mt-4">
                <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary"
                    style={{ width: `${nextMilestone.frameworkScore}%` }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 bg-foreground/40"
                    style={{ left: `${nextMilestone.targetScore}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                  <span>{nextMilestone.frameworkScore}%</span>
                  <span>{t('gapV2.maturityHero.target', { target: nextMilestone.targetScore })}</span>
                  <span>100%</span>
                </div>
                <div className="mt-1.5 text-xs tabular-nums">
                  {nextMilestone.frameworkScore >= nextMilestone.targetScore ? (
                    <span className="text-success">{t('gapV2.marco.metaAtingida')}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t('gapV2.marco.faltam', {
                        pts: nextMilestone.targetScore - nextMilestone.frameworkScore,
                      })}
                    </span>
                  )}
                </div>
              </div>
              {onOpenMilestone && (
                <button
                  type="button"
                  className="mt-3 text-xs font-medium text-primary hover:underline"
                  onClick={onOpenMilestone}
                >
                  {t('gapV2.marco.abrirFramework')}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {t('gapV2.marco.semMarcoNaLista')}
              </p>
              {onOpenMilestone && (
                <button
                  type="button"
                  className="mt-3 text-xs font-medium text-primary hover:underline"
                  onClick={onOpenMilestone}
                >
                  {t('gapV2.marco.escolherFramework')}
                </button>
              )}
            </>
          )}
        </div>

        {/* Coluna 3 — Gaps a Tratar */}
        <div className="p-6 border-t lg:border-t-0 lg:border-l border-border/60">
          <div className="text-xs text-muted-foreground">
            {t('gapV2.maturityHero.gapsToTreat')}
          </div>
          <div className={`mt-2 text-5xl font-bold tabular-nums leading-none tracking-tight ${gapTone}`}>
            {gapsAbertos}
          </div>
          <p className="mt-2 text-sm text-foreground">
            {gapsAbertos > 0 ? t('gapV2.maturityHero.nonCompliantReqs') : t('gapV2.maturityHero.noCriticalGap')}
          </p>
          {gapsAbertos > 0 && (
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span className="tabular-nums font-medium text-foreground">{criticalCount}</span>
                <span className="text-muted-foreground">{t('gapV2.maturityHero.critical')}</span>
              </span>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                <span className="tabular-nums font-medium text-foreground">{overdueCount}</span>
                <span className="text-muted-foreground">{t('gapV2.maturityHero.overdue')}</span>
              </span>
            </div>
          )}
        </div>

        {/* Coluna 4 — Insight contextual */}
        <div className="p-6 border-t lg:border-t-0 lg:border-l border-border/60 bg-primary/[0.02]">
          <div className="text-xs text-muted-foreground">
            {t('gapV2.maturityHero.insight')}
          </div>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {insightCopy.body}
          </p>
          {onSeePlan && (
            <button
              type="button"
              onClick={onSeePlan}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:gap-1.5 transition-ui"
            >
              {insightCopy.cta} →
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
