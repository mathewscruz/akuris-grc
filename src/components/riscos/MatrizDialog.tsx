import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Grid3X3 } from 'lucide-react';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { MatrizForm } from './MatrizForm';
import { MatrizVisualizacao } from './MatrizVisualizacao';

interface MatrizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MatrizDialog({ open, onOpenChange, onSuccess }: MatrizDialogProps) {
  const [tab, setTab] = useState<'visual' | 'configuracao'>('visual');

  const handleSuccess = () => {
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-5xl max-h-[100dvh] sm:max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <CornerAccent position="top-left" />
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b relative">
          <DialogTitle asChild>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <Grid3X3 className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Configuração de Riscos
                </span>
                <span className="text-base font-semibold text-foreground">
                  Matriz de Riscos
                </span>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pl-12 -mt-1">
            Visualize e configure a matriz de risco da sua organização.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'visual' | 'configuracao')}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="flex-shrink-0 px-6 pt-4 border-b">
            <TabsList className="w-full">
              <TabsTrigger value="visual" className="flex-1 gap-2">
                <Grid3X3 className="h-4 w-4" strokeWidth={1.5} />
                Matriz Visual
              </TabsTrigger>
              <TabsTrigger value="configuracao" className="flex-1 gap-2">
                <Settings className="h-4 w-4" strokeWidth={1.5} />
                Configuração
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="visual" className="flex-1 overflow-y-auto px-6 py-5 mt-0 data-[state=inactive]:hidden">
            <MatrizVisualizacao
              onNavigate={() => onOpenChange(false)}
              onConfigure={() => setTab('configuracao')}
            />
          </TabsContent>
          <TabsContent value="configuracao" className="flex-1 overflow-y-auto px-6 py-5 mt-0 data-[state=inactive]:hidden">
            <MatrizForm onSuccess={handleSuccess} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
