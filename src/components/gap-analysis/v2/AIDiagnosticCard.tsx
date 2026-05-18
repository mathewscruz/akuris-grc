/**
 * AIDiagnosticCard — bloco editorial que renderiza a resposta do edge
 * `gap-analysis-ai-diagnostic`: status sugerido, confiança, pontos avaliados,
 * gaps e justificativa pronta para colar.
 * Sem cores cruas — apenas tokens.
 */
import { AkurisAIIcon } from '@/components/icons';
import { Check, X, AlertTriangle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AIBadge } from './AIBadge';

export interface AIDiagnosticResult {
  suggested_status: 'conforme' | 'parcial' | 'nao_conforme' | 'nao_aplicavel' | string;
  confidence: number;
  summary: string;
  evaluated_points: Array<{ label: string; status: 'ok' | 'partial' | 'missing' | string }>;
  gaps: string[];
  justification: string;
  analyzed_at?: string;
}

interface AIDiagnosticCardProps {
  result: AIDiagnosticResult;
  onApplyStatus?: (status: string) => void;
  onApplyJustification?: (text: string) => void;
  className?: string;
}

const STATUS_LABEL: Record<string, string> = {
  conforme: 'Conforme',
  parcial: 'Parcial',
  nao_conforme: 'Não Conforme',
  nao_aplicavel: 'N/A',
};

const STATUS_TONE: Record<string, string> = {
  conforme: 'text-success border-success/30 bg-success/10',
  parcial: 'text-warning border-warning/30 bg-warning/10',
  nao_conforme: 'text-destructive border-destructive/30 bg-destructive/10',
  nao_aplicavel: 'text-info border-info/30 bg-info/10',
};

const POINT_ICON = {
  ok: { icon: Check, cls: 'text-success' },
  partial: { icon: AlertTriangle, cls: 'text-warning' },
  missing: { icon: X, cls: 'text-destructive' },
};

export function AIDiagnosticCard({
  result,
  onApplyStatus,
  onApplyJustification,
  className,
}: AIDiagnosticCardProps) {
  const statusLabel = STATUS_LABEL[result.suggested_status] || result.suggested_status;
  const statusTone = STATUS_TONE[result.suggested_status] || 'text-muted-foreground border-border bg-muted/40';

  const copyJustification = async () => {
    try {
      await navigator.clipboard.writeText(result.justification);
      toast.success('Justificativa copiada');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-primary/30 bg-primary/[0.04] p-5', className)}>
      <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-primary" />

      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="h-9 w-9 shrink-0 rounded-md border border-primary/30 bg-primary/10 flex items-center justify-center">
          <AkurisAIIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
              Diagnóstico
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Confiança {result.confidence}%
            </span>
          </div>
          <h4 className="mt-1 text-sm font-semibold text-foreground">
            Status recomendado: {statusLabel}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{result.summary}</p>
        </div>
        {onApplyStatus && (
          <Button
            size="sm"
            variant="outline"
            className={cn('text-xs h-7 shrink-0', statusTone)}
            onClick={() => onApplyStatus(result.suggested_status)}
          >
            Aplicar
          </Button>
        )}
      </div>

      {/* Pontos avaliados */}
      {result.evaluated_points.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Pontos avaliados
          </div>
          <ul className="space-y-1.5">
            {result.evaluated_points.map((p, i) => {
              const cfg = POINT_ICON[p.status as keyof typeof POINT_ICON] || POINT_ICON.missing;
              const Icon = cfg.icon;
              return (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', cfg.cls)} strokeWidth={2} />
                  <span className="text-foreground/90">{p.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Gaps */}
      {result.gaps.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Gaps identificados
          </div>
          <ul className="space-y-1 list-disc list-inside text-xs text-foreground/80">
            {result.gaps.map((g, i) => (<li key={i}>{g}</li>))}
          </ul>
        </div>
      )}

      {/* Justificativa */}
      {result.justification && (
        <div className="border-t border-primary/20 pt-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Justificativa sugerida
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={copyJustification}
              >
                <Copy className="h-3 w-3 mr-1" strokeWidth={1.5} />
                Copiar
              </Button>
              {onApplyJustification && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] text-primary"
                  onClick={() => onApplyJustification(result.justification)}
                >
                  Usar
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-foreground leading-relaxed font-mono bg-background/60 rounded p-2 border border-border/60">
            {result.justification}
          </p>
        </div>
      )}
    </div>
  );
}
