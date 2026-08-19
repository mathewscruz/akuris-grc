import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WizardSummaryCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Card used in the WizardDialog sidebar to display a live summary
 * of the form (e.g. risk level, calculated totals, status preview).
 */
export function WizardSummaryCard({ title = 'Resumo', children, className }: WizardSummaryCardProps) {
  return (
    <Card
      className={cn(
        // Opaco de propósito: é a superfície elevada sobre a barra lateral
        // recuada. Com bg-card/50 a cor dependia do fundo e criava um quarto
        // branco no mesmo diálogo.
        'p-4 space-y-3 bg-card border-border/60',
        className
      )}
    >
      <div className="text-xs font-semibold text-muted-foreground">
        {title}
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </Card>
  );
}

interface WizardSummaryRowProps {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}

export function WizardSummaryRow({ label, value, highlight }: WizardSummaryRowProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          'text-xs font-medium text-right break-words min-w-0',
          highlight && 'text-primary'
        )}
      >
        {value}
      </span>
    </div>
  );
}
