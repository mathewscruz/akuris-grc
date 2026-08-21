/**
 * RiskWatchlist — top 5 riscos prioritários (acima do apetite, ordenados por score desc).
 * Clique abre o RiscoDetailDrawer.
 */
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone, resolveRiscoStatusTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import {
  severidadeRisco,
  isAcimaDoApetite,
  scoreRisco,
  type FaixaMatriz,
} from '@/lib/metrics/riscos';
import { deriveRiscoStatus } from '@/components/riscos/risk-status';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconTime, IconChevron, IconArrowRight } from '@/components/icons';
import { initials, relativeShort, shortRiskId } from '@/components/riscos/risk-utils';

/** Status coerente com a evidência de tratamentos (a mesma regra da tabela). */
const statusExibido = (r: { status: string; tratamentos_requeridos?: number; tratamentos_concluidos?: number }) =>
  deriveRiscoStatus(r.status, {
    requeridos: r.tratamentos_requeridos ?? 0,
    concluidos: r.tratamentos_concluidos ?? 0,
  }).status;

interface Risco {
  id: string;
  nome: string;
  status: string;
  tratamentos_requeridos?: number;
  tratamentos_concluidos?: number;
  nivel_risco_inicial: string;
  nivel_risco_residual?: string | null;
  score_efetivo?: number | null;
  score_inicial?: number | null;
  score_residual?: number | null;
  severidade_efetiva?: string | null;
  severidade_inicial?: string | null;
  severidade_residual?: string | null;
  responsavel_nome?: string | null;
  responsavel_foto?: string | null;
  categoria?: { nome: string } | null;
  updated_at?: string;
  created_at: string;
}

interface Props {
  riscos: Risco[];
  totalCount: number;
  /** Score máximo aceitável, das faixas da matriz da empresa. */
  apetiteScore?: number | null;
  /** Faixas da matriz activa, para o rótulo de severidade. */
  faixas?: FaixaMatriz[] | null;
  onOpenRisk: (id: string) => void;
  onSeeAll?: () => void;
}

export function RiskWatchlist({ riscos, totalCount, apetiteScore, faixas, onOpenRisk, onSeeAll }: Props) {
  const { t } = useLanguage();
  const watchlist = [...riscos]
    // `.filter(isAcimaApetite)` passava o ÍNDICE do array como segundo
    // argumento, e a função lê o segundo argumento como limite de apetite. A
    // regra virava "score > posição na lista": um risco Crítico de score 20 na
    // posição 30 desaparecia da lista de prioridades.
    .filter((r) => isAcimaDoApetite(r, apetiteScore))
    .sort((a, b) => (scoreRisco(b) ?? 0) - (scoreRisco(a) ?? 0))
    .slice(0, 5);

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted-foreground">
            {t('riscosVisoes.overview.riskWatchlist.eyebrow')}
          </div>
          <div className="text-base font-semibold mt-0.5">
            {t('riscosVisoes.overview.riskWatchlist.titulo')}
          </div>
        </div>
        {onSeeAll && (
          <Button variant="ghost" size="sm" onClick={onSeeAll}>
            {t('riscosVisoes.overview.riskWatchlist.verTodos', { count: totalCount })}
            <IconArrowRight className="h-3.5 w-3.5 ml-1" strokeWidth={1.5} />
          </Button>
        )}
      </div>

      {watchlist.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {t('riscosVisoes.overview.riskWatchlist.nenhumRisco')}
        </div>
      ) : (
        <ul>
          {watchlist.map((r, idx) => {
            const nivel = r.nivel_risco_residual || r.nivel_risco_inicial;
            const sev = severidadeRisco(r, faixas);
            const sevDot =
              sev === 'critico' ? 'bg-destructive' :
              sev === 'alto' ? 'bg-warning' :
              sev === 'medio' ? 'bg-warning/60' : 'bg-success';
            const sevHalo =
              sev === 'critico' ? 'ring-destructive/20' :
              sev === 'alto' ? 'ring-warning/25' :
              sev === 'medio' ? 'ring-warning/15' : 'ring-success/25';
            const score = scoreRisco(r);
            return (
              <li
                key={r.id}
                onClick={() => onOpenRisk(r.id)}
                className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-accent transition-colors ${idx > 0 ? 'border-t border-border' : ''}`}
              >
                <span className={cn('h-2 w-2 rounded-full flex-shrink-0 ring-[3px]', sevDot, sevHalo)} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{r.nome}</div>
                  <div className="text-micro text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span className="font-mono">{shortRiskId(r.id, (r as any).codigo)}</span>
                    <span>·</span>
                    <span className="truncate">{r.categoria?.nome || t('riscosVisoes.overview.riskWatchlist.semCategoria')}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <IconTime className="h-3 w-3" strokeWidth={1.5} />
                      {relativeShort(r.updated_at || r.created_at)}
                    </span>
                  </div>
                </div>
                <StatusBadge {...resolveNivelRiscoTone(sev)}>
                  {formatStatus(nivel)}{score !== null ? ` · ${score}` : ''}
                </StatusBadge>
                {/* Status coerente com os tratamentos, como na tabela. A
                    watchlist lia `r.status` cru: o mesmo risco aparecia
                    "Tratado" aqui e "Analisado" na aba ao lado. */}
                <StatusBadge {...resolveRiscoStatusTone(statusExibido(r))}>
                  {formatStatus(statusExibido(r))}
                </StatusBadge>
                <div className="inline-flex items-center gap-2 text-xs text-foreground/85">
                  <Avatar className="h-6 w-6">
                    {r.responsavel_foto && <AvatarImage src={r.responsavel_foto} alt={r.responsavel_nome || ''} />}
                    <AvatarFallback className="text-micro bg-primary/10 text-primary">
                      {initials(r.responsavel_nome)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline truncate max-w-[100px]">
                    {r.responsavel_nome?.split(' ').slice(-1)[0] || '—'}
                  </span>
                </div>
                <IconChevron className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
