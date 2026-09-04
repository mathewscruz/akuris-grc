import React from 'react';
import { IconClose, IconCheck } from '@/components/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
;
import { useLanguage } from '@/contexts/LanguageContext';

export type ProvisioningStepState = 'pending' | 'running' | 'done' | 'error';

export interface ProvisioningStep {
  id: string;
  label: string;
  state: ProvisioningStepState;
}

interface Props {
  open: boolean;
  steps: ProvisioningStep[];
  title: string;
  description: string;
}

/**
 * EmpresaProvisioningDialog — mostra as etapas reais do provisionamento de uma
 * nova empresa (registo, licença, canal de denúncia, estrutura de dados),
 * seguindo o mesmo padrão visual do progresso do DocGen.
 */
const EmpresaProvisioningDialog: React.FC<Props> = ({ open, steps, title, description }) => {
  const { t } = useLanguage();
  const doneCount = steps.filter((s) => s.state === 'done').length;
  const percent = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const current = steps.find((s) => s.state === 'running') ?? steps.find((s) => s.state === 'error');

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <AkurisPulse size={40} />
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">{current?.label ?? title}</span>
              <span className="tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-ui duration-500"
                style={{ width: `${Math.max(4, percent)}%` }}
              />
            </div>
            <ol className="mt-3 space-y-2 text-left text-xs">
              {steps.map((step) => (
                <li key={step.id} className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center shrink-0">
                    {step.state === 'done' ? (
                      <IconCheck className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
                    ) : step.state === 'error' ? (
                      <IconClose className="h-3.5 w-3.5 text-destructive" strokeWidth={1.5} />
                    ) : step.state === 'running' ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                  </span>
                  <span
                    className={
                      step.state === 'done'
                        ? 'text-muted-foreground'
                        : step.state === 'running'
                          ? 'text-foreground font-medium'
                          : step.state === 'error'
                            ? 'text-destructive'
                            : 'text-muted-foreground/60'
                    }
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
            <p className="pt-2 text-micro text-muted-foreground">
              {t('admin.empresas.provisioning.hint')}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmpresaProvisioningDialog;
