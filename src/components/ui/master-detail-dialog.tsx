import { ReactNode, useState } from 'react';
import { IconAdd, IconSearch } from '@/components/icons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MasterDetailItem {
  id: string;
  label: string;
  description?: string;
  badge?: ReactNode;
  icon?: LucideIcon;
}

interface MasterDetailDialogProps<T extends MasterDetailItem> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  items: T[];
  selectedId?: string | null;
  onSelect: (item: T) => void;
  /** Render the right-hand panel for the active item */
  renderDetail: (item: T | null) => ReactNode;
  /** Empty state when no items at all */
  emptyState?: ReactNode;
  /** Empty selection placeholder */
  emptySelection?: ReactNode;
  /** New item button on top of list */
  onCreate?: () => void;
  createLabel?: string;
  /** Enable search filter on labels/descriptions */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Footer actions (right side) */
  footer?: ReactNode;
  size?: 'lg' | 'xl' | '2xl';
}

const SIZE_CLASSES = {
  lg: 'sm:max-w-5xl',
  xl: 'sm:max-w-6xl',
  '2xl': 'sm:max-w-7xl',
};

/**
 * Standardized list-on-the-left, panel-on-the-right detail dialog.
 * Used for browsing/editing collections of items inline (aditivos,
 * versions, comments, etc.) without opening nested modals.
 */
export function MasterDetailDialog<T extends MasterDetailItem>({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  items,
  selectedId,
  onSelect,
  renderDetail,
  emptyState,
  emptySelection,
  onCreate,
  createLabel = 'Novo',
  searchable = true,
  searchPlaceholder = 'Buscar...',
  footer,
  size = 'xl',
}: MasterDetailDialogProps<T>) {
  const [search, setSearch] = useState('');

  const filtered = searchable && search.trim()
    ? items.filter((it) => {
        const q = search.toLowerCase();
        return (
          it.label.toLowerCase().includes(q) ||
          (it.description?.toLowerCase().includes(q) ?? false)
        );
      })
    : items;

  const selected = items.find((i) => i.id === selectedId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'p-0 gap-0 overflow-hidden flex flex-col',
          'max-w-full max-h-[100dvh] sm:max-h-[92vh]',
          SIZE_CLASSES[size]
        )}
      >
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-xl">
            {Icon && (
              <span className="flex h-9 w-9 items-center justify-center text-primary">
                <Icon className="h-5 w-5" />
              </span>
            )}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* Master (list) */}
          <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r bg-card flex flex-col shrink-0 max-h-64 lg:max-h-none">
            <div className="p-3 space-y-2 border-b bg-card">
              {searchable && (
                <div className="relative">
                  <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              )}
              {onCreate && (
                <Button onClick={onCreate} size="sm" className="w-full gap-2">
                  <IconAdd className="h-4 w-4" />
                  {createLabel}
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {items.length === 0
                    ? emptyState ?? 'Nenhum item cadastrado.'
                    : 'Nenhum resultado.'}
                </div>
              ) : (
                <ul className="p-2 space-y-1">
                  {filtered.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = item.id === selectedId;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(item)}
                          className={cn(
                            'w-full text-left rounded-md px-3 py-2.5 transition-colors',
                            'hover:bg-background border border-transparent',
                            isActive &&
                              'bg-background border-border shadow-sm'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {ItemIcon && (
                              <ItemIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {item.label}
                                </span>
                                {item.badge}
                              </div>
                              {item.description && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </aside>

          {/* Detail */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="px-6 py-6">
                {selected ? (
                  renderDetail(selected)
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground py-12">
                    {emptySelection ?? 'Selecione um item à esquerda para ver os detalhes.'}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {footer && (
          <div className="flex-shrink-0 border-t bg-card px-6 py-3">
            <div className="flex items-center justify-end gap-2">{footer}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
