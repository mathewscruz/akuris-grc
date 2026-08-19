/**
 * AppetiteFooter — rodapé do card da matriz: apetite + contagem acima.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { IconFlag } from '@/components/icons';

interface Props {
  apetiteLabel?: string;
  apetiteScore?: number | null;
  acimaCount: number;
}

export function AppetiteFooter({ apetiteLabel = 'Médio', apetiteScore, acimaCount }: Props) {
  const { t } = useLanguage();
  return (
    <div className="mt-4 px-4 py-2.5 bg-muted/30 rounded-lg flex items-center justify-between text-xs">
      <div className="inline-flex items-center gap-2 text-foreground/85">
        <IconFlag className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
        {t('riscosVisoes.matrix.appetiteFooter.apetite')}&nbsp;
        <span className="font-semibold text-foreground">
          ≤ {apetiteLabel}{apetiteScore ? ` (${t('riscosVisoes.matrix.appetiteFooter.score')} ${apetiteScore})` : ''}
        </span>
      </div>
      {acimaCount > 0 && (
        <span className="text-destructive font-semibold">
          {t('riscosVisoes.matrix.appetiteFooter.acima', { count: acimaCount })}
        </span>
      )}
    </div>
  );
}
