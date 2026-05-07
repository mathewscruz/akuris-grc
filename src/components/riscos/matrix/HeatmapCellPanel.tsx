/**
 * HeatmapCellPanel — painel lateral sticky exibindo riscos da célula selecionada.
 */
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone, resolveRiscoStatusTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { relativeShort, severityFromScore, shortRiskId } from '@/components/riscos/risk-utils';

interface Risco {
  id: string;
  nome: string;
  status: string;
  nivel_risco_inicial: string;
  categoria?: { nome: string } | null;
  responsavel_nome?: string | null;
  updated_at?: string;
  created_at: string;
}

interface Props {
  cell: { p: number; i: number };
  risks: Risco[];
  onOpenRisk: (id: string) => void;
}

export function HeatmapCellPanel({ cell, risks, onOpenRisk }: Props) {
  const score = cell.p * cell.i;
  const sev = severityFromScore(score);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden lg:sticky lg:top-5">
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex justify-between items-start gap-3">
          <div>
            <div className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground mb-1">
              Célula selecionada
            </div>
            <div className="text-xl font-semibold tracking-tight">
              Prob {cell.p} × Imp {cell.i}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Score {score} · {risks.length} {risks.length === 1 ? 'risco' : 'riscos'}
            </div>
          </div>
          <StatusBadge size="sm" {...resolveNivelRiscoTone(sev === 'medio' ? 'Médio' : sev === 'critico' ? 'Crítico' : sev === 'alto' ? 'Alto' : 'Baixo')}>
            {sev === 'critico' ? 'Crítico' : sev === 'alto' ? 'Alto' : sev === 'medio' ? 'Médio' : 'Baixo'}
          </StatusBadge>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-1.5 max-h-[420px] overflow-y-auto">
        {risks.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum risco nesta célula.
          </div>
        ) : (
          risks.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onOpenRisk(r.id)}
              className="text-left p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors flex flex-col gap-1.5"
            >
              <div className="flex justify-between items-center">
                <span className="text-[10.5px] text-muted-foreground font-mono">{shortRiskId(r.id)}</span>
                <StatusBadge size="sm" {...resolveRiscoStatusTone(r.status)}>
                  {formatStatus(r.status)}
                </StatusBadge>
              </div>
              <div className="text-sm font-medium text-foreground leading-snug">{r.nome}</div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="truncate">{r.categoria?.nome || 'Sem categoria'} · {r.responsavel_nome || '—'}</span>
                <span className="flex-shrink-0 ml-2">{relativeShort(r.updated_at || r.created_at)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
