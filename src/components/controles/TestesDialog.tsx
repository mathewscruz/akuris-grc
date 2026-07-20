import { DialogShell } from "@/components/ui/dialog-shell";
import { FlaskConical } from "lucide-react";
import TestesList from "./TestesList";

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
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FlaskConical}
      title="Testes do Controle"
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
