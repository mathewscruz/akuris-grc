import { Select, SelectContent, SelectItem, SelectLabel, SelectGroup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const options = [
  { value: 'nao_avaliado', key: 'naoAvaliado', tone: 'bg-muted-foreground' },
  { value: 'conforme', key: 'conforme', tone: 'bg-success' },
  { value: 'parcial', key: 'parcial', tone: 'bg-warning' },
  { value: 'nao_conforme', key: 'naoConforme', tone: 'bg-destructive' },
  { value: 'nao_aplicavel', key: 'na', tone: 'bg-info' },
] as const;

/** Neutral field, semantic marker and explanatory menu; Radix keeps keyboard behavior. */
export function ConformitySelect({ value, onValueChange, disabled, includeUnassessed = true }: {
  value?: string | null; onValueChange: (value: string) => void; disabled?: boolean; includeUnassessed?: boolean;
}) {
  const { t } = useLanguage();
  const selected = options.find(option => option.value === value) ?? options[0];
  const entries = options.filter(option => includeUnassessed || option.value !== 'nao_avaliado');
  return <Select value={value || 'nao_avaliado'} onValueChange={onValueChange} disabled={disabled}>
    <SelectTrigger aria-label={t('gapUi.detail.statusLabel')} className="h-9 min-w-[10rem] gap-2 rounded-lg border-border/70 bg-background px-3 text-xs font-medium text-foreground shadow-none transition-colors hover:border-primary/35 hover:bg-primary/[0.025] data-[state=open]:border-primary/50">
      <SelectValue><span className="flex items-center gap-2"><i aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', selected.tone)} />{t('gapUi.status.' + selected.key)}</span></SelectValue>
    </SelectTrigger>
    <SelectContent className="w-[min(21rem,calc(100vw-2rem))] [&_[data-radix-select-viewport]]:!min-w-0 rounded-lg p-1 shadow-lg">
      <SelectGroup><SelectLabel className="px-3 pb-2 text-xs text-muted-foreground">{t('gapUi.detail.statusLabel')}</SelectLabel>
        {entries.map(option => <SelectItem key={option.value} value={option.value} textValue={t('gapUi.status.' + option.key)} className="my-0.5 rounded-lg py-2.5 pr-3">
          <span className="flex items-start gap-2.5"><i aria-hidden="true" className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', option.tone)} /><span className="block"><span className="block text-sm font-medium">{t('gapUi.status.' + option.key)}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{t('gapUi.workspace.statusHints.' + option.value)}</span></span></span>
        </SelectItem>)}
      </SelectGroup>
    </SelectContent>
  </Select>;
}
