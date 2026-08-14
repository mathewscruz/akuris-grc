/**
 * RequisitoSelect — escolhe um requisito de framework activo (Gap Analysis)
 * para servir de referência a um item de auditoria, em vez de reescrever texto.
 */
import { useMemo, useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequisitosDisponiveis, type RequisitoOpcao } from '@/hooks/useRiscoRequisitos';

interface Props {
  value?: string;
  onValueChange: (value: string, requisito?: RequisitoOpcao) => void;
  placeholder?: string;
}

export function RequisitoSelect({ value, onValueChange, placeholder }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { data: requisitos = [] } = useRequisitosDisponiveis(true);

  const selecionado = useMemo(() => requisitos.find((r) => r.id === value), [requisitos, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">
            {selecionado
              ? `${selecionado.codigo ? selecionado.codigo + ' · ' : ''}${selecionado.titulo}`
              : placeholder || t('vinculoReq.itemRefNenhum')}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" strokeWidth={1.5} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('vinculoReq.buscar')} />
          <CommandList>
            <CommandEmpty>
              {requisitos.length === 0 ? t('vinculoReq.semFrameworks') : t('vinculoReq.semResultados')}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onValueChange('');
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                {t('vinculoReq.itemRefNenhum')}
              </CommandItem>
              {requisitos.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.codigo} ${r.titulo} ${r.framework_nome}`}
                  onSelect={() => {
                    onValueChange(r.id, r);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === r.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {r.codigo ? <span className="font-mono text-xs text-muted-foreground mr-1.5">{r.codigo}</span> : null}
                      {r.titulo}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{r.framework_nome}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
