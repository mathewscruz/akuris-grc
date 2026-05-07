import { useRef, useState } from 'react';
import { Shield } from 'lucide-react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { TratamentoForm, type TratamentoFormHandle } from './TratamentoForm';

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
      title={tratamento ? 'Editar Tratamento' : 'Novo Tratamento'}
      description={
        tratamento
          ? 'Atualize as informações do tratamento do risco.'
          : 'Cadastre uma nova ação para mitigar, transferir, aceitar ou evitar o risco identificado.'
      }
      icon={Shield}
      size="lg"
      isSubmitting={isSubmitting}
      isDirty={isDirty}
      submitLabel={tratamento ? 'Atualizar Tratamento' : 'Criar Tratamento'}
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
