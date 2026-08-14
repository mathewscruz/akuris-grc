import { norm, countBy, isVencido, isAVencer } from './core';

export interface PlanoAcaoLike {
  status?: string | null;
  prazo?: string | null;
  data_conclusao?: string | null;
}

export type EstadoPlano = 'pendente' | 'em_andamento' | 'concluido' | 'cancelado' | 'indefinido';
const MAP_ESTADO: Record<string, EstadoPlano> = {
  pendente: 'pendente',
  nao_iniciado: 'pendente',
  aberto: 'pendente',
  em_andamento: 'em_andamento',
  em_curso: 'em_andamento',
  em_progresso: 'em_andamento',
  concluido: 'concluido',
  concluida: 'concluido',
  finalizado: 'concluido',
  fechado: 'concluido',
  cancelado: 'cancelado',
  cancelada: 'cancelado',
};

export const estadoPlano = (p: PlanoAcaoLike): EstadoPlano => MAP_ESTADO[norm(p.status)] ?? 'pendente';
/** Em aberto = ainda exige acção (nem concluído nem cancelado). */
export const isPlanoAberto = (p: PlanoAcaoLike) =>
  !['concluido', 'cancelado'].includes(estadoPlano(p));
export const isPlanoConcluido = (p: PlanoAcaoLike) => estadoPlano(p) === 'concluido';
export const isPlanoAtrasado = (p: PlanoAcaoLike, ref: Date = new Date()) =>
  isPlanoAberto(p) && isVencido(p.prazo, ref);
export const isPlanoAVencer = (p: PlanoAcaoLike, ref: Date = new Date(), dias = 7) =>
  isPlanoAberto(p) && isAVencer(p.prazo, ref, dias);

export const contarPlanos = (planos: PlanoAcaoLike[] | null | undefined, ref: Date = new Date()) => ({
  total: planos?.length ?? 0,
  pendentes: countBy(planos, isPlanoAberto),
  atrasados: countBy(planos, (p) => isPlanoAtrasado(p, ref)),
  aVencer: countBy(planos, (p) => isPlanoAVencer(p, ref)),
  concluidos: countBy(planos, isPlanoConcluido),
  cancelados: countBy(planos, (p) => estadoPlano(p) === 'cancelado'),
});
