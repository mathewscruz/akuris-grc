import { useLanguage, type Locale } from '@/contexts/LanguageContext';
import { IconCheck, IconGlobe } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  /** `dark` = sobre fundo escuro (landing/auth); `app` = cabeçalho autenticado. */
  variant?: 'default' | 'dark' | 'app';
}

/** Ordem fixa: Portugal, Brasil, inglês. */
export const LOCALE_OPTIONS: Array<{ value: Locale; short: string; label: string }> = [
  { value: 'pt', short: 'PT', label: 'Português (Portugal)' },
  { value: 'pt-BR', short: 'BR', label: 'Português (Brasil)' },
  { value: 'en', short: 'EN', label: 'English' },
];

export function LanguageSelector({ variant = 'default' }: LanguageSelectorProps) {
  const { locale, setLocale, t } = useLanguage();
  const current = LOCALE_OPTIONS.find((o) => o.value === locale) ?? LOCALE_OPTIONS[0];
  const onDark = variant === 'dark' || variant === 'default';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('language.selector')}
          title={`${t('language.selector')}: ${current.label}`}
          className={cn(
            'h-8 gap-1.5 px-2.5 text-sm font-medium',
            onDark && 'text-white hover:bg-white/10',
          )}
        >
          <IconGlobe className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          <span>{current.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('language.selector')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => setLocale(option.value)}
            className="gap-2"
          >
            <span className="w-7 text-xs font-semibold text-muted-foreground">{option.short}</span>
            <span className="flex-1">{option.label}</span>
            {option.value === locale && <IconCheck className="h-4 w-4 text-primary" strokeWidth={1.5} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
