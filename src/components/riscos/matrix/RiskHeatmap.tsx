/**
 * RiskHeatmap — grade P × I derivada da matriz configurada da empresa.
 * - Rótulos dos eixos vêm de riscos_matriz_configuracao (escalas), nunca de constantes.
 * - Grelha adapta-se a NxM conforme o número de níveis das escalas.
 * - Cores das células/chips/legenda vêm das faixas (min/max) da configuração.
 * - Modos: Inerente · Residual · Movimento (setas inerente → residual).
 * - Acessibilidade: severidade sempre com letra (C/A/M/B) além da cor,
 *   aria-label descritivo por célula e foco visível para navegação por teclado.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  severityFromScoreConfig,
  scoreFromMatriz,
  shortRiskId,
  toScaleNumber,
  computeMovimentos,
  resumoMovimento,
  SEVERITY_LETTER,
  type Severity,
} from '@/components/riscos/risk-utils';
import type { MatrizConfiguracao, EscalaItem } from '@/components/riscos/matriz-config';
import { useLanguage } from '@/contexts/LanguageContext';

export type HeatmapMode = 'inerente' | 'residual' | 'movimento';

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
  /** Inerente = P×I inicial; Residual = P×I residual; Movimento = seta entre ambos. */
  mode?: HeatmapMode;
  onModeChange?: (mode: HeatmapMode) => void;
  /** Configuração da matriz ativa: escalas (rótulos) e faixas (cores). */
  config?: MatrizConfiguracao | null;
}

const SEV_BG: Record<Severity, string> = {
  critico: 'bg-destructive/15',
  alto: 'bg-orange/15',
  medio: 'bg-warning/8',
  baixo: 'bg-success/12',
};

const SEV_BORDER: Record<Severity, string> = {
  critico: 'border-destructive/30',
  alto: 'border-orange/30',
  medio: 'border-warning/20',
  baixo: 'border-success/25',
};

const SEV_BADGE: Record<Severity, string> = {
  critico: 'bg-destructive text-destructive-foreground',
  alto: 'bg-orange text-orange-foreground',
  medio: 'bg-warning/70 text-warning-foreground',
  baixo: 'bg-success text-success-foreground',
};

const SEV_DOT: Record<Severity, string> = {
  critico: 'bg-destructive',
  alto: 'bg-orange',
  medio: 'bg-warning/60',
  baixo: 'bg-success',
};

/** Cor de traço (SVG) por severidade — tokens semânticos, nunca hex cru. */
const SEV_STROKE: Record<Severity, string> = {
  critico: 'hsl(var(--destructive))',
  alto: 'hsl(var(--orange))',
  medio: 'hsl(var(--warning) / 0.75)',
  baixo: 'hsl(var(--success))',
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
      mode === 'inerente'
        ? 0
        : riscos.filter(
            (r) => toScaleNumber(r.probabilidade_residual) === null || toScaleNumber(r.impacto_residual) === null,
          ).length,
    [riscos, mode],
  );

  const byCell = useMemo(() => {
    const map = new Map<string, Risco[]>();
    riscos.forEach((r) => {
      // No modo Movimento a célula base é sempre o inerente (origem da seta).
      const usaResidual = mode === 'residual';
      // Fonte única de verdade: aceita número ("1".."5") ou texto legado ("provavel").
      const p = toScaleNumber(usaResidual ? r.probabilidade_residual : r.probabilidade_inicial);
      const i = toScaleNumber(usaResidual ? r.impacto_residual : r.impacto_inicial);
      if (p === null || i === null) return;
      const k = `${p}-${i}`;
      const arr = map.get(k) || [];
      arr.push(r);
      map.set(k, arr);
    });
    return map;
  }, [riscos, mode]);

  // ── Movimento inerente → residual ──────────────────────────────────────────
  const movimentos = useMemo(
    () => (mode === 'movimento' ? computeMovimentos(riscos as any, niveis, metodo) : []),
    [riscos, mode, niveis, metodo],
  );
  const resumo = useMemo(() => resumoMovimento(movimentos), [movimentos]);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [centers, setCenters] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [hovered, setHovered] = useState<string | null>(null);

  const setCellRef = useCallback((key: string, el: HTMLElement | null) => {
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  }, []);

  const measure = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const gb = grid.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();
    cellRefs.current.forEach((el, key) => {
      const b = el.getBoundingClientRect();
      next.set(key, { x: b.left - gb.left + b.width / 2, y: b.top - gb.top + b.height / 2 });
    });
    setCenters(next);
    setBox({ w: gb.width, h: gb.height });
  }, []);

  useLayoutEffect(() => {
    if (mode !== 'movimento') return;
    measure();
  }, [mode, measure, riscos, PROB_LABELS.length, IMP_LABELS.length]);

  useEffect(() => {
    if (mode !== 'movimento') return;
    const ro = new ResizeObserver(() => measure());
    if (gridRef.current) ro.observe(gridRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [mode, measure]);

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
          return { key: `${n.nivel}-${n.min}`, label: `${n.nivel} (${n.min}–${n.max})`, cls: SEV_DOT[sev], letter: SEVERITY_LETTER[sev] };
        });
    }
    return (['critico', 'alto', 'medio', 'baixo'] as Severity[]).map((sev) => ({
      key: sev,
      label: t(`riscosVisoes.matrix.riskHeatmap.legenda.${sev}`),
      cls: SEV_DOT[sev],
      letter: SEVERITY_LETTER[sev],
    }));
  }, [niveis, t]);

  const modes: HeatmapMode[] = onModeChange ? ['inerente', 'residual', 'movimento'] : [];

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
              {mode === 'residual'
                ? t('riscosVisoes.matrix.riskHeatmap.residual')
                : mode === 'movimento'
                ? t('riscosVisoes.matrix.riskHeatmap.movimentoDesc')
                : t('riscosVisoes.matrix.riskHeatmap.inerente')}
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
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:opacity-40 disabled:pointer-events-none',
                )}
              >
                <X className="h-3 w-3" strokeWidth={2} />
                {t('riscosVisoes.matrix.riskHeatmap.limparSelecao')}
              </button>
            )}
            {/* Toggle Inerente / Residual / Movimento */}
            {onModeChange && (
              <div className="inline-flex p-0.5 bg-muted/60 rounded-md text-[11px]" role="group">
                {modes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onModeChange(m)}
                    aria-pressed={mode === m}
                    className={cn(
                      'px-2.5 py-1 rounded font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t(`riscosVisoes.matrix.riskHeatmap.modos.${m}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1 items-center text-[11px] text-muted-foreground">
            {legend.map((l) => (
              <div key={l.key} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn('h-3.5 w-3.5 rounded-sm inline-flex items-center justify-center text-[9px] font-bold', l.cls)}
                >
                  {l.letter}
                </span>
                {l.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {mode !== 'inerente' && semResidual > 0 && (
        <div className="-mt-2 mb-4 text-[11px] text-muted-foreground">
          {semResidual}{' '}
          {semResidual === 1
            ? t('riscosVisoes.matrix.riskHeatmap.semAvaliacaoResidual')
            : t('riscosVisoes.matrix.riskHeatmap.semAvaliacaoResidualPlural')}
          {mode === 'residual' ? ` — ${t('riscosVisoes.matrix.riskHeatmap.naoAparecemNoMapa')}` : ` — ${t('riscosVisoes.matrix.riskHeatmap.semSeta')}`}
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
            ref={gridRef}
            className="grid relative"
            style={{
              gridTemplateColumns: `auto repeat(${nImp}, 1fr)`,
              gridTemplateRows: `repeat(${nProb}, 76px) auto`,
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
                  const score = scoreFromMatriz(p, i, metodo);
                  const sev = severityFromScoreConfig(score, niveis);
                  const faixa = niveis?.find((n) => score >= n.min && score <= n.max);
                  const nivelLabel = faixa?.nivel ?? t(`riscosVisoes.matrix.riskHeatmap.legenda.${sev}`);

                  const cellRisks = byCell.get(`${p}-${i}`) || [];
                  const isSel = selected?.p === p && selected?.i === i;
                  const riskWord = cellRisks.length === 1 ? t('riscosVisoes.matrix.riskHeatmap.risco') : t('riscosVisoes.matrix.riskHeatmap.riscos');
                  // Bolha dimensionada pela contagem: 1 risco lê diferente de 3.
                  const bubble = Math.min(38, 22 + Math.min(cellRisks.length, 8) * 2.2);
                  return (
                    <button
                      key={`${p}-${i}`}
                      ref={(el) => setCellRef(`${p}-${i}`, el)}
                      type="button"
                      onClick={() => onSelectCell({ p, i })}
                      aria-pressed={isSel}
                      aria-label={t('riscosVisoes.matrix.riskHeatmap.ariaLabelCelula', {
                        p,
                        i,
                        score,
                        nivel: nivelLabel,
                        count: cellRisks.length,
                        label: riskWord,
                      })}
                      className={cn(
                        'rounded-lg border p-2 flex flex-col justify-between transition-transform text-left',
                        SEV_BG[sev],
                        SEV_BORDER[sev],
                        isSel && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                        'hover:scale-[1.02]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground tabular-nums">{score}</span>
                        <span
                          aria-hidden="true"
                          className="text-[9px] font-bold text-muted-foreground leading-none"
                          title={nivelLabel}
                        >
                          {SEVERITY_LETTER[sev]}
                        </span>
                      </div>
                      {cellRisks.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span
                            onClick={(e) => {
                              if (cellRisks.length === 1) {
                                e.stopPropagation();
                                onOpenRisk(cellRisks[0].id);
                              }
                            }}
                            style={{ height: bubble, width: bubble }}
                            className={cn(
                              'inline-flex items-center justify-center rounded-full font-semibold border-2 border-card tabular-nums text-[11px]',
                              SEV_BADGE[sev],
                              cellRisks.length === 1 && 'cursor-pointer',
                            )}
                            title={cellRisks.map((r) => shortRiskId(r.id, (r as any).codigo)).join(', ')}
                          >
                            {cellRisks.length}
                          </span>
                          <span className="text-[9.5px] text-muted-foreground leading-tight">
                            {cellRisks.length === 1 ? shortRiskId(cellRisks[0].id, (cellRisks[0] as any).codigo) : riskWord}
                          </span>
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

            {/* Camada de movimento: setas inerente → residual */}
            {mode === 'movimento' && centers.size > 0 && (
              <svg
                className="absolute inset-0"
                width={box.w}
                height={box.h}
                style={{ pointerEvents: 'none' }}
                aria-hidden="true"
              >
                {movimentos.map((m) => {
                  const a = centers.get(`${m.from.p}-${m.from.i}`);
                  if (!a) return null;
                  const dim = hovered !== null && hovered !== m.id;
                  const opacity = dim ? 0.12 : hovered === m.id ? 1 : 0.65;
                  const color = SEV_STROKE[(m.sevTo ?? m.sevFrom) as Severity];

                  // Sem residual avaliado: só o ponto de origem, tracejado.
                  if (!m.to) {
                    return (
                      <circle
                        key={m.id}
                        cx={a.x}
                        cy={a.y}
                        r={7}
                        fill="none"
                        stroke={SEV_STROKE[m.sevFrom]}
                        strokeWidth={1.4}
                        strokeDasharray="3 3"
                        opacity={opacity}
                      />
                    );
                  }

                  const b = centers.get(`${m.to.p}-${m.to.i}`);
                  if (!b) return null;

                  // Residual igual ao inerente: pequeno círculo, nunca uma seta.
                  if (m.to.p === m.from.p && m.to.i === m.from.i) {
                    return (
                      <circle
                        key={m.id}
                        cx={a.x}
                        cy={a.y}
                        r={6}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.6}
                        opacity={opacity}
                        style={{ pointerEvents: 'stroke' }}
                        onMouseEnter={() => setHovered(m.id)}
                        onMouseLeave={() => setHovered(null)}
                      />
                    );
                  }

                  const dx = b.x - a.x;
                  const dy = b.y - a.y;
                  const len = Math.hypot(dx, dy) || 1;
                  const ux = dx / len;
                  const uy = dy / len;
                  // Recua a ponta para não colar no centro da célula de destino.
                  const ex = b.x - ux * 10;
                  const ey = b.y - uy * 10;
                  const sx = a.x + ux * 8;
                  const sy = a.y + uy * 8;
                  // Curva suave: ponto de controlo deslocado na perpendicular.
                  const cx = (sx + ex) / 2 - uy * len * 0.14;
                  const cy = (sy + ey) / 2 + ux * len * 0.14;
                  const head = 5;
                  const hx = -uy;
                  const hy = ux;

                  return (
                    <g
                      key={m.id}
                      opacity={opacity}
                      style={{ pointerEvents: 'stroke', transition: 'opacity 120ms ease' }}
                      onMouseEnter={() => setHovered(m.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <path d={`M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={hovered === m.id ? 2 : 1.4} strokeLinecap="round" />
                      <circle cx={sx} cy={sy} r={2.4} fill={SEV_STROKE[m.sevFrom]} />
                      <polygon
                        points={`${ex + ux * head} ${ey + uy * head}, ${ex + hx * head * 0.6} ${ey + hy * head * 0.6}, ${ex - hx * head * 0.6} ${ey - hy * head * 0.6}`}
                        fill={color}
                        style={{ pointerEvents: 'all' }}
                      />
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
      </div>

      {mode === 'movimento' && (
        <div className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <strong className="text-foreground tabular-nums">{resumo.desceram}</strong>{' '}
            {resumo.desceram === 1
              ? t('riscosVisoes.matrix.riskHeatmap.resumo.desceuSingular')
              : t('riscosVisoes.matrix.riskHeatmap.resumo.desceuPlural')}
          </span>
          <span>
            <strong className="text-foreground tabular-nums">{resumo.mantiveram}</strong>{' '}
            {resumo.mantiveram === 1
              ? t('riscosVisoes.matrix.riskHeatmap.resumo.manteveSingular')
              : t('riscosVisoes.matrix.riskHeatmap.resumo.mantevePlural')}
          </span>
          <span>
            <strong className="text-foreground tabular-nums">{resumo.subiram}</strong>{' '}
            {resumo.subiram === 1
              ? t('riscosVisoes.matrix.riskHeatmap.resumo.subiuSingular')
              : t('riscosVisoes.matrix.riskHeatmap.resumo.subiuPlural')}
          </span>
        </div>
      )}
    </div>
  );
}
