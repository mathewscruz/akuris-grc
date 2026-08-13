import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
        
        // Primeiro buscar configuração para obter empresa_id
        const { data: config, error: configError } = await supabase
          .from('denuncias_configuracoes_public' as any)
          .select('empresa_id')
          .eq('token_publico', token)
          .eq('ativo', true)
          .single() as { data: { empresa_id: string } | null; error: any };

        if (configError) {
          logger.error('Erro na consulta de configuração', { module: 'DenunciaExternaRedirect', error: String(configError) });
          throw configError;
        }

        if (!config) {
          logger.error('Configuração não encontrada para token', { module: 'DenunciaExternaRedirect', action: token });
          navigate('/404', { replace: true });
          return;
        }

        // Buscar dados da empresa
        const { data: empresa, error: empresaError } = await supabase
          .from('empresas')
          .select('slug, nome')
          .eq('id', config.empresa_id)
          .eq('ativo', true)
          .single();

        if (empresaError) {
          logger.error('Erro na consulta de empresa', { module: 'DenunciaExternaRedirect', error: String(empresaError) });
          throw empresaError;
        }

        if (empresa) {
          logger.debug('Empresa encontrada, redirecionando', { module: 'DenunciaExternaRedirect', action: empresa.slug });
          navigate(`/${empresa.slug}/denuncia`, { replace: true });
        } else {
          logger.error('Empresa não encontrada para ID', { module: 'DenunciaExternaRedirect', action: config.empresa_id });
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