/**
 * Seletor genérico de registo GRC — mesma experiência do "Risco Relacionado"
 * de Governança, mas para qualquer entidade do registo em `entity-search.ts`.
 * Usado nos Vínculos GRC de tarefas e na origem dos planos de ação.
 */
import { useState } from 'react';
import { useEntityOptions } from '@/hooks/useEntityOptions';
import { EntitySearchFeedback } from './EntitySearchFeedback';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { getEnumLabel, categoryFromFieldName } from '@/lib/enum-labels';
import { ENTITY_BY_KEY, EntityKey, EntityRow } from '@/lib/entity-search';
import { IconCheck, IconSort } from '@/components/icons';

interface EntidadeSelectProps {
  entidade: EntityKey;
  value?: string;
  onValueChange: (id: string, row?: EntityRow) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

export function EntidadeSelect({
  entidade,
  value,
  onValueChange,
  placeholder,
  allowClear = true,
  disabled,
}: EntidadeSelectProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const options = useEntityOptions(entidade, open, value ? [value] : []);
  const selecionado = options.selectedRows.find((r) => r.id === value) ?? options.rows.find((r) => r.id === value);
  // `subtituloField` pode ser uma lista de alternativas (o risco usa
  // residual → inerente); a categoria do rótulo sai da primeira.
  const campoSubtitulo = ENTITY_BY_KEY[entidade]?.subtituloField;
  const subtituloCategory = categoryFromFieldName(
    Array.isArray(campoSubtitulo) ? campoSubtitulo[0] : campoSubtitulo,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={`${t(ENTITY_BY_KEY[entidade].labelKey)}: ${selecionado?.titulo ?? (value ? t('experience.linkUnavailable') : placeholder ?? t('entidadeSelect.placeholder'))}`}
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selecionado ? (
            <span className="flex items-center gap-2 truncate">
              <Badge variant="outline" className="text-micro font-mono">{selecionado.codigo}</Badge>
              <span className="truncate">{selecionado.titulo}</span>
            </span>
          ) : (
            <span className="text-muted-foreground truncate">
              {value ? t(options.selectionLoading ? 'common.loading' : 'experience.linkUnavailable') : placeholder ?? t('entidadeSelect.placeholder')}
            </span>
          )}
          <IconSort className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0 bg-popover" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            aria-label={t('entidadeSelect.search')}
            placeholder={t('entidadeSelect.search')}
            value={options.search}
            onValueChange={options.setSearch}
          />
          <CommandList>
            <EntitySearchFeedback loading={options.isLoading} error={options.isError} empty={options.rows.length === 0} retry={options.retry} />
            {options.selectionError && <CommandGroup><CommandItem value="__retry_selection__" onSelect={options.retrySelection}>{t('experience.retryLink')}</CommandItem></CommandGroup>}
            {allowClear && <CommandGroup><CommandItem value="__none__" onSelect={() => { onValueChange(''); setOpen(false); }}>
              <IconCheck className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
              <span className="text-muted-foreground">{t('entidadeSelect.none')}</span>
            </CommandItem></CommandGroup>}
            {!options.isLoading && !options.isError && (
              <CommandGroup>
                {options.rows.map((row) => (
                  <CommandItem
                    key={row.id}
                    value={row.id}
                    onSelect={() => { onValueChange(row.id, row); setOpen(false); }}
                  >
                    <IconCheck className={cn('mr-2 h-4 w-4', value === row.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{row.titulo}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{row.codigo}</span>
                        {row.subtitulo && <Badge variant="outline" className="text-micro">{getEnumLabel(t, subtituloCategory, row.subtitulo)}</Badge>}
                      </span>
                    </div>
                  </CommandItem>
                ))}
                {options.hasMore && <CommandItem value="__more__" onSelect={options.showMore} className="justify-center text-primary">{t('experience.searchMore')}</CommandItem>}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
