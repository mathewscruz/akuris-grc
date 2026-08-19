import { useState, useEffect } from 'react';
import { IconSearch, IconFile, IconShield } from '@/components/icons';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { fetchEmpresaPublicaPorSlug } from '@/lib/denuncia-publica';
import { logger } from '@/lib/logger';
import { getCompanyLogo, AKURIS_DEFAULT_LOGO } from '@/lib/brand-logo';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Empresa {
  id: string;
  nome: string;
  slug: string;
  logo_url?: string;
}

export default function DenunciaMenu() {
  const { empresa: empresaSlug } = useParams();
  const { t } = useLanguage();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>(AKURIS_DEFAULT_LOGO);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEmpresaData = async () => {
      if (!empresaSlug) {
        logger.debug('Slug da empresa não fornecido', { module: 'DenunciaMenu' });
        setLoading(false);
        return;
      }

      try {
        logger.debug('Carregando dados para empresa slug', { module: 'DenunciaMenu', action: empresaSlug });
        
        const empresaData = await fetchEmpresaPublicaPorSlug(empresaSlug);

        if (!empresaData) {
          logger.error('Empresa não encontrada para slug', { module: 'DenunciaMenu', action: empresaSlug });
          setLoading(false);
          return;
        }

        logger.debug('Empresa encontrada', { module: 'DenunciaMenu' });
        setEmpresa(empresaData);

        // Usar logo_url da empresa, com fallback automático para o logo Akuris
        setLogoUrl(getCompanyLogo(empresaData.logo_url));
      } catch (error) {
        logger.error('Erro geral ao carregar configuração', { module: 'DenunciaMenu', error: String(error) });
      } finally {
        setLoading(false);
      }
    };

    loadEmpresaData();
  }, [empresaSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <div className="text-center">
          <AkurisPulse size={32} />
          <p className="mt-2 text-muted-foreground">{t('publicPortal.common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <IconShield className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('publicPortal.denunciaMenu.companyNotFound')}</h2>
            <p className="text-muted-foreground">
              {t('publicPortal.denunciaMenu.companyNotFoundDescription')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(215,35%,12%)] py-8">
      <div className="container max-w-2xl mx-auto px-4">
        {/* Header com logotipo */}
        <div className="text-center mb-8">
          {/* Logotipo da empresa */}
          <div className="mb-6">
            <img
              src={logoUrl}
              alt={`Logo ${empresa.nome}`}
              className="mx-auto h-20 w-auto object-contain"
              onError={() => setLogoUrl(AKURIS_DEFAULT_LOGO)}
            />
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            <IconShield className="w-6 h-6 text-primary" />
            <h2 className="text-xl text-sidebar-foreground">{t('publicPortal.denunciaMenu.channel')}</h2>
          </div>
        </div>

        {/* Card principal com opções */}
        <Card className="mb-8 bg-white">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-semibold mb-2">{t('publicPortal.denunciaMenu.howCanWeHelp')}</h3>
              <p className="text-muted-foreground">
                {t('publicPortal.denunciaMenu.chooseOption')}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Registrar Nova Denúncia */}
              <Link to={`/${empresaSlug}/denuncia/registrar`}>
                <Button
                  variant="outline"
                  className="w-full h-auto p-6 border-2 hover:border-primary transition-colors"
                >
                  <div className="text-center">
                    <IconFile className="w-12 h-12 mx-auto mb-3 text-primary" />
                    <h4 className="text-lg font-semibold mb-2">{t('publicPortal.denunciaMenu.registerTitle')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('publicPortal.denunciaMenu.registerDescription')}
                    </p>
                  </div>
                </Button>
              </Link>

              {/* Consultar Denúncia */}
              <Link to={`/${empresaSlug}/denuncia/consulta`}>
                <Button
                  variant="outline"
                  className="w-full h-auto p-6 border-2 hover:border-primary transition-colors"
                >
                  <div className="text-center">
                    <IconSearch className="w-12 h-12 mx-auto mb-3 text-primary" />
                    <h4 className="text-lg font-semibold mb-2">{t('publicPortal.denunciaMenu.consultTitle')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('publicPortal.denunciaMenu.consultDescription')}
                    </p>
                  </div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Informações complementares */}
        <Card className="bg-white border-primary/20">
          <CardContent className="p-6">
            <div className="text-center">
              <IconShield className="w-8 h-8 text-primary mx-auto mb-3" />
              <h4 className="font-semibold mb-2">{t('publicPortal.denunciaMenu.confidentialityTitle')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('publicPortal.denunciaMenu.confidentialityDescription')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}