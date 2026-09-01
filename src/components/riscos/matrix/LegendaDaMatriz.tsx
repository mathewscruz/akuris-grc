/**
 * A legenda da matriz de risco. Uma, para os dois sítios onde a matriz aparece.
 *
 * ## O que estava
 *
 * Duas legendas com desenhos diferentes para a mesma escala:
 *
 *  · No mapa de calor: quadrado colorido com a letra da severidade, rótulo
 *    «Crítico (17–25)», tudo em `text-micro text-muted-foreground`.
 *  · Na pré-visualização: pílula com borda, ponto redondo, rótulo «Crítico»
 *    e a faixa «17–25» em opacidade reduzida ao lado.
 *
 * ## O que estava errado, medido no navegador
 *
 *  · O rótulo tinha **10,2px** e contraste 4,65:1 — o mínimo do texto normal,
 *    ao tamanho onde esse mínimo já não chega.
 *  · A letra dentro do quadrado tinha contraste **1,04:1**. As classes de
 *    severidade definiam só o fundo (`bg-destructive`), e a letra herdava o
 *    cinzento do texto à volta: um «C» cinzento sobre vermelho, invisível. Os
 *    quadrados liam-se como pontos coloridos sem significado.
 *
 * ## O que fica
 *
 * Rótulo em `text-xs` e `text-foreground`; a faixa numérica em tom de apoio,
 * porque é a informação secundária. A marca cresce para caber a letra, e a cor
 * da letra sai da luminância do fundo (`pintura-da-matriz`), por isso funciona
 * também com as cores que a empresa escolher.
 */
import { cn } from '@/lib/utils';
import { SEVERITY_LETTER, severidadePrevista, type Severity } from '@/components/riscos/risk-utils';
import { pinturaDoNivel, type NivelPintavel } from './pintura-da-matriz';

interface Props {
  /** Faixas da matriz vigente. Sem elas, desenha a escala canónica. */
  niveis?: NivelPintavel[] | null;
  /** Rótulos por severidade, para quando não há faixas configuradas. */
  rotulosPadrao?: Record<Severity, string>;
  /** Ex.: «Limite de apetite ≤ 16». Desenhado a seguir às faixas. */
  apetite?: { rotulo: string; max: number } | null;
  /** Ex.: «Impacto →». Fecha a linha na pré-visualização. */
  sufixo?: string;
  className?: string;
}

const ORDEM_CANONICA: Severity[] = ['critico', 'alto', 'medio', 'baixo'];

export function LegendaDaMatriz({ niveis, rotulosPadrao, apetite, sufixo, className }: Props) {
  /* Do mais grave para o menos: é a ordem em que se lê um mapa de risco, e a
     mesma nos dois sítios — a pré-visualização ordenava ao contrário. */
  const itens =
    niveis && niveis.length > 0
      ? [...niveis]
          .sort((a, b) => b.max - a.max)
          .map((n) => {
            const sev = severidadePrevista(n.max, niveis as never) ?? 'baixo';
            return {
              chave: `${n.nivel}-${n.min}`,
              rotulo: n.nivel || '—',
              faixa: `${n.min}–${n.max}`,
              letra: SEVERITY_LETTER[sev],
              pintura: pinturaDoNivel(n, sev),
            };
          })
      : ORDEM_CANONICA.map((sev) => ({
          chave: sev,
          rotulo: rotulosPadrao?.[sev] ?? sev,
          faixa: '',
          letra: SEVERITY_LETTER[sev],
          pintura: pinturaDoNivel(null, sev),
        }));

  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {itens.map((i) => (
        <div key={i.chave} className="inline-flex items-center gap-1.5">
          {/* A marca leva a letra da severidade, e a letra tem de se ler: a cor
              vem da luminância do fundo, não de um valor fixo. */}
          <span
            aria-hidden="true"
            className="h-4 w-4 rounded-sm inline-flex items-center justify-center text-micro font-bold leading-none"
            style={i.pintura.marca}
          >
            {i.letra}
          </span>
          <span className="text-xs text-foreground">{i.rotulo}</span>
          {i.faixa && <span className="text-xs text-muted-foreground tabular-nums">{i.faixa}</span>}
        </div>
      ))}

      {apetite && (
        <div className="inline-flex items-center gap-1.5">
          {/* O apetite não é uma faixa: marca-se pelo anel, como na célula. */}
          <span aria-hidden="true" className="h-4 w-4 rounded-sm ring-1 ring-foreground/60" />
          <span className="text-xs text-foreground">
            {apetite.rotulo} <span className="tabular-nums">≤ {apetite.max}</span>
          </span>
        </div>
      )}

      {sufixo && <span className="text-xs text-muted-foreground">{sufixo}</span>}
    </div>
  );
}
