import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface EmailTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailTestDialog({ open, onOpenChange }: EmailTestDialogProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendTest = async () => {
    if (!email || !email.includes("@")) {
      toast.error(t('configGeral.emailTestDialog.toastInvalidEmail'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-test-email", {
        body: { email },
      });

      if (error) throw error;

      toast.success(t('configGeral.emailTestDialog.toastSuccess'));
      onOpenChange(false);
      setEmail("");
    } catch (error: any) {
      console.error("Erro ao enviar e-mail de teste:", error);
      toast.error(error.message || t('configGeral.emailTestDialog.toastError'));
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2 w-full">
      <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
        {t('configGeral.emailTestDialog.cancelButton')}
      </Button>
      <Button size="sm" onClick={handleSendTest} disabled={loading}>
        {loading ? (
          <>
            <AkurisPulse size={16} className="mr-2" />
            {t('configGeral.emailTestDialog.sending')}
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            {t('configGeral.emailTestDialog.sendButton')}
          </>
        )}
      </Button>
    </div>
  );

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('configGeral.emailTestDialog.title')}
      description={t('configGeral.emailTestDialog.description')}
      icon={Mail}
      size="sm"
      footer={footer}
      onSubmit={handleSendTest}
      isDirty={!!email}
    >
      <div className="grid gap-2">
        <Label htmlFor="email">{t('configGeral.emailTestDialog.emailLabel')}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t('configGeral.emailTestDialog.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendTest()}
        />
      </div>
    </DialogShell>
  );
}
