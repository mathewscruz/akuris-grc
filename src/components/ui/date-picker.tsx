import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ptBR, pt as ptPT, enUS } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDateForInput, formatDateOnly } from "@/lib/date-utils";
import { IconCalendar } from '@/components/icons';

interface DatePickerWithRangeProps {
  date?: DateRange;
  onDateChange?: (date: DateRange | undefined) => void;
  className?: string;
}

export function DatePickerWithRange({
  date,
  onDateChange,
  className,
}: DatePickerWithRangeProps) {
  const { t, locale } = useLanguage();
  // O intervalo saía sempre em inglês ("Jul 18, 2026") porque `format` corria
  // sem locale; agora segue o formato do idioma activo, como o resto das datas.
  const rotulo = (d: Date) => formatDateOnly(formatDateForInput(d.toISOString()));
  const dateFns = locale === 'en' ? enUS : locale === 'pt' ? ptPT : ptBR;
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <IconCalendar className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {rotulo(date.from)} – {rotulo(date.to)}
                </>
              ) : (
                rotulo(date.from)
              )
            ) : (
              <span>{t('residuos.geral.selecionePeriodo')}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onDateChange}
            numberOfMonths={2}
            locale={dateFns}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}