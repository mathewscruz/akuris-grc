/**
 * AssessmentInsightsStrip — três cartões editoriais para a página de Avaliação.
 * Mostra: COBERTURA (avaliados/total), CRITICIDADE (não conformes ponderados),
 * PRAZOS (requisitos com data próxima ou vencida).
 * Sem cores cruas — usa StackBar e tokens semânticos.
 */
import { CornerAccent } from '@/components/identity/CornerAccent';
import { ArrowRight } from 'lucide-react';

export interface AssessmentInsight {
  eyebrow: string;
  title: string;
  value: string | number;
  hint: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'critical';
  ctaLabel?: string;
  onCta?: () => void;
}

interface AssessmentInsightsStripProps {
  insights: AssessmentInsight[];
}

const RIBBON: Record<NonNullable<AssessmentInsight['tone']>, string> = {
  neutral: 'bg-muted-foreground/40',
  positive: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-destructive',
};

const VALUE_TONE: Record<NonNullable<AssessmentInsight['tone']>, string> = {
  neutral: 'text-foreground',
  positive: 'text-success',
  warning: 'text-warning',
  critical: 'text-destructive',
};

export function AssessmentInsightsStrip({ insights }: AssessmentInsightsStripProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {insights.map((ins, i) => {
        const tone = ins.tone || 'neutral';
        return (
          <article
            key={i}
            className="relative overflow-hidden rounded-xl border border-border bg-card pl-5 pr-4 py-4"
          >
            <span className={`absolute left-0 top-3 bottom-3 w-[2px] rounded-r ${RIBBON[tone]}`} />
            {i === 0 && <CornerAccent position="top-right" size={10} />}

            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {ins.eyebrow}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-3xl font-semibold tabular-nums leading-none tracking-tight ${VALUE_TONE[tone]}`}>
                {ins.value}
              </span>
              <span className="text-sm font-medium text-foreground">{ins.title}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{ins.hint}</p>

            {ins.ctaLabel && ins.onCta && (
              <button
                type="button"
                onClick={ins.onCta}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:gap-1.5 transition-all"
              >
                {ins.ctaLabel}
                <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
