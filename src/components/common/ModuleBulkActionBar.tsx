/**
 * ModuleBulkActionBar — barra genérica de ações em lote (item 3 do plano
 * "menos interações").
 *
 * Generaliza o padrão do `BulkActionBar` do Gap Analysis para qualquer
 * módulo: aparece quando há 1+ registos selecionados na tabela e oferece
 * mudar a situação de todos, exportar os selecionados e limpar a seleção.
 *
 * As opções de situação chegam por `statusOptions`, porque cada módulo tem
 * o seu vocabulário (incidente "contido" não existe em contratos).
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IconCheckbox, IconChevronDown, IconClose, IconDownload } from '@/components/icons';

export interface BulkStatusOption {
  value: string;
  label: string;
}

interface Props {
  selectedCount: number;
  onClear: () => void;
  /** Opções de situação do módulo. Sem elas, o menu de situação não aparece. */
  statusOptions?: BulkStatusOption[];
  onStatusChange?: (status: string) => void;
  onExport?: () => void;
  /** Enquanto uma ação corre, os botões ficam parados para não duplicar. */
  busy?: boolean;
}

export function ModuleBulkActionBar({
  selectedCount,
  onClear,
  statusOptions,
  onStatusChange,
  onExport,
  busy = false,
}: Props) {
  const { t } = useLanguage();

  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-4 z-30 mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-foreground/20 bg-foreground px-4 py-2.5 text-background shadow-lg">
        <IconCheckbox className="h-4 w-4 text-primary" strokeWidth={1.5} />
        <span className="text-sm font-medium">
          {selectedCount > 1
            ? t('bulkActions.selectedPlural', { count: selectedCount })
            : t('bulkActions.selectedSingular', { count: selectedCount })}
        </span>
        <span className="mx-2 h-4 w-px bg-background/20" />

        {statusOptions && statusOptions.length > 0 && onStatusChange && (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-background/10 disabled:opacity-50"
            >
              {busy ? t('bulkActions.applying') : t('bulkActions.changeStatus')}
              <IconChevronDown className="h-3 w-3" strokeWidth={1.5} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {statusOptions.map((option) => (
                <DropdownMenuItem key={option.value} onClick={() => onStatusChange(option.value)}>
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-background/10 disabled:opacity-50"
          >
            <IconDownload className="h-3.5 w-3.5" strokeWidth={1.5} /> {t('bulkActions.exportSelected')}
          </button>
        )}

        <span className="ml-auto" />
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          aria-label={t('bulkActions.clearSelection')}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-background/10 disabled:opacity-50"
        >
          <IconClose className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
