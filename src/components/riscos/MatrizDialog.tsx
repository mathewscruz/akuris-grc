/**
 * MatrizDialog — configurar a matriz de risco da empresa.
 *
 * Tinha duas abas: "Matriz Visual" e "Configuração". A primeira era uma
 * terceira grelha da mesma matriz — o produto tinha o mapa de calor da aba
 * Matriz (com os riscos plotados, os modos inerente/residual/movimento e o
 * painel de célula), esta versão reduzida, e a pré-visualização do formulário.
 * Três desenhos da mesma coisa, três sítios para corrigir quando a regra muda.
 *
 * Ficou uma: quem quer VER a matriz com os riscos usa a aba Matriz, que é de
 * onde se chega aqui; quem quer MUDAR a matriz vê a pré-visualização ao vivo
 * dentro do próprio formulário, que reage a cada alteração.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { MatrizForm } from './MatrizForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconGrid } from '@/components/icons';

interface MatrizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MatrizDialog({ open, onOpenChange, onSuccess }: MatrizDialogProps) {
  const { t } = useLanguage();

  const handleSuccess = () => {
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-3xl max-h-[100dvh] sm:max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <CornerAccent position="top-left" />
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b relative">
          <DialogTitle asChild>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center text-primary shrink-0">
                <IconGrid className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs text-muted-foreground font-medium">
                  {t('fin.riscos.matrizDialog.title')}
                </span>
                <span className="text-base font-semibold text-foreground">
                  {t('fin.riscos.matrizDialog.heading')}
                </span>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pl-12 -mt-1">
            {t('fin.riscos.matrizDialog.desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <MatrizForm onSuccess={handleSuccess} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
