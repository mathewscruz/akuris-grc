export type ReviewSort = { field: string; direction: 'asc' | 'desc' };
export function nextReviewSort(current: ReviewSort | null, field: string): ReviewSort | null {
  return current?.field === field ? (current.direction === 'asc' ? { field, direction: 'desc' } : null) : { field, direction: 'asc' };
}
/** Shared by displayed rows and exports. Missing values remain last in either direction. */
export function compareReviewRows(a: any, b: any, sort: ReviewSort | null): number {
  if (!sort) return 0;
  const value = (item: any) => sort.field === 'progress'
    ? (item.total_contas > 0 ? item.contas_revisadas / item.total_contas : null)
    : sort.field.split('.').reduce((part, key) => part?.[key], item);
  const left = value(a), right = value(b);
  if (left === right) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  const result = typeof left === 'number' && typeof right === 'number'
    ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true });
  return result * (sort.direction === 'asc' ? 1 : -1);
}
