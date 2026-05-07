import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RiscosIcon } from '@/components/icons';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { TratamentosList } from './TratamentosList';

interface TratamentosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risco: any;
  onSuccess: () => void;
}

export function TratamentosDialog({ open, onOpenChange, risco, onSuccess }: TratamentosDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-5xl max-h-[100dvh] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="relative flex-shrink-0 px-8 pt-7 pb-5 border-b">
          <CornerAccent position="top-left" />
          <DialogTitle className="flex items-center gap-3 text-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RiscosIcon className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Tratamentos do risco
              </span>
              <span className="text-lg font-semibold leading-tight">{risco?.nome}</span>
            </span>
          </DialogTitle>
          <DialogDescription className="pl-[52px]">
            Gerencie as ações de mitigação, transferência, aceite ou eliminação associadas a este risco.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <TratamentosList
            embedded
            riscoId={risco?.id}
            riscoNome={risco?.nome}
            riscoData={{
              nome: risco?.nome,
              descricao: risco?.descricao || '',
              categoria: risco?.categoria?.nome,
              nivel_risco_inicial: risco?.nivel_risco_inicial,
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
