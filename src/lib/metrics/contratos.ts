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
});
