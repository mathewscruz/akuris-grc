/**
 * T4 — vocabulário único das constatações de auditoria (ISO 19011, mas
 * agnóstico de framework: a referência tanto pode ser um requisito de qualquer
 * norma avaliada no Gap Analysis como um controlo interno).
 */
export type ClassificacaoAchado = 'nc_maior' | 'nc_menor' | 'observacao' | 'oportunidade';

export const CLASSIFICACOES: ClassificacaoAchado[] = [
  'nc_maior',
  'nc_menor',
  'observacao',
  'oportunidade',
];

/** Mapeia a classificação para os campos históricos `tipo` e `criticidade`. */
export const derivarTipoCriticidade = (
  classificacao: ClassificacaoAchado,
): { tipo: string; criticidade: string } => {
  switch (classificacao) {
    case 'nc_maior':
      return { tipo: 'nao_conformidade', criticidade: 'alta' };
    case 'nc_menor':
      return { tipo: 'nao_conformidade', criticidade: 'media' };
    case 'observacao':
      return { tipo: 'observacao', criticidade: 'baixa' };
    case 'oportunidade':
    default:
      return { tipo: 'oportunidade_melhoria', criticidade: 'baixa' };
  }
};

export const classificacaoTone = (
  classificacao: string | null | undefined,
): 'destructive' | 'warning' | 'info' | 'neutral' => {
  switch (classificacao) {
    case 'nc_maior':
      return 'destructive';
    case 'nc_menor':
      return 'warning';
    case 'observacao':
      return 'info';
    default:
      return 'neutral';
  }
};

export interface AchadoLike {
  classificacao?: string | null;
  status?: string | null;
}

export const contarConstatacoes = (achados: AchadoLike[] | null | undefined) => {
  const lista = achados ?? [];
  const por = (c: ClassificacaoAchado) => lista.filter((a) => a.classificacao === c).length;
  return {
    total: lista.length,
    maiores: por('nc_maior'),
    menores: por('nc_menor'),
    observacoes: por('observacao'),
    melhorias: por('oportunidade'),
    maioresAbertas: lista.filter(
      (a) => a.classificacao === 'nc_maior' && (a.status || 'aberto') !== 'fechado',
    ).length,
  };
};
