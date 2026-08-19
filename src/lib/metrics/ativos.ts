import { norm, countBy } from './core';
import type { Severidade } from './riscos';
import { severidadeDeFaixas } from './riscos';

export interface AtivoLike {
  status?: string | null;
  criticidade?: string | null;
  valor_negocio?: string | null;
}

export type EstadoAtivo = 'ativo' | 'inativo' | 'descontinuado' | 'indefinido';
const MAP_ESTADO: Record<string, EstadoAtivo> = {
  ativo: 'ativo',
  ativa: 'ativo',
  em_uso: 'ativo',
  inativo: 'inativo',
  inativa: 'inativo',
  arquivado: 'inativo',
  descontinuado: 'descontinuado',
  descontinuada: 'descontinuado',
  desativado: 'descontinuado',
};

export const estadoAtivo = (a: AtivoLike): EstadoAtivo => MAP_ESTADO[norm(a.status)] ?? 'indefinido';
export const criticidadeAtivo = (a: AtivoLike): Severidade => severidadeDeFaixas(a.criticidade);
/**
 * "Alto valor de negócio" — a coluna guarda duas coisas diferentes.
 *
 * `valor_negocio` foi desenhada como escala (alto/médio/baixo) e o produto
 * grava lá MONTANTE: 8.500, 45.000, 500.000. A comparação com `'alto'` nunca
 * era verdadeira, portanto o KPI "Alto Valor" marcava 0 em todas as empresas,
 * o filtro "Alto" devolvia 0 de 35, e o radar perdia 20 pontos em silêncio.
 *
 * Aceita as duas: texto pela escala, número pelo quartil superior DA CARTEIRA.
 * O quartil é auto-calibrado — um limiar fixo em reais seria arbitrário e
 * erraria em qualquer empresa de tamanho diferente.
 */
export const valorNegocioNumerico = (a: AtivoLike): number | null => {
  const bruto = String(a.valor_negocio ?? '').replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(bruto);
  return bruto !== '' && Number.isFinite(n) ? n : null;
};

/** Corte do quartil superior dos ativos que têm montante informado. */
export const corteAltoValor = (ativos: AtivoLike[] | null | undefined): number | null => {
  const valores = (ativos ?? []).map(valorNegocioNumerico).filter((v): v is number => v != null && v > 0);
  if (valores.length < 4) return null;
  const ordenados = [...valores].sort((x, y) => x - y);
  return ordenados[Math.floor(ordenados.length * 0.75)];
};

export const isAtivoAltoValor = (a: AtivoLike, corte?: number | null) => {
  const n = valorNegocioNumerico(a);
  if (n != null) return corte != null ? n >= corte : false;
  return ['alto', 'critico'].includes(norm(a.valor_negocio));
};

export const contarAtivos = (ativos: AtivoLike[] | null | undefined) => ({
  total: ativos?.length ?? 0,
  ativos: countBy(ativos, (a) => estadoAtivo(a) === 'ativo'),
  inativos: countBy(ativos, (a) => estadoAtivo(a) === 'inativo'),
  descontinuados: countBy(ativos, (a) => estadoAtivo(a) === 'descontinuado'),
  criticos: countBy(ativos, (a) => criticidadeAtivo(a) === 'critico'),
  altos: countBy(ativos, (a) => criticidadeAtivo(a) === 'alto'),
  medios: countBy(ativos, (a) => criticidadeAtivo(a) === 'medio'),
  baixos: countBy(ativos, (a) => criticidadeAtivo(a) === 'baixo'),
  // O corte é da própria carteira: `countBy` passa o índice no 2.º argumento,
  // por isso a chamada é explícita e não `countBy(ativos, isAtivoAltoValor)`.
  altoValorNegocio: (() => {
    const corte = corteAltoValor(ativos);
    return countBy(ativos, (a) => isAtivoAltoValor(a, corte));
  })(),
});
