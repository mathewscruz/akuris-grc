/**
 * AppetiteFooter — rodapé do card da matriz: apetite + contagem acima.
 */
import { Flag } from 'lucide-react';

interface Props {
  apetiteLabel?: string;
  apetiteScore?: number | null;
  acimaCount: number;
}

export function AppetiteFooter({ apetiteLabel = 'Médio', apetiteScore, acimaCount }: Props) {
  return (
    <div className="mt-4 px-4 py-2.5 bg-muted/30 rounded-lg flex items-center justify-between text-xs">
      <div className="inline-flex items-center gap-2 text-foreground/85">
        <Flag className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
        Apetite:&nbsp;
        <span className="font-semibold text-foreground">
          ≤ {apetiteLabel}{apetiteScore ? ` (score ${apetiteScore})` : ''}
        </span>
      </div>
      {acimaCount > 0 && (
        <span className="text-destructive font-semibold">{acimaCount} acima do apetite</span>
      )}
    </div>
  );
}
