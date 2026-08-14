/**
 * RiskHeatmap — grade P × I derivada da matriz configurada da empresa.
 * - Rótulos dos eixos vêm de riscos_matriz_configuracao (escalas), nunca de constantes.
 * - Grelha adapta-se a NxM conforme o número de níveis das escalas.
 * - Cores das células/chips/legenda vêm das faixas (min/max) da configuração.
 * - Clique numa célula seleciona-a (callback). Clique num badge dispara onOpenRisk.
 */
import { useMemo } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  severityFromScoreConfig,
  scoreFromMatriz,
  shortRiskId,
  toScaleNumber,
  type Severity,
} from '@/components/riscos/risk-utils';
import type { MatrizConfiguracao, EscalaItem } from '@/components/riscos/matriz-config';
import { useLanguage } from '@/contexts/LanguageContext';

export type HeatmapMode = 'inerente' | 'residual';

interface Risco {
  id: string;
  probabilidade_inicial?: string;
  impacto_inicial?: string;
  probabilidade_residual?: string;
  impacto_residual?: string;
}

interface Props {
  riscos: Risco[];
  selected?: { p: number; i: number };
  onSelectCell: (cell: { p: number; i: number }) => void;
  onOpenRisk: (id: string) => void;
  /**
   * Limpa a célula selecionada (AKURIS QA-060). Sem esta prop a ação não é
   * renderizada; com ela, o botão fica desabilitado enquanto nada está selecionado.
   */
  onClearSelection?: () => void;
  /** Inerente = P×I inicial (antes dos controles); Residual = P×I residual (após tratamento). */
  mode?: HeatmapMode;
  onModeChange?: (mode: HeatmapMode) => void;
  /** Configuração da matriz ativa: escalas (rótulos) e faixas (cores). */
  config?: MatrizConfiguracao | null;
}

const SEV_BG: Record<Severity, string> = {
  critico: 'bg-destructive/15',
  alto: 'bg-warning/15',
  medio: 'bg-warning/8',
  baixo: 'bg-success/12',
};

const SEV_BORDER: Record<Severity, string> = {
  critico: 'border-destructive/30',
  alto: 'border-warning/30',
  medio: 'border-warning/20',
  baixo: 'border-success/25',
};

const SEV_BADGE: Record<Severity, string> = {
  critico: 'bg-destructive text-destructive-foreground',
  alto: 'bg-warning text-warning-foreground',
  medio: 'bg-warning/70 text-warning-foreground',
  baixo: 'bg-success text-success-foreground',
};

const SEV_DOT: Record<Severity, string> = {
  critico: 'bg-destructive',
  alto: 'bg-warning',
  medio: 'bg-warning/60',
  baixo: 'bg-success',
};

/** Rótulos ordenados por valor 1..N a partir da escala configurada. */
function labelsFromEscala(escala?: EscalaItem[] | null, fallback?: string[]): string[] {
  if (escala && escala.length > 0) {
    return [...escala]
      .sort((a, b) => Number(a.valor) - Number(b.valor))
      .map((e) => e.descricao ?? '');
  }
  return fallback ?? [];
}

export function RiskHeatmap({ riscos, selected, onSelectCell, onClearSelection, onOpenRisk, mode = 'inerente', onModeChange, config }: Props) {
  const { t } = useLanguage();

  const fallbackProb = [1, 2, 3, 4, 5].map((n) => t(`riscosVisoes.matrix.riskHeatmap.probLabels.p${n}`));
  const fallbackImp = [1, 2, 3, 4, 5].map((n) => t(`riscosVisoes.matrix.riskHeatmap.impLabels.i${n}`));

  const PROB_LABELS = labelsFromEscala(config?.escala_probabilidade, fallbackProb);
  const IMP_LABELS = labelsFromEscala(config?.escala_impacto, fallbackImp);

  const niveis = config?.niveis_risco;
  const metodo = config?.metodo_calculo;

  // Quantos riscos não têm avaliação residual (não aparecem no mapa residual).
  const semResidual = useMemo(
    () =>
      mode === 'residual'
        ? riscos.filter(
            (r) => toScaleNumber(r.probabilidade_residual) === null || toScaleNumber(r.impacto_residual) === null,
          ).length
        : 0,
    [riscos, mode],
  );

  const byCell = useMemo(() => {
    const map = new Map<string, Risco[]>();
    riscos.forEach((r) => {
      // Fonte única de verdade: aceita número ("1".."5") ou texto legado ("provavel").
      const p = toScaleNumber(mode === 'residual' ? r.probabilidade_residual : r.probabilidade_inicial);
      const i = toScaleNumber(mode === 'residual' ? r.impacto_residual : r.impacto_inicial);
      if (p === null || i === null) return;
      const k = `${p}-${i}`;
      const arr = map.get(k) || [];
      arr.push(r);
      map.set(k, arr);
    });
    return map;
  }, [riscos, mode]);

  // Grelha NxM: número de níveis vem das escalas configuradas (fallback 5×5).
  const nProb = PROB_LABELS.length || 5;
  const nImp = IMP_LABELS.length || 5;
  const probs = Array.from({ length: nProb }, (_, ix) => nProb - ix);
  const imps = Array.from({ length: nImp }, (_, ix) => ix + 1);

  // Legenda derivada das faixas configuradas (ordem decrescente de severidade).
  const legend = useMemo(() => {
    if (niveis && niveis.length > 0) {
      return [...niveis]
        .sort((a, b) => b.max - a.max)
        .map((n) => {
          const sev = severityFromScoreConfig(n.max, niveis);
          return { key: `${n.nivel}-${n.min}`, label: `${n.nivel} (${n.min}–${n.max})`, cls: SEV_DOT[sev] };
        });
    }
    return [
      { key: 'critico', label: t('riscosVisoes.matrix.riskHeatmap.legenda.critico'), cls: SEV_DOT.critico },
      { key: 'alto', label: t('riscosVisoes.matrix.riskHeatmap.legenda.alto'), cls: SEV_DOT.alto },
      { key: 'medio', label: t('riscosVisoes.matrix.riskHeatmap.legenda.medio'), cls: SEV_DOT.medio },
      { key: 'baixo', label: t('riscosVisoes.matrix.riskHeatmap.legenda.baixo'), cls: SEV_DOT.baixo },
    ];
  }, [niveis, t]);


  return (
    <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
            {t('riscosVisoes.matrix.riskHeatmap.eyebrow')}
          </div>
          <div className="text-base font-semibold mt-1">
            {t('riscosVisoes.matrix.riskHeatmap.titulo')}
            <span className="text-muted-foreground font-normal">
              {' · '}
              {mode === 'residual' ? t('riscosVisoes.matrix.riskHeatmap.residual') : t('riscosVisoes.matrix.riskHeatmap.inerente')}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {/* Limpar seleção (AKURIS QA-060) — ação explícita; antes só dava
                para "limpar" alternando Inerente/Residual, que é um desvio. */}
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                disabled={!selected}
                aria-label={t('riscosVisoes.matrix.riskHeatmap.limparSelecao')}
                title={selected ? t('riscosVisoes.matrix.riskHeatmap.limparSelecao') : t('riscosVisoes.matrix.riskHeatmap.nenhumaCelulaSelecionada')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  'disabled:opacity-40 disabled:pointer-events-none',
                )}
              >
                <X className="h-3 w-3" strokeWidth={2} />
                {t('riscosVisoes.matrix.riskHeatmap.limparSelecao')}
              </button>
            )}
            {/* Toggle Inerente / Residual */}
            {onModeChange && (
              <div className="inline-flex p-0.5 bg-muted/60 rounded-md text-[11px]">
                {(['inerente', 'residual'] as HeatmapMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onModeChange(m)}
                    className={cn(
                      'px-2.5 py-1 rounded font-medium transition-colors capitalize',
                      mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1 items-center text-[11px] text-muted-foreground">
            {legend.map((l) => (
              <div key={l.key} className="inline-flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-sm', l.cls)} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {mode === 'residual' && semResidual > 0 && (
        <div className="-mt-2 mb-4 text-[11px] text-muted-foreground">
          {semResidual} {semResidual === 1 ? t('riscosVisoes.matrix.riskHeatmap.semAvaliacaoResidual') : t('riscosVisoes.matrix.riskHeatmap.semAvaliacaoResidualPlural')} — {t('riscosVisoes.matrix.riskHeatmap.naoAparecemNoMapa')}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[560px] grid" style={{ gridTemplateColumns: 'auto 1fr', gap: 8 }}>
          <div
            className="self-center justify-self-center text-[10px] font-semibold uppercase tracking-[1.5px] text-muted-foreground"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {t('riscosVisoes.matrix.riskHeatmap.probabilidadeVertical')}
          </div>
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'auto repeat(5, 1fr)',
              gridTemplateRows: 'repeat(5, 76px) auto',
              gap: 4,
            }}
          >
            {probs.map((p) => (
              <div key={`row-${p}`} className="contents">
                <div className="flex flex-col justify-center items-end pr-3 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground/85 text-[13px] leading-none">{p}</span>
                  <span className="text-[10px] mt-1">{PROB_LABELS[p - 1]}</span>
                </div>
                {imps.map((i) => {
                  const score = p * i;
                  const sev = severityFromScore(score);
                  const cellRisks = byCell.get(`${p}-${i}`) || [];
                  const isSel = selected?.p === p && selected?.i === i;
                  const riskWord = cellRisks.length === 1 ? t('riscosVisoes.matrix.riskHeatmap.risco') : t('riscosVisoes.matrix.riskHeatmap.riscos');
                  return (
                    <button
                      key={`${p}-${i}`}
                      type="button"
                      onClick={() => onSelectCell({ p, i })}
                      aria-pressed={isSel}
                      aria-label={t('riscosVisoes.matrix.riskHeatmap.ariaLabelCelula', { p, i, score, count: cellRisks.length, label: riskWord })}
                      className={cn(
                        'rounded-lg border p-2 flex flex-col justify-between transition-transform text-left',
                        SEV_BG[sev],
                        SEV_BORDER[sev],
                        isSel && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                        'hover:scale-[1.02]',
                      )}
                    >
                      <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                        {score}
                      </div>
                      {cellRisks.length > 0 && (
                        <div className="flex items-center gap-0.5">
                          {cellRisks.slice(0, 3).map((r, ix) => (
                            <span
                              key={r.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenRisk(r.id);
                              }}
                              className={cn(
                                'inline-flex items-center justify-center rounded-full font-semibold cursor-pointer border-2 border-card tabular-nums',
                                'h-6 w-6 text-[9.5px]',
                                SEV_BADGE[sev],
                                ix > 0 && '-ml-2',
                              )}
                              title={shortRiskId(r.id)}
                            >
                              {shortRiskId(r.id).split('-')[1]}
                            </span>
                          ))}
                          {cellRisks.length > 3 && (
                            <span className="text-[10px] text-foreground/80 font-semibold ml-1.5">
                              +{cellRisks.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            <div />
            {imps.map((i) => (
              <div key={`col-${i}`} className="text-center pt-2 text-[11px] text-muted-foreground">
                <div className="font-semibold text-foreground/85 text-[13px]">{i}</div>
                <div className="text-[10px]">{IMP_LABELS[i - 1]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
