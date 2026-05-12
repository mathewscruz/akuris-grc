import React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ShieldCheck, RefreshCw } from 'lucide-react';
import { AkurisPulse } from '@/components/ui/AkurisPulse';

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

const STATUS_TONES: Record<string, string> = {
  forte: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  parcial: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  fraco: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  ausente: 'bg-muted text-muted-foreground border-border',
};

export const DocGenAdherencePanel: React.FC<Props> = ({ result, loading, frameworkName, onRun }) => {
  if (!frameworkName) return null;

  const scoreColor =
    !result ? 'text-muted-foreground'
    : result.score >= 80 ? 'text-emerald-500'
    : result.score >= 60 ? 'text-amber-500'
    : 'text-rose-500';

  return (
    <Collapsible defaultOpen={!!result} className="rounded-lg border border-border bg-card/50 mb-3">
      <div className="flex items-center justify-between p-3 gap-2">
        <CollapsibleTrigger className="flex items-center gap-2 group flex-1 text-left">
          <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <span className="font-medium text-sm">Aderência ao framework</span>
          <Badge variant="outline" className="text-[10px]">{frameworkName}</Badge>
          {result && (
            <span className={`ml-2 text-sm font-semibold ${scoreColor}`}>{Math.round(result.score)}%</span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.5} />
        </CollapsibleTrigger>
        <Button size="sm" variant="ghost" onClick={onRun} disabled={loading} className="gap-1 shrink-0">
          {loading ? <AkurisPulse size={14} /> : <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />}
          {result ? 'Reavaliar' : 'Avaliar'}
        </Button>
      </div>

      <CollapsibleContent className="px-3 pb-3 space-y-3 text-sm">
        {loading && !result && (
          <div className="text-xs text-muted-foreground">Analisando documento contra os requisitos…</div>
        )}

        {result && (
          <>
            <p className="text-xs text-muted-foreground italic">{result.resumo}</p>

            {result.secoes?.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Por seção</div>
                {result.secoes.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className={`shrink-0 capitalize ${STATUS_TONES[s.status] || ''}`}>
                      {s.status}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{s.section_name}</div>
                      {s.requisitos_cobertos?.length > 0 && (
                        <div className="text-muted-foreground">
                          Cobre: {s.requisitos_cobertos.slice(0, 6).join(', ')}{s.requisitos_cobertos.length > 6 ? '…' : ''}
                        </div>
                      )}
                      {s.gaps?.length > 0 && (
                        <div className="text-rose-500/90">Gap: {s.gaps[0]}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.requisitos_nao_cobertos?.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Requisitos não cobertos ({result.requisitos_nao_cobertos.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.requisitos_nao_cobertos.slice(0, 20).map((c, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>
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
