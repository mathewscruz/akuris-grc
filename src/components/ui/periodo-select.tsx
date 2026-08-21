/**
 * PeriodoSelect — o selector de janela temporal dos gráficos de tendência.
 *
 * Era um grupo de pílulas (3M · 6M · 12M) encostado ao canto. Passa a um botão
 * com o período escrito por extenso: "3M" obriga a decifrar, "Últimos 3 meses"
 * não. E como o gráfico deixou de ter eixo Y, o cabeçalho é o único sítio que
 * diz o que se está a ver — vale a pena estar escrito.
 */
import { IconCalendar, IconChevronDown } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface OpcaoPeriodo<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  valor: T;
  opcoes: OpcaoPeriodo<T>[];
  onChange: (v: T) => void;
  className?: string;
}

/*
  A assinatura é genérica, mas quem a usa NÃO deve escrever o tipo no JSX —
  `<PeriodoSelect<Range> …>` é TSX válido e passa no `tsc`, e o SWC do plugin
  do Lovable rebenta a analisá-lo. O tipo infere-se de `opcoes`, desde que a
  lista seja anotada como `OpcaoPeriodo<X>[]` onde é declarada.
*/
export function PeriodoSelect<T extends string>({ valor, opcoes, onChange, className }: Props<T>) {
  const activo = opcoes.find((o) => o.value === valor);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('gap-2 bg-card font-medium', className)}
        >
          <IconCalendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          {activo?.label ?? valor}
          <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {opcoes.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(o.value === valor && 'font-semibold')}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
