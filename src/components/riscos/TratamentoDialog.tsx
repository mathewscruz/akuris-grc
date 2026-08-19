import { useRef, useState } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { TratamentoForm, type TratamentoFormHandle } from './TratamentoForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconShield } from '@/components/icons';

interface TratamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riscoId: string;
  tratamento?: any;
  onSuccess: () => void;
  riscoData?: {
    nome: string;
    descricao: string;
    categoria?: string;
    nivel_risco_inicial?: string;
  };
}

export function TratamentoDialog({
  open,
  onOpenChange,
  riscoId,
  tratamento,
  onSuccess,
  riscoData,
}: TratamentoDialogProps) {
  const { t } = useLanguage();
  const formRef = useRef<TratamentoFormHandle>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const handleSuccess = () => {
    onSuccess();
    onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={tratamento ? t('riscosDetalhe.tratamentoDialog.titleEdit') : t('riscosDetalhe.tratamentoDialog.titleNew')}
      description={
        tratamento
          ? t('riscosDetalhe.tratamentoDialog.descEdit')
          : t('riscosDetalhe.tratamentoDialog.descNew')
      }
      icon={IconShield}
      size="lg"
      isSubmitting={isSubmitting}
      isDirty={isDirty}
      submitLabel={tratamento ? t('riscosDetalhe.tratamentoDialog.submitEdit') : t('riscosDetalhe.tratamentoDialog.submitNew')}
      onSubmit={() => formRef.current?.submit()}
    >
      <TratamentoForm
        ref={formRef}
        riscoId={riscoId}
        tratamento={tratamento}
        riscoData={riscoData}
        onSuccess={handleSuccess}
        onSubmittingChange={setIsSubmitting}
        onDirtyChange={setIsDirty}
      />
    </DialogShell>
  );
}
