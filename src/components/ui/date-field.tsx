import * as React from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR, pt as ptPT, enUS } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DateFieldProps {
  /** Valor em ISO curto (YYYY-MM-DD) — o formato guardado na base de dados. */
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Mostra o botão de limpar quando há data escolhida. */
  clearable?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  fromDate?: Date;
  toDate?: Date;
}

const toIso = (d: Date): string => format(d, 'yyyy-MM-dd');

/**
 * Seletor de data único da aplicação.
 *
 * Substitui as três variantes que coexistiam (calendário próprio dos Planos de
 * Ação, `<input type="date">` nativo nas tarefas de projeto e em Configurações).
 * Mostra sempre a data no formato do idioma ativo e **fecha o painel assim que a
 * data é escolhida**.
 */
export function DateField({
  value,
  onChange,
  placeholder,
  disabled,
  clearable = true,
  className,
  id,
  fromDate,
  toDate,
  ...rest
}: DateFieldProps) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = React.useState(false);

  const dateFns = locale === 'en' ? enUS : locale === 'pt' ? ptPT : ptBR;
  const pattern = locale === 'en' ? 'MM/dd/yyyy' : 'dd/MM/yyyy';

  const selected = React.useMemo(() => {
    if (!value) return undefined;
    const parsed = value.length > 10 ? new Date(value) : parseISO(value);
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  const label = selected ? format(selected, pattern, { locale: dateFns }) : (placeholder ?? t('common.selectDate'));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          title={label}
          aria-label={rest['aria-label'] ?? label}
          className={cn(
            'w-full justify-start gap-2 text-left font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
          <span className="truncate">{label}</span>
          {clearable && selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label={t('common.clear')}
              className="ml-auto rounded p-0.5 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          locale={dateFns}
          fromDate={fromDate}
          toDate={toDate}
          initialFocus
          onSelect={(d) => {
            onChange(d ? toIso(d) : null);
            // Fecha logo após escolher — o painel ficava aberto e tapava o formulário.
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
