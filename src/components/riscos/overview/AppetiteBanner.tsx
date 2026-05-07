/**
 * AppetiteBanner — alerta de topo na Visão geral.
 * Mostra quantos riscos estão acima do apetite (Alto/Crítico) e oferece atalho para a Matriz.
 */
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  count: number;
  onSeeMatrix?: () => void;
}

export function AppetiteBanner({ count, onSeeMatrix }: Props) {
  if (count === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card border-l-2 border-l-destructive px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" strokeWidth={1.5} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">
            Score consolidado acima do apetite
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {count} {count === 1 ? 'risco exige' : 'riscos exigem'} decisão de tratamento ou aceitação formal esta semana.
          </div>
        </div>
      </div>
      {onSeeMatrix && (
        <Button variant="ghost" size="sm" onClick={onSeeMatrix} className="flex-shrink-0">
          Ver na matriz
          <ArrowRight className="h-3.5 w-3.5 ml-1" strokeWidth={1.5} />
        </Button>
      )}
    </div>
  );
}
