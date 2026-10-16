export type GrupoDia = 'today' | 'yesterday' | 'week' | 'older';

export const ORDEM_GRUPOS: GrupoDia[] = ['today', 'yesterday', 'week', 'older'];

const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Grupo de um instante relativo a `agora`, pelo calendário local. */
export function grupoDoDia(iso: string, agora: Date = new Date()): GrupoDia {
  const hoje = inicioDoDia(agora);
  const t = new Date(iso).getTime();
  const dia = 86_400_000;
  if (t >= hoje) return 'today';
  if (t >= hoje - dia) return 'yesterday';
  if (t >= hoje - 6 * dia) return 'week';
  return 'older';
}

/** Agrupa itens por Hoje / Ontem / Esta semana / Mais antigos, mais recentes primeiro. */
export function agruparPorDia<T extends { created_at: string }>(itens: T[], agora: Date = new Date()) {
  const grupos: Record<GrupoDia, T[]> = { today: [], yesterday: [], week: [], older: [] };
  for (const i of itens) grupos[grupoDoDia(i.created_at, agora)].push(i);
  for (const g of ORDEM_GRUPOS) grupos[g].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return grupos;
}
