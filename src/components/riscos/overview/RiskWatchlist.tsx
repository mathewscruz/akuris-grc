/**
 * RiskWatchlist — top 5 riscos prioritários (acima do apetite, ordenados por score desc).
 * Clique abre o RiscoDetailDrawer.
 */
import { ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone, resolveRiscoStatusTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import {
  initials,
  isAcimaApetite,
  relativeShort,
  scoreFromPI,
  shortRiskId,
} from '@/components/riscos/risk-utils';

interface Risco {
  id: string;
  nome: string;
  status: string;
  nivel_risco_inicial: string;
  nivel_risco_residual?: string | null;
  probabilidade_inicial?: string;
  impacto_inicial?: string;
  probabilidade_residual?: string;
  impacto_residual?: string;
  responsavel_nome?: string | null;
  responsavel_foto?: string | null;
  categoria?: { nome: string } | null;
  updated_at?: string;
  created_at: string;
}

interface Props {
  riscos: Risco[];
  totalCount: number;
  onOpenRisk: (id: string) => void;
  onSeeAll?: () => void;
}

export function RiskWatchlist({ riscos, totalCount, onOpenRisk, onSeeAll }: Props) {
  const watchlist = [...riscos]
    .filter(isAcimaApetite)
    .sort((a, b) => {
      const sa = scoreFromPI(a.probabilidade_residual || a.probabilidade_inicial, a.impacto_residual || a.impacto_inicial);
      const sb = scoreFromPI(b.probabilidade_residual || b.probabilidade_inicial, b.impacto_residual || b.impacto_inicial);
      return sb - sa;
    })
    .slice(0, 5);

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
            Watchlist
          </div>
          <div className="text-base font-semibold mt-0.5">
            Riscos que precisam de decisão esta semana
          </div>
        </div>
        {onSeeAll && (
          <Button variant="ghost" size="sm" onClick={onSeeAll}>
            Ver todos os {totalCount}
            <ArrowRight className="h-3.5 w-3.5 ml-1" strokeWidth={1.5} />
          </Button>
        )}
      </div>

      {watchlist.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nenhum risco acima do apetite no momento.
        </div>
      ) : (
        <ul>
          {watchlist.map((r, idx) => {
            const nivel = r.nivel_risco_residual || r.nivel_risco_inicial;
            const score = scoreFromPI(
              r.probabilidade_residual || r.probabilidade_inicial,
              r.impacto_residual || r.impacto_inicial,
            );
            return (
              <li
                key={r.id}
                onClick={() => onOpenRisk(r.id)}
                className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors ${idx > 0 ? 'border-t border-border' : ''}`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-destructive flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{r.nome}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span className="font-mono">{shortRiskId(r.id)}</span>
                    <span>·</span>
                    <span className="truncate">{r.categoria?.nome || 'Sem categoria'}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" strokeWidth={1.5} />
                      {relativeShort(r.updated_at || r.created_at)}
                    </span>
                  </div>
                </div>
                <StatusBadge size="sm" {...resolveNivelRiscoTone(nivel)}>
                  {formatStatus(nivel)} · {score}
                </StatusBadge>
                <StatusBadge size="sm" {...resolveRiscoStatusTone(r.status)}>
                  {formatStatus(r.status)}
                </StatusBadge>
                <div className="inline-flex items-center gap-2 text-xs text-foreground/85">
                  <Avatar className="h-6 w-6">
                    {r.responsavel_foto && <AvatarImage src={r.responsavel_foto} alt={r.responsavel_nome || ''} />}
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {initials(r.responsavel_nome)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline truncate max-w-[100px]">
                    {r.responsavel_nome?.split(' ').slice(-1)[0] || '—'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
