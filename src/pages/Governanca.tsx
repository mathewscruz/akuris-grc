import { useState, useEffect } from "react";
import { AuditoriasIcon, ControlesIcon } from '@/components/icons';
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ControlesContent from "@/components/governanca/ControlesContent";
import AuditoriasContent from "@/components/governanca/AuditoriasContent";
import { useLanguage } from "@/contexts/LanguageContext";

type GovernancaTab = 'controles' | 'auditorias';

/** Cada aba é um segmento real do URL: assim a migalha de pão mostra
 *  "Governança › Controles Internos" e o H1 deixa de contradizer o breadcrumb. */
const TAB_PATH: Record<GovernancaTab, string> = {
  controles: '/governanca/controles',
  auditorias: '/governanca/auditorias',
};

export default function Governanca() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);

  // Detectar a aba inicial pelo caminho; `?tab=` fica suportado para os
  // endereços antigos que já circulam.
  const getInitialTab = (): GovernancaTab => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'auditorias') return 'auditorias';
    if (tabParam === 'controles') return 'controles';

    const path = location.pathname;
    if (path.includes('/auditorias') || location.state?.tab === 'auditorias') {
      return 'auditorias';
    }
    return 'controles';
  };

  const [activeTab, setActiveTab] = useState<GovernancaTab>(getInitialTab);

  // Atualizar aba quando a rota muda e normalizar o endereço para o caminho
  // canónico da aba (sem `?tab=` e sem `/governanca` "nu").
  useEffect(() => {
    const tab = getInitialTab();
    setActiveTab(tab);
    if (location.pathname !== TAB_PATH[tab] || searchParams.has('tab')) {
      // `tab` deixa de existir no endereço, mas `controle=`/`focus=` são
      // deep-links para um registo: têm de sobreviver à normalização.
      const resto = new URLSearchParams(searchParams);
      resto.delete('tab');
      const query = resto.toString();
      navigate(`${TAB_PATH[tab]}${query ? `?${query}` : ''}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, searchParams]);

  const handleTabChange = (value: string) => {
    const tab = value === 'auditorias' ? 'auditorias' : 'controles';
    setActiveTab(tab);
    navigate(TAB_PATH[tab], { replace: true });
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'controles': return t('modules.governanca.controlsTitle');
      case 'auditorias': return t('modules.governanca.auditsTitle');
      default: return t('modules.governanca.title');
    }
  };

  const getPageDescription = () => {
    switch (activeTab) {
      case 'controles': return t('modules.governanca.controlsDesc');
      case 'auditorias': return t('modules.governanca.auditsDesc');
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={getPageTitle()}
        description={getPageDescription()}
        actions={<div ref={setActionsSlot} className="flex items-center gap-2" />}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="max-w-md">
          <TabsTrigger value="controles" className="flex items-center gap-2">
            <ControlesIcon className="h-5 w-5" />
            {t('modules.governanca.controls')}
          </TabsTrigger>
          <TabsTrigger value="auditorias" className="flex items-center gap-2">
            <AuditoriasIcon className="h-5 w-5" />
            {t('modules.governanca.audits')}
          </TabsTrigger>
        </TabsList>

        {/* As abas visitadas ficam montadas (TabsContent usa forceMount para
            preservar estado), mas a barra de ações é portalizada para fora do
            painel escondido. Só a aba ativa recebe o slot, senão o cabeçalho
            acumula os botões das duas abas. */}
        <TabsContent value="controles">
          <ControlesContent actionsSlot={activeTab === 'controles' ? actionsSlot : null} />
        </TabsContent>

        <TabsContent value="auditorias">
          <AuditoriasContent actionsSlot={activeTab === 'auditorias' ? actionsSlot : null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
