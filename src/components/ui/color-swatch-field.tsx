import { cn } from "@/lib/utils";

export const CORES_PADRAO = ['#7552FF', '#3B82F6', '#14B8A6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#64748B'];

interface ColorSwatchFieldProps {
  value: string;
  onChange: (cor: string) => void;
  cores?: string[];
  'aria-label'?: string;
  className?: string;
}

/** Seletor de cor por amostras — substitui o seletor nativo do navegador. */
export function ColorSwatchField({ value, onChange, cores = CORES_PADRAO, className, ...rest }: ColorSwatchFieldProps) {
  const atual = (value || '').toLowerCase();
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="radiogroup" aria-label={rest['aria-label']}>
      {cores.map((c) => {
        const ativo = atual === c.toLowerCase();
        return (
          <button key={c} type="button" role="radio" aria-checked={ativo} aria-label={c}
            onClick={() => onChange(c)}
            className={cn("h-7 w-7 rounded-full transition-ui", ativo ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'hover:scale-110')}
            style={{ backgroundColor: c }} />
        );
      })}
    </div>
  );
}
