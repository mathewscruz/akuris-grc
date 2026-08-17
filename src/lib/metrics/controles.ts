import { norm, countBy, pct, isVencido, isAVencer } from './core';
import type { Severidade } from './riscos';
import { severidadeDeFaixas } from './riscos';

export interface ControleLike {
  id?: string;
  status?: string | null;
  criticidade?: string | null;
  tipo?: string | null;
  proxima_avaliacao?: string | null;
}

export interface TesteControleLike {
  controle_id?: string | null;
  resultado?: string | null;
  data_teste?: string | null;
}

export const isControleAtivo = (c: ControleLike) => norm(c.status) === 'ativo';
export const isControleInativo = (c: ControleLike) => norm(c.status) === 'inativo';
export const isControleEmRevisao = (c: ControleLike) => norm(c.status) === 'em_revisao';
/** O formulário oferece 4 estados; sem esta contagem os descontinuados entram
 *  no total mas em nenhuma faixa, e a soma deixa de fechar. */
export const isControleDescontinuado = (c: ControleLike) => norm(c.status) === 'descontinuado';
export const criticidadeControle = (c: ControleLike): Severidade =>
  severidadeDeFaixas(c.criticidade);

export type TipoControle = 'preventivo' | 'detectivo' | 'corretivo' | 'indefinido';
export const tipoControle = (c: ControleLike): TipoControle => {
  const v = norm(c.tipo);
  return v === 'preventivo' || v === 'detectivo' || v === 'corretivo' ? v : 'indefinido';
};

export const isAvaliacaoVencida = (c: ControleLike, ref: Date = new Date()) =>
  isVencido(c.proxima_avaliacao, ref);
export const isAvaliacaoAVencer = (c: ControleLike, ref: Date = new Date(), dias = 30) =>
  isAVencer(c.proxima_avaliacao, ref, dias);

/** Resultado canónico de um teste de controlo. */
export type ResultadoTeste = 'eficaz' | 'parcial' | 'ineficaz' | 'indefinido';
const MAP_RESULTADO: Record<string, ResultadoTeste> = {
  eficaz: 'eficaz',
  efetivo: 'eficaz',
  efectivo: 'eficaz',
  aprovado: 'eficaz',
  conforme: 'eficaz',
  parcial: 'parcial',
  parcialmente_eficaz: 'parcial',
  parcialmente_efetivo: 'parcial',
  ineficaz: 'ineficaz',
  nao_eficaz: 'ineficaz',
  nao_efetivo: 'ineficaz',
  reprovado: 'ineficaz',
  nao_conforme: 'ineficaz',
};
export const resultadoTeste = (t: TesteControleLike): ResultadoTeste =>
  MAP_RESULTADO[norm(t.resultado)] ?? 'indefinido';

const PESO: Record<ResultadoTeste, number> = {
  eficaz: 100,
  parcial: 50,
  ineficaz: 0,
  indefinido: 0,
};

export interface EfetividadeControles {
  /** null = sem dados. Nunca inventamos 0% nem uma proporção de tipos. */
  percentual: number | null;
  controlesTestados: number;
  totalControles: number;
  testes: number;
}

/**
 * Efetividade = média dos ÚLTIMOS testes registados por controlo.
 * Sem testes registados devolve `percentual: null` ("sem dados").
 */
export const efetividadeControles = (
  controles: ControleLike[] | null | undefined,
  testes: TesteControleLike[] | null | undefined,
): EfetividadeControles => {
  const lista = controles ?? [];
  const ultimos = new Map<string, TesteControleLike>();
  (testes ?? []).forEach((t) => {
    const id = t.controle_id || '';
    if (!id) return;
    const atual = ultimos.get(id);
    if (!atual || new Date(t.data_teste || 0) >= new Date(atual.data_teste || 0)) {
      ultimos.set(id, t);
    }
  });
  const avaliados = [...ultimos.values()].filter((t) => resultadoTeste(t) !== 'indefinido');
  return {
    percentual: avaliados.length
      ? Math.round(avaliados.reduce((a, t) => a + PESO[resultadoTeste(t)], 0) / avaliados.length)
      : null,
    controlesTestados: avaliados.length,
    totalControles: lista.length,
    testes: testes?.length ?? 0,
  };
};

export const contarControles = (
  controles: ControleLike[] | null | undefined,
  ref: Date = new Date(),
) => ({
  total: controles?.length ?? 0,
  ativos: countBy(controles, isControleAtivo),
  inativos: countBy(controles, isControleInativo),
  emRevisao: countBy(controles, isControleEmRevisao),
  descontinuados: countBy(controles, isControleDescontinuado),
  criticos: countBy(controles, (c) => criticidadeControle(c) === 'critico'),
  altos: countBy(controles, (c) => criticidadeControle(c) === 'alto'),
  medios: countBy(controles, (c) => criticidadeControle(c) === 'medio'),
  baixos: countBy(controles, (c) => criticidadeControle(c) === 'baixo'),
  preventivos: countBy(controles, (c) => tipoControle(c) === 'preventivo'),
  detectivos: countBy(controles, (c) => tipoControle(c) === 'detectivo'),
  corretivos: countBy(controles, (c) => tipoControle(c) === 'corretivo'),
  vencendoAvaliacao: countBy(controles, (c) => isAvaliacaoAVencer(c, ref, 30)),
  vencidos: countBy(controles, (c) => isAvaliacaoVencida(c, ref)),
});

/** Proporção de preventivos — informação legítima, com o rótulo correcto. */
export const proporcaoPreventivos = (controles: ControleLike[] | null | undefined) => {
  const total = controles?.length ?? 0;
  const preventivos = countBy(controles, (c) => tipoControle(c) === 'preventivo');
  return { preventivos, total, percentual: pct(preventivos, total) };
};
