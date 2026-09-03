import { useState, useEffect } from 'react';
import { IconUpload, IconOrg } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
export function CompanyLogoUpload() {
  const { t } = useLanguage();
  const { user, company, refetchProfile, forceLogoUpdate } = useAuth();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  useEffect(() => {
    const fetchEmpresaId = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .single();
      if (data?.empresa_id) setEmpresaId(data.empresa_id);
    };
    fetchEmpresaId();
  }, [user]);

  useEffect(() => {
    setLogoPreview(null);
  }, [company?.logo_url]);

  const validateImageFile = (file: File): string | null => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return t('configGeral.logoUpload.errorInvalidFormat');
    }
    if (file.size > MAX_FILE_SIZE) {
      return t('configGeral.logoUpload.errorFileTooLarge');
    }
    return null;
  };

  const verifyImageLoad = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  };

  const handleCompanyLogoUpload = async (file: File) => {
    if (!empresaId) {
      toast.error(t('configGeral.logoUpload.errorNoEmpresa'));
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setUploading(true);

      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `empresa-${empresaId}-${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('empresa-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from('empresa-logos')
        .getPublicUrl(fileName);

      const logoUrlWithCacheBusting = `${urlData.publicUrl}?t=${timestamp}`;

      const isImageReady = await verifyImageLoad(logoUrlWithCacheBusting);
      if (!isImageReady) throw new Error('Falha ao verificar imagem');

      const { error: updateError } = await supabase
        .from('empresas')
        .update({ logo_url: logoUrlWithCacheBusting })
        .eq('id', empresaId)
        .select();

      if (updateError) throw new Error(`Erro ao atualizar banco: ${updateError.message}`);

      await refetchProfile();
      forceLogoUpdate();
      toast.success(t('configGeral.logoUpload.toastSuccess'));
    } catch (error: any) {
      console.error('Erro no upload do logo:', error);
      let errorMessage = t('configGeral.logoUpload.errorGeneric');
      if (error.message?.includes('upload')) errorMessage = t('configGeral.logoUpload.errorUpload');
      else if (error.message?.includes('banco')) errorMessage = t('configGeral.logoUpload.errorDatabase');
      else if (error.message?.includes('not allowed') || error.message?.includes('policy')) errorMessage = t('configGeral.logoUpload.errorPermission');
      toast.error(errorMessage);
      setLogoPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const getCurrentCompanyLogo = () => {
    if (logoPreview) return logoPreview;
    if (company?.logo_url) {
      const hasTimestamp = company.logo_url.includes('?t=');
      return hasTimestamp ? company.logo_url : `${company.logo_url}?t=${Date.now()}`;
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconOrg className="h-5 w-5" />
          {t('configGeral.logoUpload.title')}
        </CardTitle>
        <CardDescription>
          {t('configGeral.logoUpload.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            {getCurrentCompanyLogo() ? (
              <div className="relative">
                <img
                  key={`company-logo-${Date.now()}`}
                  src={getCurrentCompanyLogo()!}
                  alt={t('configGeral.logoUpload.altText')}
                  className={`h-20 w-auto max-w-[140px] object-contain border-2 border-border rounded-lg bg-background ${
                    uploading ? 'opacity-50' : ''
                  }`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <AkurisPulse size={24} className="text-primary" />
                  </div>
                )}
              </div>
            ) : (
              <div className="h-20 w-20 rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center">
                <IconOrg className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('configGeral.logoUpload.label')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('configGeral.logoUpload.hint')}
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCompanyLogoUpload(file);
                }}
                disabled={uploading}
              />
              <Button variant="outline" disabled={uploading} asChild>
                <span className="flex items-center gap-2">
                  <IconUpload className="h-4 w-4" />
                  {uploading ? t('configGeral.logoUpload.uploading') : t('configGeral.logoUpload.changeButton')}
                </span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground">
              {t('configGeral.logoUpload.formatsHint')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}