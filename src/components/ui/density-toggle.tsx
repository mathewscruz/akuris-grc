import { Button } from '@/components/ui/button';
import { IconRows } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTableDensity } from '@/hooks/useTableDensity';
import { cn } from '@/lib/utils';

interface DensityToggleProps {
  className?: string;
  iconOnly?: boolean;
}

/** Preferência global e persistente para a densidade das tabelas. */
export function DensityToggle({ className, iconOnly = false }: DensityToggleProps) {
  const { t } = useLanguage();
  const [density, , toggle] = useTableDensity();
  const label = density === 'compact'
    ? t('common.compactDensity')
    : t('common.comfortableDensity');
  const shortLabel = density === 'compact'
    ? t('table.densityCompact')
    : t('table.densityComfortable');

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      aria-label={label}
      aria-pressed={density === 'compact'}
      title={label}
      className={cn('gap-2', className)}
    >
      <IconRows className="h-4 w-4" strokeWidth={1.5} />
      {!iconOnly && <span>{shortLabel}</span>}
    </Button>
  );
}
