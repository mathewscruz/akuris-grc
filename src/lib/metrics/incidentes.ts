import { norm, countBy } from './core';
import type { Severidade } from './riscos';
import { severidadeDeFaixas } from './riscos';

/** Estado canónico de incidente. Os dados gravam variantes ("em_investigacao"). */
export type EstadoIncidente =
  | 'aberto'
  | 'investigacao'
  | 'contido'
  | 'resolvido'
  | 'fechado'
  | 'indefinido';

const MAP_ESTADO: Record<string, EstadoIncidente> = {
  aberto: 'aberto',
  novo: 'aberto',
  registrado: 'aberto',
  registado: 'aberto',
  investigacao: 'investigacao',
  em_investigacao: 'investigacao',
  em_analise: 'investigacao',
  analise: 'investigacao',
  contido: 'contido',
  contencao: 'contido',
  em_contencao: 'contido',
  resolvido: 'resolvido',
  resolvida: 'resolvido',
  fechado: 'fechado',
  encerrado: 'fechado',
  cancelado: 'fechado',
};

export interface IncidenteLike {
  status?: string | null;
  criticidade?: string | null;
  created_at?: string | null;
}

export const estadoIncidente = (i: IncidenteLike): EstadoIncidente =>
  MAP_ESTADO[norm(i.status)] ?? 'indefinido';

export const isIncidenteAberto = (i: IncidenteLike) => estadoIncidente(i) === 'aberto';
export const isIncidenteEmInvestigacao = (i: IncidenteLike) =>
  estadoIncidente(i) === 'investigacao';
export const isIncidenteContido = (i: IncidenteLike) => estadoIncidente(i) === 'contido';
export const isIncidenteResolvido = (i: IncidenteLike) => estadoIncidente(i) === 'resolvido';
/** Em curso = tudo o que ainda não foi resolvido/fechado. */
export const isIncidenteEmCurso = (i: IncidenteLike) =>
  ['aberto', 'investigacao', 'contido'].includes(estadoIncidente(i));

export const severidadeIncidente = (i: IncidenteLike): Severidade =>
  severidadeDeFaixas(i.criticidade);

export const contarIncidentes = (incidentes: IncidenteLike[] | null | undefined) => ({
  total: incidentes?.length ?? 0,
  abertos: countBy(incidentes, isIncidenteAberto),
  investigacao: countBy(incidentes, isIncidenteEmInvestigacao),
  contidos: countBy(incidentes, isIncidenteContido),
  resolvidos: countBy(incidentes, isIncidenteResolvido),
  emCurso: countBy(incidentes, isIncidenteEmCurso),
  criticos: countBy(incidentes, (i) => severidadeIncidente(i) === 'critico'),
  altos: countBy(incidentes, (i) => severidadeIncidente(i) === 'alto'),
  medios: countBy(incidentes, (i) => severidadeIncidente(i) === 'medio'),
  baixos: countBy(incidentes, (i) => severidadeIncidente(i) === 'baixo'),
});
