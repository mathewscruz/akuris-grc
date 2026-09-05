import { Link } from 'react-router-dom';
import { Unplug } from 'lucide-react';
import { CanalLayout } from './CanalLayout';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { useCanalDenuncia } from '@/hooks/useCanalDenuncia';

export function CanalState({ canal }: { canal: ReturnType<typeof useCanalDenuncia> }) {
  const { t } = useLanguage();
  return <CanalLayout empresa={canal.empresa} config={null} nomeDoCanal={canal.nomeDoCanal} estiloDaMarca={canal.estiloDaMarca}>
    <div className="canal-state" role="status">
      {canal.carregando ? <><AkurisPulse size={32} /><p>{t('publicPortal.common.loading')}</p></> : <>
        <Unplug size={30} aria-hidden="true" />
        <h1>{t(canal.falhou ? 'canalExperience.loadingError' : !canal.empresa ? 'publicPortal.denunciaMenu.companyNotFound' : 'publicPortal.denunciaMenu.unavailableTitle')}</h1>
        <p>{t(canal.falhou ? 'canalExperience.loadingErrorHint' : !canal.empresa ? 'publicPortal.denunciaMenu.companyNotFoundDescription' : 'publicPortal.denunciaMenu.unavailableDescription')}</p>
        <div className="flex flex-wrap gap-4"><Button onClick={canal.recarregar}>{t('canalExperience.retry')}</Button><Button variant="outline" asChild><Link to="/denuncia">{t('canalExperience.findChannel')}</Link></Button></div>
      </>}
    </div>
  </CanalLayout>;
}
