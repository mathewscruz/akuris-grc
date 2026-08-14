import { norm, countBy, isVencido, isAVencer } from './core';

/** Escala canónica de severidade usada por TODOS os consumidores. */
export type Severidade = 'critico' | 'alto' | 'medio' | 'baixo' | 'indefinido';

export const SEVERIDADES: Severidade[] = ['critico', 'alto', 'medio', 'baixo'];

/** Faixa da matriz de risco activa (riscos_matriz_configuracao.niveis_risco). */
export interface FaixaMatriz {
  nivel: string;
  min?: number;
  max?: number;
  cor?: string;
}

/** Mapeamento por rótulo — cobre dados legados e variantes pt-PT/pt-BR. */
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
  nivel_risco_inicial?: string | null;
  nivel_risco_residual?: string | null;
  aceito?: boolean | null;
  status?: string | null;
  data_proxima_revisao?: string | null;
}

/** Severidade inerente (nível inicial) — é a usada nos cartões e nas listas. */
export const severidadeRisco = (r: RiscoLike, faixas?: FaixaMatriz[] | null): Severidade =>
  severidadeDeFaixas(r.nivel_risco_inicial, faixas);

/** Severidade efectiva: residual quando existe, senão inerente. */
export const severidadeRiscoEfetiva = (r: RiscoLike, faixas?: FaixaMatriz[] | null): Severidade =>
  severidadeDeFaixas(r.nivel_risco_residual || r.nivel_risco_inicial, faixas);

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
  if (r.nivel_risco_residual) return 'tratado';
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
