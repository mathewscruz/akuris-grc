import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** Responsável numa linha de tabela: avatar redondo + primeiro nome; vazio com avatar tracejado. */
export function OwnerCell({ name, photo, emptyLabel }: { name?: string | null; photo?: string | null; emptyLabel: string }) {
  if (!name) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full border border-dashed border-muted-foreground/40" />
        {emptyLabel}
      </span>
    );
  }
  const initials = name.split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex max-w-40 cursor-default items-center gap-2">
            <Avatar className="h-8 w-8 shrink-0">
              {photo && <AvatarImage src={photo} alt={name} />}
              <AvatarFallback className="text-micro">{initials}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs font-medium text-foreground/85">{name.split(/\s+/)[0]}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent><p>{name}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
