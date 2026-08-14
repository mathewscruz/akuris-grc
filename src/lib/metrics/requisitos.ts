import { norm, countBy, pct } from './core';

/** Conformidade canónica de requisito (Gap Analysis). */
export type Conformidade = 'conforme' | 'parcial' | 'nao_conforme' | 'nao_aplicavel' | 'nao_avaliado';

const MAP: Record<string, Conformidade> = {
  conforme: 'conforme',
  atendido: 'conforme',
  parcial: 'parcial',
  parcialmente_conforme: 'parcial',
  nao_conforme: 'nao_conforme',
  nao_atendido: 'nao_conforme',
  nao_aplicavel: 'nao_aplicavel',
  na: 'nao_aplicavel',
};

export interface RequisitoLike {
  conformity_status?: string | null;
  criticality?: string | null;
}

export const conformidadeRequisito = (r: RequisitoLike): Conformidade =>
  MAP[norm(r.conformity_status)] ?? 'nao_avaliado';

export const isRequisitoAplicavel = (r: RequisitoLike) =>
  conformidadeRequisito(r) !== 'nao_aplicavel';
export const isRequisitoConforme = (r: RequisitoLike) => conformidadeRequisito(r) === 'conforme';
export const isRequisitoParcial = (r: RequisitoLike) => conformidadeRequisito(r) === 'parcial';
export const isRequisitoNaoConforme = (r: RequisitoLike) =>
  conformidadeRequisito(r) === 'nao_conforme';
/** Gap crítico: requisito aplicável não conforme. Definição única do sistema. */
export const isGapCritico = (r: RequisitoLike) => isRequisitoNaoConforme(r);

const PESO: Record<Conformidade, number> = {
  conforme: 100,
  parcial: 50,
  nao_conforme: 0,
  nao_avaliado: 0,
  nao_aplicavel: 0,
};

/**
 * Conformidade média sobre requisitos APLICÁVEIS (exclui N/A do denominador,
 * não avaliados contam 0). `totalRequisitos` permite contar os por avaliar.
 */
export const conformidadeMedia = (
  avaliacoes: RequisitoLike[] | null | undefined,
  totalRequisitos?: number,
) => {
  const lista = avaliacoes ?? [];
  const na = countBy(lista, (r) => conformidadeRequisito(r) === 'nao_aplicavel');
  const denominador = Math.max((totalRequisitos ?? lista.length) - na, 0);
  const soma = lista.filter(isRequisitoAplicavel).reduce((a, r) => a + PESO[conformidadeRequisito(r)], 0);
  return pct(soma / 100, denominador);
};

export const contarRequisitos = (avaliacoes: RequisitoLike[] | null | undefined) => ({
  total: avaliacoes?.length ?? 0,
  conformes: countBy(avaliacoes, isRequisitoConforme),
  parciais: countBy(avaliacoes, isRequisitoParcial),
  naoConformes: countBy(avaliacoes, isRequisitoNaoConforme),
  naoAplicaveis: countBy(avaliacoes, (r) => conformidadeRequisito(r) === 'nao_aplicavel'),
  naoAvaliados: countBy(avaliacoes, (r) => conformidadeRequisito(r) === 'nao_avaliado'),
  criticos: countBy(avaliacoes, isGapCritico),
});
