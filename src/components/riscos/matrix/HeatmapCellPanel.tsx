/**
 * HeatmapCellPanel — painel lateral sticky exibindo riscos da célula selecionada.
 */
;
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone, resolveRiscoStatusTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { relativeShort, scoreFromMatriz, severityFromScoreConfig, shortRiskId } from '@/components/riscos/risk-utils';
import type { MatrizConfiguracao } from '@/components/riscos/matriz-config';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconClose } from '@/components/icons';

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
  /** Limpa a seleção (AKURIS QA-060). Sem a prop, a ação não é renderizada. */
  onClearSelection?: () => void;
  /** Configuração da matriz ativa: método de cálculo e faixas de severidade. */
  config?: MatrizConfiguracao | null;
}

export function HeatmapCellPanel({ cell, risks, onOpenRisk, onClearSelection, config }: Props) {
  const { t } = useLanguage();
  const score = scoreFromMatriz(cell.p, cell.i, config?.metodo_calculo);
  // Severidade derivada das faixas da matriz ativa (AKURIS QA-061).
  const faixa = config?.niveis_risco?.find((n) => score >= n.min && score <= n.max) ?? null;
  const sev = severityFromScoreConfig(score, config?.niveis_risco);
  const nivelLabel = {
    medio: t('riscosVisoes.matrix.heatmapCellPanel.nivel.medio'),
    critico: t('riscosVisoes.matrix.heatmapCellPanel.nivel.critico'),
    alto: t('riscosVisoes.matrix.heatmapCellPanel.nivel.alto'),
    baixo: t('riscosVisoes.matrix.heatmapCellPanel.nivel.baixo'),
  }[sev];
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden lg:sticky lg:top-5">
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex justify-between items-start gap-3">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">
              {t('riscosVisoes.matrix.heatmapCellPanel.celulaSelecionada')}
            </div>
            <div className="text-xl font-semibold tracking-tight">
              {t('riscosVisoes.matrix.heatmapCellPanel.prob')} {cell.p} × {t('riscosVisoes.matrix.heatmapCellPanel.imp')} {cell.i}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t('riscosVisoes.matrix.heatmapCellPanel.score')} {score} · {risks.length} {risks.length === 1 ? t('riscosVisoes.matrix.heatmapCellPanel.risco') : t('riscosVisoes.matrix.heatmapCellPanel.riscos')}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge {...resolveNivelRiscoTone(sev === 'medio' ? 'Médio' : sev === 'critico' ? 'Crítico' : sev === 'alto' ? 'Alto' : 'Baixo')}>
              {faixa ? faixa.nivel : nivelLabel}
            </StatusBadge>
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                aria-label={t('riscosVisoes.matrix.heatmapCellPanel.limparSelecao')}
                title={t('riscosVisoes.matrix.heatmapCellPanel.limparSelecao')}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <IconClose className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-1.5 max-h-[420px] overflow-y-auto">
        {risks.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t('riscosVisoes.matrix.heatmapCellPanel.nenhumRisco')}
          </div>
        ) : (
          risks.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onOpenRisk(r.id)}
              className="text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors flex flex-col gap-1.5"
            >
              <div className="flex justify-between items-center">
                <span className="text-micro text-muted-foreground font-mono">{shortRiskId(r.id, (r as any).codigo)}</span>
                <StatusBadge {...resolveRiscoStatusTone(r.status)}>
                  {formatStatus(r.status)}
                </StatusBadge>
              </div>
              <div className="text-sm font-medium text-foreground leading-snug">{r.nome}</div>
              <div className="flex justify-between text-micro text-muted-foreground">
                <span className="truncate">{r.categoria?.nome || t('riscosVisoes.matrix.heatmapCellPanel.semCategoria')} · {r.responsavel_nome || '—'}</span>
                <span className="flex-shrink-0 ml-2">{relativeShort(r.updated_at || r.created_at)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
