/**
 * Escolher VÁRIOS registos de um módulo — a versão múltipla do `EntidadeSelect`.
 *
 * ## Porque nasceu
 *
 * Havia duas metades de uma peça só: `EntidadeSelect` é genérico (serve
 * qualquer entidade do registo em `entity-search.ts`) mas escolhe um; e
 * `AuditoriasMultiSelect` escolhe vários mas está preso à tabela de auditorias.
 *
 * Faltava a combinação, e sem ela ficaram colunas de vínculo sem forma de as
 * preencher: `incidentes.riscos_relacionados` e `incidentes.ativos_afetados`
 * existem desde a primeira migration do módulo, estão declaradas no formulário
 * e gravadas no payload — e nunca houve um campo que as escrevesse. Zero de 18
 * incidentes tinham vínculo. Um incidente crítico não conseguia apontar o risco
 * que se materializou.
 *
 * Reusa a mesma fonte, o mesmo `matchesTokens` e o mesmo isolamento por empresa
 * do seletor simples — o comportamento de busca é o que a pessoa já conhece.
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
import { ENTITY_BY_KEY, EntityKey } from '@/lib/entity-search';
import { IconCheck, IconSort, IconClose } from '@/components/icons';

interface Props {
  entidade: EntityKey;
  /** Ids escolhidos. Nunca `undefined` — lista vazia é lista vazia. */
  value: string[];
  onValueChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Impede escolher mais do que isto. Sem limite por omissão. */
  max?: number;
}

export function EntidadeMultiSelect({
  entidade,
  value,
  onValueChange,
  placeholder,
  disabled,
  max,
}: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const options = useEntityOptions(entidade, open, value);
  // A failed/missing lookup must never silently remove a saved relationship.
  const escolhidos = value.map((id, index) => options.selectedRows.find((row) => row.id === id)
    ?? options.rows.find((row) => row.id === id)
    ?? { id, codigo: '', titulo: options.selectionLoading ? t('common.loading') : t('experience.missingLink', { number: index + 1 }) });

  const campoSubtitulo = ENTITY_BY_KEY[entidade]?.subtituloField;
  const subtituloCategory = categoryFromFieldName(
    Array.isArray(campoSubtitulo) ? campoSubtitulo[0] : campoSubtitulo,
  );

  const alternar = (id: string) => {
    if (value.includes(id)) {
      onValueChange(value.filter((v) => v !== id));
      return;
    }
    if (max && value.length >= max) return;
    onValueChange([...value, id]);
  };

  const noLimite = !!max && value.length >= max;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label={`${t(ENTITY_BY_KEY[entidade].labelKey)}: ${value.length ? t('entidadeSelect.multiEscolhidos', { n: String(value.length) }) : placeholder ?? t('entidadeSelect.placeholder')}`}
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={cn('truncate', !value.length && 'text-muted-foreground')}>
              {value.length
                ? t('entidadeSelect.multiEscolhidos', { n: String(value.length) })
                : placeholder ?? t('entidadeSelect.placeholder')}
            </span>
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
              {!options.isLoading && !options.isError && (
                <CommandGroup>
                  {options.rows.map((row) => {
                    const marcado = value.includes(row.id);
                    return (
                      <CommandItem
                        key={row.id}
                        value={row.id}
                        // No limite, quem já está escolhido continua a poder sair.
                        disabled={noLimite && !marcado}
                        onSelect={() => alternar(row.id)}
                      >
                        <IconCheck className={cn('mr-2 h-4 w-4', marcado ? 'opacity-100' : 'opacity-0')} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium">{row.titulo}</span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{row.codigo}</span>
                            {row.subtitulo && (
                              <Badge variant="outline" className="text-micro">
                                {getEnumLabel(t, subtituloCategory, row.subtitulo)}
                              </Badge>
                            )}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                  {options.hasMore && <CommandItem value="__more__" onSelect={options.showMore} className="justify-center text-primary">{t('experience.searchMore')}</CommandItem>}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {options.selectionError && <Button type="button" variant="ghost" size="sm" onClick={options.retrySelection}>{t('experience.retryLink')}</Button>}

      {/*
        As escolhas ficam à vista, e cada uma sai sozinha. Fechar o painel para
        descobrir o que se escolheu obrigaria a reabri-lo para corrigir.
      */}
      {escolhidos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {escolhidos.map((row) => (
            <Badge key={row.id} variant="secondary" className="gap-1 pr-1 font-normal">
              <span className="font-mono text-micro">{row.codigo}</span>
              <span className="max-w-[14rem] truncate">{row.titulo}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => alternar(row.id)}
                  className="rounded-sm p-0.5 hover:bg-accent"
                  aria-label={t('entidadeSelect.remover', { titulo: row.titulo })}
                >
                  <IconClose className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
