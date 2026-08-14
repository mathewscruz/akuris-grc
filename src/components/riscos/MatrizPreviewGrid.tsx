import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface PreviewEscalaItem {
  valor: string;
  descricao: string;
}

export interface PreviewNivelRisco {
  min: number;
  max: number;
  nivel: string;
  cor: string;
  apetite?: boolean;
}

interface Props {
  escalaProbabilidade: PreviewEscalaItem[];
  escalaImpacto: PreviewEscalaItem[];
  niveisRisco: PreviewNivelRisco[];
  metodoCalculo: 'multiplicacao' | 'soma';
  titulo?: string;
  legendaApetite?: string;
  eixoProbabilidade?: string;
  eixoImpacto?: string;
}

function scoreOf(p: number, i: number, metodo: 'multiplicacao' | 'soma') {
  return metodo === 'soma' ? p + i : p * i;
}

function faixaDoScore(score: number, niveis: PreviewNivelRisco[]) {
  return niveis.find((n) => score >= n.min && score <= n.max) ?? null;
}

/**
 * Grelha de pré-visualização NxM que recolore em tempo real conforme o
 * utilizador edita escalas, faixas, método de cálculo e limite de apetite.
 * Nunca assume 5x5 nem limiares fixos: tudo vem do estado atual do formulário.
 */
export function MatrizPreviewGrid({
  escalaProbabilidade,
  escalaImpacto,
  niveisRisco,
  metodoCalculo,
  titulo = 'Pré-visualização ao vivo',
  legendaApetite = 'Limite de apetite',
  eixoProbabilidade = 'Probabilidade',
  eixoImpacto = 'Impacto',
}: Props) {
  const [aberto, setAberto] = useState(true);

  const probs = useMemo(
    () => escalaProbabilidade.map((e, idx) => ({ ...e, num: Number(e.valor) || idx + 1 })),
    [escalaProbabilidade],
  );
  const impactos = useMemo(
    () => escalaImpacto.map((e, idx) => ({ ...e, num: Number(e.valor) || idx + 1 })),
    [escalaImpacto],
  );

  const apetiteMax = useMemo(() => {
    const marcado = niveisRisco.find((n) => n.apetite);
    return marcado ? marcado.max : null;
  }, [niveisRisco]);

  const linhas = [...probs].sort((a, b) => b.num - a.num); // maior probabilidade em cima
  const colunas = [...impactos].sort((a, b) => a.num - b.num);

  return (
    <section className="sticky top-0 z-20 -mx-1 px-1">
      <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Grid3X3 className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {titulo}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {linhas.length} × {colunas.length} ·{' '}
                {metodoCalculo === 'soma' ? 'P + I' : 'P × I'}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 shrink-0"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
          >
            {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {aberto && (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-[11px]">
              <thead>
                <tr>
                  <th className="w-24 text-left align-bottom pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    {eixoProbabilidade}
                  </th>
                  {colunas.map((c) => (
                    <th key={`h-${c.num}`} className="px-1 pb-1 text-center font-medium text-muted-foreground">
                      <span className="block tabular-nums text-foreground">{c.num}</span>
                      <span className="block truncate max-w-[86px] mx-auto">{c.descricao}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={`r-${l.num}`}>
                    <th className="text-right pr-2 font-medium text-muted-foreground align-middle">
                      <span className="tabular-nums text-foreground mr-1">{l.num}</span>
                      <span className="hidden sm:inline">{l.descricao}</span>
                    </th>
                    {colunas.map((c) => {
                      const score = scoreOf(l.num, c.num, metodoCalculo);
                      const faixa = faixaDoScore(score, niveisRisco);
                      const acimaApetite = apetiteMax != null && score > apetiteMax;
                      return (
                        <td key={`c-${l.num}-${c.num}`} className="p-0">
                          <div
                            className={cn(
                              'h-9 rounded-md flex items-center justify-center font-semibold tabular-nums text-white/95 transition-colors',
                              !faixa && 'border border-dashed border-border text-muted-foreground',
                              acimaApetite && 'ring-1 ring-foreground/50',
                            )}
                            style={faixa ? { backgroundColor: faixa.cor } : undefined}
                            title={`${score} · ${faixa?.nivel ?? '—'}`}
                          >
                            {score}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[...niveisRisco]
                .sort((a, b) => a.min - b.min)
                .map((n, idx) => (
                  <span
                    key={`${n.nivel}-${idx}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: n.cor }} />
                    {n.nivel || `Nível ${idx + 1}`}
                    <span className="tabular-nums opacity-70">
                      {n.min}–{n.max}
                    </span>
                  </span>
                ))}
              {apetiteMax != null && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/40 px-2 py-0.5 text-[10px] text-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-foreground/60" />
                  {legendaApetite} ≤ {apetiteMax}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">{eixoImpacto} →</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
