import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { IconChevronDown, IconChevronUp, IconGrid } from '@/components/icons';
import { SEVERITY_LETTER, severidadePrevista } from '@/components/riscos/risk-utils';
import { pinturaDoNivel } from './matrix/pintura-da-matriz';
import { LegendaDaMatriz } from './matrix/LegendaDaMatriz';

export interface PreviewEscalaItem {
  valor: string;
  descricao: string;
}

export interface PreviewNivelRisco {
  min: number;
  max: number;
  nivel: string;
  cor?: string;
  apetite?: boolean;
}

interface Props {
  escalaProbabilidade: PreviewEscalaItem[];
  escalaImpacto: PreviewEscalaItem[];
  niveisRisco: PreviewNivelRisco[];
  metodoCalculo: 'multiplicacao' | 'soma';
  /** Limite de apetite em score. Vem da coluna, não de uma flag no JSON. */
  apetiteScore?: number | null;
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
  apetiteScore,
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
    if (typeof apetiteScore === 'number') return apetiteScore;
    const marcado = niveisRisco.find((n) => n.apetite);
    return marcado ? marcado.max : null;
  }, [niveisRisco, apetiteScore]);

  const linhas = [...probs].sort((a, b) => b.num - a.num); // maior probabilidade em cima
  const colunas = [...impactos].sort((a, b) => a.num - b.num);

  return (
    <section className="sticky top-0 z-20 -mx-1 px-1">
      <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <IconGrid className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs text-muted-foreground font-medium">
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
            {aberto ? <IconChevronUp className="h-4 w-4" /> : <IconChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {aberto && (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-micro">
              <thead>
                <tr>
                  <th className="w-24 text-left align-bottom pb-1 text-xs text-muted-foreground font-medium">
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
                      /*
                        A mesma célula do mapa de calor, em ponto pequeno.

                        Era um bloco SÓLIDO com o número a branco; o mapa de
                        calor da aba Matriz é um fundo tenue com o score num
                        canto e a letra da severidade no outro. A mesma matriz,
                        dois desenhos — e este é o que se chama
                        «pré-visualização». Agora previsualiza mesmo.
                      */
                      const sev = severidadePrevista(score, niveisRisco as never) ?? 'baixo';
                      const pintura = pinturaDoNivel(faixa, sev);
                      return (
                        <td key={`c-${l.num}-${c.num}`} className="p-0">
                          <div
                            className={cn(
                              'h-9 rounded-md border px-1.5 flex items-center justify-between gap-1 transition-colors',
                              !faixa && 'border-dashed border-border text-muted-foreground',
                              acimaApetite && 'ring-1 ring-foreground/50',
                            )}
                            style={faixa ? pintura.celula : undefined}
                            title={`${score} · ${faixa?.nivel ?? '—'}`}
                          >
                            <span className="font-semibold tabular-nums text-foreground">{score}</span>
                            {faixa && (
                              <span
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 rounded-sm inline-flex items-center justify-center text-micro font-bold leading-none"
                                style={pintura.marca}
                              >
                                {SEVERITY_LETTER[sev]}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* A mesma legenda do mapa de calor. Eram duas: aqui uma pilula
                com ponto redondo e a faixa em opacidade reduzida, ordenada do
                menos grave para o mais; la um quadrado com a letra, ordenado ao
                contrario. Mesma escala, duas leituras. */}
            <LegendaDaMatriz
              niveis={niveisRisco}
              apetite={apetiteMax != null ? { rotulo: legendaApetite, max: apetiteMax } : null}
              sufixo={`${eixoImpacto} →`}
              className="mt-3"
            />
          </div>
        )}
      </div>
    </section>
  );
}
