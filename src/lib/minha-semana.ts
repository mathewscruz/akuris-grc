import { somarDias, inicioDe, fimDe, type DatasTarefa, type DataISO } from './projeto-cronograma';

/** Segunda-feira (ISO) da semana que contém `dia`. */
export function segundaDaSemana(dia: DataISO): DataISO {
  const d = new Date(`${dia}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // seg=0 … dom=6
  return somarDias(dia, -dow);
}

export function diasDaSemana(segunda: DataISO): DataISO[] {
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
}

export type PosicaoSemana = { tipo: 'dia'; dia: DataISO } | { tipo: 'andamento' } | null;

/**
 * Onde a tarefa aparece na semana: na coluna do dia em que vence, ou na faixa
 * "em andamento" quando começou antes e vence depois desta semana.
 */
export function posicaoNaSemana(t: DatasTarefa, segunda: DataISO): PosicaoSemana {
  const ini = inicioDe(t); const fim = fimDe(t);
  if (!ini || !fim) return null;
  const domingo = somarDias(segunda, 6);
  if (fim >= segunda && fim <= domingo) return { tipo: 'dia', dia: fim };
  if (ini <= domingo && fim > domingo) return { tipo: 'andamento' };
  return null;
}
