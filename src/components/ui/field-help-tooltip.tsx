import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { IconHelp } from '@/components/icons';

interface FieldHelpTooltipProps {
  content: React.ReactNode;
  className?: string;
  iconClassName?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Standard inline help tooltip used next to form labels.
 * Usage: <Label>Campo <FieldHelpTooltip content="Explicação" /></Label>
 */
export function FieldHelpTooltip({
  content,
  className,
  iconClassName,
  side = 'top',
}: FieldHelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            className={cn(
              'inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors align-middle',
              className
            )}
            aria-label="Ajuda"
          >
            <IconHelp className={cn('h-3.5 w-3.5', iconClassName)} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
