import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { fetchEmpresaPublicaPorToken } from '@/lib/denuncia-publica';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
export default function DenunciaExternaRedirect() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const buscarEmpresaPorToken = async () => {
      if (!token) {
        logger.debug('Token não encontrado na URL', { module: 'DenunciaExternaRedirect' });
        navigate('/404', { replace: true });
        return;
      }

      try {
        logger.debug('Buscando empresa por token', { module: 'DenunciaExternaRedirect', action: token });
        
        const empresa = await fetchEmpresaPublicaPorToken(token);

        if (empresa && empresa.canal_ativo) {
          logger.debug('Empresa encontrada, redirecionando', { module: 'DenunciaExternaRedirect', action: empresa.slug });
          navigate(`/${empresa.slug}/denuncia`, { replace: true });
        } else {
          logger.error('Canal não encontrado para token', { module: 'DenunciaExternaRedirect' });
          navigate('/404', { replace: true });
        }
      } catch (error) {
        logger.error('Erro ao buscar empresa', { module: 'DenunciaExternaRedirect', error: String(error) });
        navigate('/404', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    buscarEmpresaPorToken();
  }, [token, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <div className="text-center">
          <AkurisPulse size={32} />
          <p className="mt-2 text-muted-foreground">{t('publicPortal.common.redirecting')}</p>
        </div>
      </div>
    );
  }

  return null;
}