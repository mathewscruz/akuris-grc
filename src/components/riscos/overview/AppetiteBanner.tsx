/**
 * AppetiteBanner — alerta de topo na Visão geral.
 * Mostra quantos riscos estão acima do apetite (Alto/Crítico) e oferece atalho para a Matriz.
 */
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconWarning, IconArrowRight } from '@/components/icons';

interface Props {
  count: number;
  onSeeMatrix?: () => void;
}

export function AppetiteBanner({ count, onSeeMatrix }: Props) {
  const { t } = useLanguage();
  if (count === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card border-l-[3px] border-l-destructive px-4 py-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <IconWarning className="h-4 w-4 flex-shrink-0 text-destructive" strokeWidth={1.5} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground leading-tight">
            {t('riscosVisoes.overview.appetiteBanner.titulo')}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {count} {count === 1
              ? t('riscosVisoes.overview.appetiteBanner.descricaoSingular')
              : t('riscosVisoes.overview.appetiteBanner.descricaoPlural')}
          </div>
        </div>
      </div>
      {onSeeMatrix && (
        <Button variant="ghost" size="sm" onClick={onSeeMatrix} className="flex-shrink-0">
          {t('riscosVisoes.overview.appetiteBanner.verNaMatriz')}
          <IconArrowRight className="h-3.5 w-3.5 ml-1" strokeWidth={1.5} />
        </Button>
      )}
    </div>
  );
}
