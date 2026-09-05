import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { fetchEmpresaPublicaPorToken } from '@/lib/denuncia-publica';
import { useLanguage } from '@/contexts/LanguageContext';
import { CanalLayout } from '@/components/denuncia/CanalLayout';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Button } from '@/components/ui/button';

export default function DenunciaExternaRedirect() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [state, setState] = useState<'loading' | 'unavailable' | 'error'>('loading');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setState('loading');
    void (async () => {
      try {
        const company = token ? await fetchEmpresaPublicaPorToken(token) : null;
        if (!active) return;
        if (company?.canal_ativo) navigate(`/${company.slug}/denuncia`, { replace: true });
        else setState('unavailable');
      } catch {
        if (active) setState('error');
      }
    })();
    return () => { active = false; };
  }, [token, navigate, revision]);
  return <CanalLayout empresa={null} config={null} nomeDoCanal="Akuris">
    <section className="canal-state" aria-live="polite">
      {state === 'loading' ? <><AkurisPulse size={32} /><p>{t('publicPortal.common.redirecting')}</p></> : <>
        <h1>{t(state === 'error' ? 'canalExperience.loadingError' : 'publicPortal.denunciaForm.unavailableTitle')}</h1>
        <p>{t(state === 'error' ? 'canalExperience.loadingErrorHint' : 'publicPortal.denunciaForm.unavailableDescription')}</p>
        <div className="flex flex-wrap gap-3">{state === 'error' && <Button onClick={() => setRevision((value) => value + 1)}>{t('canalExperience.retry')}</Button>}
          <Button variant="outline" asChild><Link to="/denuncia">{t('canalExperience.findChannel')}</Link></Button>
        </div>
      </>}
    </section>
  </CanalLayout>;
}
