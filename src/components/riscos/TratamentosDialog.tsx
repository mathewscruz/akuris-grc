import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RiscosIcon } from '@/components/icons';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { TratamentosList } from './TratamentosList';
import { useLanguage } from '@/contexts/LanguageContext';

interface TratamentosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risco: any;
  onSuccess: () => void;
  startCreating?: boolean;
}

export function TratamentosDialog({ open, onOpenChange, risco, onSuccess, startCreating = false }: TratamentosDialogProps) {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-5xl max-h-[100dvh] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 sm:p-0 gap-0">
        <DialogHeader className="relative flex-shrink-0 px-8 pt-7 pb-5 border-b">
          <CornerAccent position="top-left" />
          <DialogTitle className="flex items-center gap-3 text-xl">
            <span className="flex h-10 w-10 items-center justify-center text-primary">
              <RiscosIcon className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('riscosDetalhe.tratamentosDialog.eyebrow')}
              </span>
              <span className="text-lg font-semibold leading-tight">{risco?.nome}</span>
            </span>
          </DialogTitle>
          <DialogDescription className="pl-[52px]">
            {t('riscosDetalhe.tratamentosDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
          {open && (
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
              startCreating={startCreating}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
