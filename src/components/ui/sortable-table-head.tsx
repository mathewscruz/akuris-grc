import * as React from 'react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { IconSort, IconChevronDown, IconChevronUp } from '@/components/icons';

export type SortDirection = 'asc' | 'desc';
export interface SortState {
  field: string;
  direction: SortDirection;
}

/** Comparação estável e acento-insensível para ordenação A-Z / Z-A. */
export function compareSortValues(a: unknown, b: unknown): number {
  const emptyA = a === null || a === undefined || a === '';
  const emptyB = b === null || b === undefined || b === '';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a) - Number(b);
  const sa = String(a);
  const sb = String(b);
  const da = Date.parse(sa);
  const db = Date.parse(sb);
  const isoLike = /^\d{4}-\d{2}-\d{2}/;
  if (!Number.isNaN(da) && !Number.isNaN(db) && isoLike.test(sa) && isoLike.test(sb)) return da - db;
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Ordenação A-Z / Z-A para tabelas que não usam o DataTable.
 * `accessors` permite mapear uma coluna a um valor derivado.
 */
export function useTableSort<T extends Record<string, any>>(
  data: T[],
  accessors?: Record<string, (item: T) => unknown>,
) {
  const [sort, setSort] = React.useState<SortState | null>(null);

  const toggleSort = React.useCallback((field: string) => {
    setSort((prev) =>
      prev?.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    );
  }, []);

  const sorted = React.useMemo(() => {
    if (!sort) return data;
    const accessor = accessors?.[sort.field];
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...data].sort(
      (a, b) => factor * compareSortValues(accessor ? accessor(a) : a?.[sort.field], accessor ? accessor(b) : b?.[sort.field]),
    );
  }, [data, sort, accessors]);

  return { sorted, sort, toggleSort };
}

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  field: string;
  sort: SortState | null;
  onSort: (field: string) => void;
}

export function SortableTableHead({ field, sort, onSort, className, children, ...props }: SortableTableHeadProps) {
  const active = sort?.field === field;
  return (
    <TableHead
      {...props}
      aria-sort={active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn('group/th select-none', className)}
    >
      <button type="button" onClick={() => onSort(field)} className="inline-flex w-full items-center gap-1.5 rounded-md py-2 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {children}
        {active ? (
          sort?.direction === 'asc' ? (
            <IconChevronUp className="h-4 w-4 text-foreground" strokeWidth={1.5} />
          ) : (
            <IconChevronDown className="h-4 w-4 text-foreground" strokeWidth={1.5} />
          )
        ) : (
          <IconSort className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover/th:opacity-80 group-focus-within/th:opacity-80" strokeWidth={1.5} />
        )}
      </button>
    </TableHead>
  );
}
