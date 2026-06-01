import React from 'react';
import { ListTodo } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { CriarTarefaFromGRC } from './CriarTarefaFromGRC';
import type { ProjetoVinculoEntidade } from '@/types/projetos';

/**
 * Item de menu controlado: abre o dialog do CriarTarefaFromGRC mesmo quando
 * o DropdownMenu fecha (estado vive fora do menu).
 */
export function CriarTarefaMenuItem(props: {
  entidadeTipo: ProjetoVinculoEntidade;
  entidadeId: string;
  tituloSugerido?: string;
  descricaoSugerida?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
        <ListTodo className="mr-2 h-4 w-4" /> Criar tarefa de projeto
      </DropdownMenuItem>
      <CriarTarefaFromGRCControlled
        open={open}
        onOpenChange={setOpen}
        entidadeTipo={props.entidadeTipo}
        entidadeId={props.entidadeId}
        tituloSugerido={props.tituloSugerido}
        descricaoSugerida={props.descricaoSugerida}
      />
    </>
  );
}

/**
 * Variante puramente controlada — renderiza só o dialog do CriarTarefaFromGRC.
 * Usa o componente original com `trigger` invisível, clicando programaticamente.
 */
function CriarTarefaFromGRCControlled({
  open, onOpenChange, ...rest
}: { open: boolean; onOpenChange: (v: boolean) => void } & React.ComponentProps<typeof CriarTarefaFromGRC>) {
  const triggerRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (open) triggerRef.current?.click();
  }, [open]);

  return (
    <div className="contents" onClick={(e) => e.stopPropagation()}>
      <CriarTarefaFromGRC
        {...rest}
        trigger={<span ref={triggerRef} style={{ display: 'none' }} />}
      />
    </div>
  );
}
