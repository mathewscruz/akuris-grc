/**
 * CompanySlugSettings — define o identificador público (slug) da empresa.
 * É este identificador que gera o endereço público do canal de denúncia.
 * Todas as consultas são filtradas por empresa_id (isolamento multi-tenant).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Link2, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$/;

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function CompanySlugSettings() {
  const { t } = useLanguage();
  const { empresaId, loading: loadingEmpresa } = useEmpresaId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [current, setCurrent] = useState<string>('');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!empresaId) {
      if (!loadingEmpresa) setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('nome, slug')
        .eq('id', empresaId)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        logger.error('CompanySlugSettings load', { error: error.message });
      } else if (data) {
        setNome(data.nome ?? '');
        setCurrent(data.slug ?? '');
        setValue(data.slug ?? '');
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [empresaId, loadingEmpresa]);

  const suggestion = slugify(nome);
  const invalid = value.length > 0 && !SLUG_RE.test(value);
  const changed = value !== current;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleSave = async () => {
    if (!empresaId || !value || invalid) return;
    setSaving(true);
    try {
      const { data: taken, error: checkError } = await supabase
        .from('empresas')
        .select('id')
        .ilike('slug', value)
        .neq('id', empresaId)
        .maybeSingle();
      if (checkError) throw checkError;
      if (taken) {
        toast.error(t('configGeral.slugPublico.errorTaken'));
        return;
      }

      const { error } = await supabase
        .from('empresas')
        .update({ slug: value })
        .eq('id', empresaId);
      if (error) throw error;

      setCurrent(value);
      toast.success(t('configGeral.slugPublico.saved'), {
        description: t('configGeral.slugPublico.savedDescription'),
      });
    } catch (err) {
      logger.error('CompanySlugSettings save', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error(t('configGeral.slugPublico.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingEmpresa) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <AkurisPulse />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" strokeWidth={1.5} />
          {t('configGeral.slugPublico.title')}
        </CardTitle>
        <CardDescription>{t('configGeral.slugPublico.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="empresa-slug">{t('configGeral.slugPublico.fieldLabel')}</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="empresa-slug"
              value={value}
              onChange={(e) => setValue(slugify(e.target.value))}
              placeholder={suggestion || t('configGeral.slugPublico.placeholder')}
              aria-invalid={invalid}
              className="font-mono"
            />
            {!value && suggestion && (
              <Button type="button" variant="outline" onClick={() => setValue(suggestion)}>
                {t('configGeral.slugPublico.useSuggestion')}
              </Button>
            )}
            <Button type="button" onClick={handleSave} disabled={!value || invalid || !changed || saving}>
              <Save className="h-4 w-4 mr-2" strokeWidth={1.5} />
              {t('configGeral.slugPublico.save')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('configGeral.slugPublico.rules')}</p>
          {invalid && (
            <p className="text-xs text-destructive">{t('configGeral.slugPublico.errorInvalid')}</p>
          )}
        </div>

        {value && !invalid && (
          <div className="space-y-1">
            <Label className="text-sm">{t('configGeral.slugPublico.previewLabel')}</Label>
            <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
              {origin}/{value}/denuncia
            </div>
          </div>
        )}

        {current && changed && (
          <Alert>
            <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
            <AlertDescription>{t('configGeral.slugPublico.warnChange')}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
