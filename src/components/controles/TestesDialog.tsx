import { DialogShell } from "@/components/ui/dialog-shell";
import TestesList from "./TestesList";
import { useLanguage } from "@/contexts/LanguageContext";
import { IconTest } from '@/components/icons';

interface TestesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controleId?: string;
  controleNome?: string;
}

export default function TestesDialog({
  open,
  onOpenChange,
  controleId,
  controleNome,
}: TestesDialogProps) {
  const { t } = useLanguage();
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconTest}
      title={t('controlesAuditorias.tdTitle')}
      description={controleNome}
      size="lg"
      hideFooter
    >
      {controleId && controleNome && (
        <TestesList controleId={controleId} controleNome={controleNome} />
      )}
    </DialogShell>
  );
}
