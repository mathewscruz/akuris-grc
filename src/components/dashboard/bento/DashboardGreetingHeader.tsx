import { IconCalendar } from '@/components/icons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';

/** Saudação do painel + busca (abre o Cmd+K) + período. Único <h1> da página. */
export function DashboardGreetingHeader({ nome, periodo, onPeriodo }: { nome: string; periodo: number; onPeriodo: (d: number) => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {nome ? t('bento.hello', { name: nome }) : t('bento.helloTeam')}
        </h1>
        <p className="mt-1.5 text-base text-muted-foreground">{t('bento.subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={String(periodo)} onValueChange={(v) => onPeriodo(Number(v))}>
          <SelectTrigger className="h-11 w-auto gap-2 rounded-xl border-border bg-card px-4 focus:ring-1 focus:ring-inset focus:ring-primary focus:ring-offset-0 focus:border-primary data-[state=open]:border-primary" aria-label={t('bento.period.label')}>
            <IconCalendar className="h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[7, 30, 90].map((d) => <SelectItem key={d} value={String(d)}>{t('bento.period.last', { count: d })}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
