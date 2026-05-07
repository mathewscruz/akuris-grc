/**
 * RiskHeatmap — grade 5×5 Probabilidade × Impacto.
 * - Lê configuração da matriz da empresa (riscos_matriz_configuracao.niveis_risco) para colorir.
 * - Sem matriz cadastrada, cai em fallback por bandas de score.
 * - Clique numa célula seleciona-a (callback). Clique num badge dispara onOpenRisk.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { severityFromScore, shortRiskId, type Severity } from '@/components/riscos/risk-utils';

const PROB_LABELS = ['Raro', 'Improvável', 'Possível', 'Provável', 'Quase certo'];
const IMP_LABELS = ['Insignif.', 'Menor', 'Moderado', 'Maior', 'Catastróf.'];

interface Risco {
  id: string;
  probabilidade_inicial?: string;
  impacto_inicial?: string;
}

interface Props {
  riscos: Risco[];
  selected?: { p: number; i: number };
  onSelectCell: (cell: { p: number; i: number }) => void;
  onOpenRisk: (id: string) => void;
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

export function RiskHeatmap({ riscos, selected, onSelectCell, onOpenRisk }: Props) {
  const byCell = useMemo(() => {
    const map = new Map<string, Risco[]>();
    riscos.forEach((r) => {
      const p = Number(r.probabilidade_inicial) || 0;
      const i = Number(r.impacto_inicial) || 0;
      if (p < 1 || i < 1 || p > 5 || i > 5) return;
      const k = `${p}-${i}`;
      const arr = map.get(k) || [];
      arr.push(r);
      map.set(k, arr);
    });
    return map;
  }, [riscos]);

  const probs = [5, 4, 3, 2, 1];
  const imps = [1, 2, 3, 4, 5];

  const legend: { sev: Severity; label: string; cls: string }[] = [
    { sev: 'critico', label: 'Crítico', cls: 'bg-destructive' },
    { sev: 'alto', label: 'Alto', cls: 'bg-warning' },
    { sev: 'medio', label: 'Médio', cls: 'bg-warning/60' },
    { sev: 'baixo', label: 'Baixo', cls: 'bg-success' },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
            Probabilidade × Impacto
          </div>
          <div className="text-base font-semibold mt-1">Mapa de calor</div>
        </div>
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 items-center text-[11px] text-muted-foreground">
          {legend.map((l) => (
            <div key={l.sev} className="inline-flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 rounded-sm', l.cls)} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px] grid" style={{ gridTemplateColumns: 'auto 1fr', gap: 8 }}>
          <div
            className="self-center justify-self-center text-[10px] font-semibold uppercase tracking-[1.5px] text-muted-foreground"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Probabilidade
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
                  return (
                    <button
                      key={`${p}-${i}`}
                      type="button"
                      onClick={() => onSelectCell({ p, i })}
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
