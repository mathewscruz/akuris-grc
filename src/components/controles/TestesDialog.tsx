import { DialogShell } from "@/components/ui/dialog-shell";
import { FlaskConical } from "lucide-react";
import TestesList from "./TestesList";
import { useLanguage } from "@/contexts/LanguageContext";

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
      icon={FlaskConical}
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
