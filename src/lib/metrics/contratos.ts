import { norm, countBy, sumBy, isVencido, isAVencer } from './core';

/**
 * Estado de contrato DERIVADO da data de vencimento — o campo `status` sozinho
 * não transiciona com o tempo e inflacionava o valor "em contratos activos".
 */
export type EstadoContrato =
  | 'vigente'
  | 'a_vencer'
  | 'vencido'
  | 'rascunho'
  | 'suspenso'
  | 'encerrado'
  | 'negociacao'
  | 'aprovacao'
  | 'indefinido';

export interface ContratoLike {
  status?: string | null;
  data_fim?: string | null;
  valor?: number | null;
  /** A moeda DESTE contrato. Existe na coluna desde sempre; ninguém a lia. */
  moeda?: string | null;
  renovacao_automatica?: boolean | null;
}

/** Estados administrativos que não dependem da data. */
const ESTADOS_FIXOS: Record<string, EstadoContrato> = {
  rascunho: 'rascunho',
  suspenso: 'suspenso',
  encerrado: 'encerrado',
  cancelado: 'encerrado',
  inativo: 'encerrado',
  negociacao: 'negociacao',
  em_negociacao: 'negociacao',
  aprovacao: 'aprovacao',
  em_aprovacao: 'aprovacao',
};

export const estadoContrato = (
  c: ContratoLike,
  ref: Date = new Date(),
  diasAviso = 30,
): EstadoContrato => {
  const fixo = ESTADOS_FIXOS[norm(c.status)];
  if (fixo) return fixo;
  const ativo = norm(c.status) === 'ativo' || norm(c.status) === 'vigente';
  if (!ativo && norm(c.status)) return 'indefinido';
  if (isVencido(c.data_fim, ref)) return 'vencido';
  if (isAVencer(c.data_fim, ref, diasAviso)) return 'a_vencer';
  return 'vigente';
};

/** Vigente = activo e ainda dentro do prazo (inclui "a vencer"). */
export const isContratoVigente = (c: ContratoLike, ref: Date = new Date()) => {
  const e = estadoContrato(c, ref);
  return e === 'vigente' || e === 'a_vencer';
};
export const isContratoVencido = (c: ContratoLike, ref: Date = new Date()) =>
  estadoContrato(c, ref) === 'vencido';
export const isContratoAVencer = (c: ContratoLike, ref: Date = new Date(), dias = 30) =>
  estadoContrato(c, ref, dias) === 'a_vencer';

/**
 * Soma separada por moeda — porque somar moedas diferentes não dá número
 * nenhum.
 *
 * Medido na base de desenvolvimento: os três contratos da empresa estão
 * gravados em `moeda = 'BRL'`, e o cartão do módulo mostrava «276 mil €» e
 * «420 mil €». O número estava certo; o símbolo não. `formatMoedaEmpresa`
 * carimba a moeda da EMPRESA por cima de qualquer valor, e a soma ignorava a
 * coluna `moeda` de cada linha.
 *
 * Sem taxas de câmbio — que o produto não tem e não se inventam aqui — a
 * única soma honesta é uma por moeda. Com uma só moeda o resultado é
 * idêntico ao de hoje; com duas, deixa de haver um número que finge ser os
 * dois.
 */
export const somaPorMoeda = (
  contratos: ContratoLike[] | null | undefined,
  incluir: (c: ContratoLike) => boolean,
): Record<string, number> => {
  const total: Record<string, number> = {};
  for (const c of contratos ?? []) {
    if (!incluir(c)) continue;
    const valor = Number(c.valor) || 0;
    if (!valor) continue;
    const moeda = (c.moeda || 'EUR').toUpperCase();
    total[moeda] = (total[moeda] ?? 0) + valor;
  }
  return total;
};

/** Valor apenas de contratos vigentes (nunca soma vencidos). */
export const valorContratosVigentes = (
  contratos: ContratoLike[] | null | undefined,
  ref: Date = new Date(),
) => sumBy(contratos, (c) => isContratoVigente(c, ref), (c) => c.valor);

/** Valor de contratos vencidos — mostrado à parte, com rótulo próprio. */
export const valorContratosVencidos = (
  contratos: ContratoLike[] | null | undefined,
  ref: Date = new Date(),
) => sumBy(contratos, (c) => isContratoVencido(c, ref), (c) => c.valor);

export const contarContratos = (
  contratos: ContratoLike[] | null | undefined,
  ref: Date = new Date(),
) => ({
  total: contratos?.length ?? 0,
  vigentes: countBy(contratos, (c) => isContratoVigente(c, ref)),
  vencidos: countBy(contratos, (c) => isContratoVencido(c, ref)),
  aVencer30: countBy(contratos, (c) => isContratoAVencer(c, ref, 30)),
  renovacaoAutomatica: countBy(contratos, (c) => !!c.renovacao_automatica),
  valorVigente: valorContratosVigentes(contratos, ref),
  valorVencido: valorContratosVencidos(contratos, ref),
  /* Os mesmos dois valores, mas sem misturar moedas. */
  valorVigentePorMoeda: somaPorMoeda(contratos, (c) => isContratoVigente(c, ref)),
  valorVencidoPorMoeda: somaPorMoeda(contratos, (c) => isContratoVencido(c, ref)),
});
