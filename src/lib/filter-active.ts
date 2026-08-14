/**
 * Contagem partilhada de filtros ativos.
 *
 * O valor por omissão dos seletores varia entre módulos ("all", "todos",
 * "todas", vazio). Contar qualquer um deles como filtro ativo fazia o badge
 * "Filtros 1" aparecer sem nenhum filtro aplicado.
 */

const DEFAULT_VALUES = new Set([
  '',
  'all',
  'todos',
  'todas',
  'todo',
  'toda',
  'any',
  'default',
  'undefined',
  'null',
]);

export function isFilterActive(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return true;
  if (typeof value !== 'string') return true;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && !DEFAULT_VALUES.has(normalized);
}

export function countActiveFilters(filters: Array<{ value?: unknown }> = []): number {
  return filters.filter((f) => isFilterActive(f?.value)).length;
}
