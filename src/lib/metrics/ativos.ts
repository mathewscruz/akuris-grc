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
export const isAtivoAltoValor = (a: AtivoLike) => ['alto', 'critico'].includes(norm(a.valor_negocio));

export const contarAtivos = (ativos: AtivoLike[] | null | undefined) => ({
  total: ativos?.length ?? 0,
  ativos: countBy(ativos, (a) => estadoAtivo(a) === 'ativo'),
  inativos: countBy(ativos, (a) => estadoAtivo(a) === 'inativo'),
  descontinuados: countBy(ativos, (a) => estadoAtivo(a) === 'descontinuado'),
  criticos: countBy(ativos, (a) => criticidadeAtivo(a) === 'critico'),
  altos: countBy(ativos, (a) => criticidadeAtivo(a) === 'alto'),
  medios: countBy(ativos, (a) => criticidadeAtivo(a) === 'medio'),
  baixos: countBy(ativos, (a) => criticidadeAtivo(a) === 'baixo'),
  altoValorNegocio: countBy(ativos, isAtivoAltoValor),
});
