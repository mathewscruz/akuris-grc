import { norm, countBy, isVencido, isAVencer } from './core';

/** Escala canónica de severidade usada por TODOS os consumidores. */
export type Severidade = 'critico' | 'alto' | 'medio' | 'baixo' | 'indefinido';

export const SEVERIDADES: Severidade[] = ['critico', 'alto', 'medio', 'baixo'];

/**
 * Posto da severidade numa escala, para ORDENAR.
 *
 * Ordenar estas palavras por alfabeto dá Alto, Baixo, Crítico, Médio — que é
 * quase o contrário do que se quer ver. Quem pergunta «mostra-me os piores
 * primeiro» precisa de um número.
 *
 * Crítico é 4 e não 0: assim a ordem descendente da tabela — a que se pede
 * primeiro — põe o pior no topo sem inverter nada.
 */
export const postoDaSeveridade = (s: Severidade): number =>
  ({ critico: 4, alto: 3, medio: 2, baixo: 1, indefinido: 0 })[s] ?? 0;

/** Faixa da matriz de risco activa (riscos_matriz_configuracao.niveis_risco). */
export interface FaixaMatriz {
  nivel: string;
  min?: number;
  max?: number;
  cor?: string;
}

/**
 * Mapeamento por rótulo — para os módulos que ainda classificam por texto
 * (`incidentes.criticidade`, `ativos.criticidade`, `controles.criticidade`).
 *
 * Riscos já NÃO passa por aqui: tem coluna canónica no banco.
 */
const LABEL_SEVERIDADE: Record<string, Severidade> = {
  critico: 'critico',
  critica: 'critico',
  extremo: 'critico',
  extrema: 'critico',
  muito_alto: 'critico',
  muito_alta: 'critico',
  alto: 'alto',
  alta: 'alto',
  elevado: 'alto',
  elevada: 'alto',
  medio: 'medio',
  media: 'medio',
  moderado: 'medio',
  moderada: 'medio',
  baixo: 'baixo',
  baixa: 'baixo',
  muito_baixo: 'baixo',
  muito_baixa: 'baixo',
  insignificante: 'baixo',
};

/**
 * Severidade a partir das faixas da matriz activa: a posição da faixa manda
 * (última faixa = crítico), independentemente do rótulo escolhido pela empresa.
 *
 * Esta é a MESMA aritmética que `public.risco_severidade_da_faixa` no banco.
 * As duas existem porque o formulário de matriz precisa pré-visualizar a
 * classificação antes de gravar; a verdade gravada vem sempre do banco.
 */
export const severidadeDeFaixas = (
  nivel: string | null | undefined,
  faixas?: FaixaMatriz[] | null,
): Severidade => {
  const v = norm(nivel);
  if (!v) return 'indefinido';
  if (faixas && faixas.length > 0) {
    const ordenadas = [...faixas].sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
    const idx = ordenadas.findIndex((f) => norm(f.nivel) === v);
    if (idx >= 0) {
      const n = ordenadas.length;
      const posicao = idx / Math.max(n - 1, 1); // 0 = menor faixa, 1 = maior
      if (posicao >= 0.99) return 'critico';
      if (posicao >= 0.66) return 'alto';
      if (posicao >= 0.33) return 'medio';
      return 'baixo';
    }
  }
  return LABEL_SEVERIDADE[v] ?? 'indefinido';
};

export interface RiscoLike {
  /** Coluna canónica: 'baixo' | 'medio' | 'alto' | 'critico'. Escrita só pelo trigger. */
  severidade_efetiva?: string | null;
  severidade_inicial?: string | null;
  severidade_residual?: string | null;
  score_efetivo?: number | null;
  score_inicial?: number | null;
  score_residual?: number | null;
  /** Rótulo da empresa ("Crítico", "Extremo", "Intolerável"). Só para exibir. */
  nivel_risco_inicial?: string | null;
  nivel_risco_residual?: string | null;
  aceito?: boolean | null;
  status?: string | null;
  data_proxima_revisao?: string | null;
}

const canonica = (v?: string | null): Severidade | null => {
  const s = norm(v);
  return s === 'critico' || s === 'alto' || s === 'medio' || s === 'baixo' ? s : null;
};

/**
 * Severidade do risco: **residual quando existe, senão inerente**.
 *
 * Lê `severidade_efetiva`, coluna gerada no banco a partir do score e da
 * posição da faixa na matriz vigente da empresa. Antes, esta função recebia as
 * faixas e reclassificava o RÓTULO em cada chamada — e quem esquecia de passar
 * as faixas obtinha outro resultado. Foi assim que o mesmo risco apareceu como
 * "Crítico" no cartão e "Alto" no mapa de calor, no mesmo ecrã.
 *
 * O parâmetro `faixas` continua aceite (e ignorado quando a coluna existe) para
 * não obrigar a tocar em todos os chamadores de uma vez, e serve de rede para
 * linhas ainda não recalculadas.
 */
export const severidadeRisco = (r: RiscoLike, faixas?: FaixaMatriz[] | null): Severidade =>
  canonica(r.severidade_efetiva) ??
  canonica(r.severidade_residual) ??
  canonica(r.severidade_inicial) ??
  severidadeDeFaixas(r.nivel_risco_residual || r.nivel_risco_inicial, faixas);

/** Nome antigo, mantido porque dois ecrãs o chamam explicitamente. */
export const severidadeRiscoEfetiva = severidadeRisco;

/**
 * Severidade INERENTE, antes dos controlos. Só para quem mostra o antes e o
 * depois lado a lado — a matriz e o detalhe do risco. Nunca para contagem.
 */
export const severidadeRiscoInerente = (r: RiscoLike, faixas?: FaixaMatriz[] | null): Severidade =>
  canonica(r.severidade_inicial) ?? severidadeDeFaixas(r.nivel_risco_inicial, faixas);

/** Score efectivo (residual quando existe). `null` quando o risco não foi avaliado. */
export const scoreRisco = (r: RiscoLike): number | null =>
  r.score_efetivo ?? r.score_residual ?? r.score_inicial ?? null;

/**
 * Risco acima do apetite: score efectivo maior que o limite da matriz vigente.
 *
 * Uma regra só, comparando números. A anterior comparava por severidade quando
 * não conseguia resolver o apetite — e "não conseguia" era o caso de todas as
 * empresas que tinham renomeado as faixas.
 */
export const isAcimaDoApetite = (r: RiscoLike, apetiteScore?: number | null): boolean => {
  const score = scoreRisco(r);
  if (score === null || apetiteScore === null || apetiteScore === undefined) return false;
  return score > apetiteScore;
};

export const isRiscoCritico = (r: RiscoLike, faixas?: FaixaMatriz[] | null) =>
  severidadeRisco(r, faixas) === 'critico';
export const isRiscoAlto = (r: RiscoLike, faixas?: FaixaMatriz[] | null) =>
  severidadeRisco(r, faixas) === 'alto';
export const isRiscoMedio = (r: RiscoLike, faixas?: FaixaMatriz[] | null) =>
  severidadeRisco(r, faixas) === 'medio';
export const isRiscoBaixo = (r: RiscoLike, faixas?: FaixaMatriz[] | null) =>
  severidadeRisco(r, faixas) === 'baixo';

/** Estado do risco (aceite / tratado / aberto). */
export type EstadoRisco = 'aceito' | 'tratado' | 'aberto';
export const estadoRisco = (r: RiscoLike): EstadoRisco => {
  if (r.aceito) return 'aceito';
  if (r.severidade_residual || r.nivel_risco_residual) return 'tratado';
  return 'aberto';
};

export const isRevisaoVencida = (r: RiscoLike, ref: Date = new Date()) =>
  isVencido(r.data_proxima_revisao, ref);
export const isRevisaoProxima = (r: RiscoLike, ref: Date = new Date(), dias = 7) =>
  isAVencer(r.data_proxima_revisao, ref, dias);

/** Contagem canónica por severidade — única fonte para cartões, gráficos e PDFs. */
export const contarRiscosPorSeveridade = (
  riscos: RiscoLike[] | null | undefined,
  faixas?: FaixaMatriz[] | null,
) => ({
  total: riscos?.length ?? 0,
  criticos: countBy(riscos, (r) => isRiscoCritico(r, faixas)),
  altos: countBy(riscos, (r) => isRiscoAlto(r, faixas)),
  medios: countBy(riscos, (r) => isRiscoMedio(r, faixas)),
  baixos: countBy(riscos, (r) => isRiscoBaixo(r, faixas)),
  indefinidos: countBy(riscos, (r) => severidadeRisco(r, faixas) === 'indefinido'),
});
