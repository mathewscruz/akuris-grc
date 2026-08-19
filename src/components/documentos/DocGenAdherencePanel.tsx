import React from 'react';
import { IconRefresh, IconChevronDown, IconShieldCheck } from '@/components/icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';

export interface AdherenceResult {
  score: number;
  resumo: string;
  secoes: Array<{
    section_index: number;
    section_name: string;
    status: 'forte' | 'parcial' | 'fraco' | 'ausente' | string;
    requisitos_cobertos: string[];
    gaps: string[];
  }>;
  requisitos_nao_cobertos: string[];
}

interface Props {
  result: AdherenceResult | null;
  loading?: boolean;
  frameworkName?: string;
  onRun: () => void;
}

const STATUS_TONE_MAP: Record<string, { tone: 'success' | 'warning' | 'destructive' | 'neutral'; mark: string }> = {
  forte: { tone: 'success', mark: 'B' },
  parcial: { tone: 'warning', mark: 'M' },
  fraco: { tone: 'destructive', mark: 'C' },
  ausente: { tone: 'neutral', mark: 'N' },
};

export const DocGenAdherencePanel: React.FC<Props> = ({ result, loading, frameworkName, onRun }) => {
  const { t } = useLanguage();
  if (!frameworkName) return null;

  const scoreColor =
    !result ? 'text-muted-foreground'
    : result.score >= 80 ? 'text-success'
    : result.score >= 60 ? 'text-warning'
    : 'text-destructive';

  return (
    <Collapsible defaultOpen={!!result} className="rounded-lg border border-border bg-card/50 mb-3">
      <div className="flex items-center justify-between p-3 gap-2">
        <CollapsibleTrigger className="flex items-center gap-2 group flex-1 text-left">
          <IconShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <span className="font-medium text-sm">{t('docgen.adherence.title')}</span>
          <Badge variant="outline" className="text-micro">{frameworkName}</Badge>
          {result && (
            <span className={`ml-2 text-sm font-semibold ${scoreColor}`}>{Math.round(result.score)}%</span>
          )}
          <IconChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.5} />
        </CollapsibleTrigger>
        <Button size="sm" variant="ghost" onClick={onRun} disabled={loading} className="gap-1 shrink-0">
          {loading ? <AkurisPulse size={14} /> : <IconRefresh className="h-3.5 w-3.5" strokeWidth={1.5} />}
          {result ? t('docgen.adherence.reevaluate') : t('docgen.adherence.evaluate')}
        </Button>
      </div>

      <CollapsibleContent className="px-3 pb-3 space-y-3 text-sm">
        {loading && !result && (
          <div className="text-xs text-muted-foreground">{t('docgen.adherence.analyzing')}</div>
        )}

        {result && (
          <>
            <p className="text-xs text-muted-foreground italic">{result.resumo}</p>

            {result.secoes?.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">{t('docgen.adherence.bySection')}</div>
                {result.secoes.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <StatusBadge
                      tone={STATUS_TONE_MAP[s.status]?.tone || 'neutral'}
                      mark={STATUS_TONE_MAP[s.status]?.mark}
                      className="shrink-0 capitalize"
                    >
                      {s.status}
                    </StatusBadge>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{s.section_name}</div>
                      {s.requisitos_cobertos?.length > 0 && (
                        <div className="text-muted-foreground">
                          {t('docgen.adherence.coverPrefix')}: {s.requisitos_cobertos.slice(0, 6).join(', ')}{s.requisitos_cobertos.length > 6 ? '…' : ''}
                        </div>
                      )}
                      {s.gaps?.length > 0 && (
                        <div className="text-destructive/90">{t('docgen.adherence.gapPrefix')}: {s.gaps[0]}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.requisitos_nao_cobertos?.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-1">
                  {t('docgen.adherence.uncoveredRequirements', { count: result.requisitos_nao_cobertos.length })}
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.requisitos_nao_cobertos.slice(0, 20).map((c, i) => (
                    <Badge key={i} variant="outline" className="text-micro">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
