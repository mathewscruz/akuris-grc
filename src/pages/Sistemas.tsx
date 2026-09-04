import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import SistemasContent from "@/components/governanca/SistemasContent";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Sistemas() {
  const { t } = useLanguage();
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.sistemas.title')}
        description={t('modules.sistemas.description')}
        actions={<div ref={setActionsSlot} className="flex items-center gap-2" />}
      />
      <SistemasContent actionsSlot={actionsSlot} />
    </div>
  );
}
