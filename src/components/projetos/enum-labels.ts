import type { ProjetoTarefaPrioridade, ProjetoStatus, ProjetoMembroPapel, ProjetoDependenciaTipo } from '@/types/projetos';

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** Mapa único de rótulos traduzidos para os enums do módulo Projetos. */
export function getPrioridadeLabel(t: TFn, prioridade: ProjetoTarefaPrioridade): string {
  return t(`projetos.priority.${prioridade}`);
}

export function getStatusLabel(t: TFn, status: ProjetoStatus): string {
  return t(`projetos.status.${status}`);
}

export function getPapelLabel(t: TFn, papel: ProjetoMembroPapel): string {
  return t(`p3Projetos.papel.${papel}`);
}

export function getDependenciaLabel(t: TFn, tipo: ProjetoDependenciaTipo): string {
  return t(`p3Projetos.dependencia.${tipo}`);
}
