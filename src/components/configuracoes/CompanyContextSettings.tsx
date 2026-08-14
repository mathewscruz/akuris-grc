import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { MOEDAS, SIMBOLO_MOEDA, type MoedaCodigo } from '@/hooks/useEmpresaMoeda';
import { useQueryClient } from '@tanstack/react-query';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
const SETOR_OPTIONS: { value: string; key: string }[] = [
  { value: 'Financeiro / Bancário', key: 'financeiro' },
  { value: 'Saúde', key: 'saude' },
  { value: 'Tecnologia', key: 'tecnologia' },
  { value: 'Varejo / E-commerce', key: 'varejo' },
  { value: 'Indústria / Manufatura', key: 'industria' },
  { value: 'Educação', key: 'educacao' },
  { value: 'Governo / Setor Público', key: 'governo' },
  { value: 'Telecomunicações', key: 'telecom' },
  { value: 'Energia / Utilities', key: 'energia' },
  { value: 'Logística / Transporte', key: 'logistica' },
  { value: 'Agronegócio', key: 'agronegocio' },
  { value: 'Jurídico / Advocacia', key: 'juridico' },
  { value: 'Seguros', key: 'seguros' },
  { value: 'Outro', key: 'outro' },
];

const PORTE_KEYS = ['micro', 'pequena', 'media', 'grande', 'enterprise'] as const;

export function CompanyContextSettings() {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [setor, setSetor] = useState('');
  const [porte, setPorte] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [dataAlvo, setDataAlvo] = useState('');
  const [moeda, setMoeda] = useState<MoedaCodigo>('EUR');

  useEffect(() => {
    if (!empresaId) return;
    const load = async () => {
      setFetching(true);
      const { data } = await supabase
        .from('empresas')
        .select('setor_atuacao, porte_empresa, objetivo_compliance, data_alvo_certificacao, moeda')
        .eq('id', empresaId)
        .single();
      if (data) {
        setSetor((data as any).setor_atuacao || '');
        setPorte((data as any).porte_empresa || '');
        setObjetivo((data as any).objetivo_compliance || '');
        setDataAlvo((data as any).data_alvo_certificacao || '');
        setMoeda(((data as any).moeda as MoedaCodigo) || 'EUR');
      }
      setFetching(false);
    };
    load();
  }, [empresaId]);

  const handleSave = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          setor_atuacao: setor || null,
          porte_empresa: porte || null,
          objetivo_compliance: objetivo || null,
          data_alvo_certificacao: dataAlvo || null,
          moeda,
        } as any)
        .eq('id', empresaId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['empresa-moeda'] });
      toast.success(t('configGeral.companyContext.toastSaved'));
    } catch {
      toast.error(t('configGeral.companyContext.toastError'));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-8">
        <AkurisPulse size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold text-base">{t('configGeral.companyContext.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('configGeral.companyContext.description')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('configGeral.companyContext.labelSetor')}</Label>
          <Select value={setor} onValueChange={setSetor}>
            <SelectTrigger>
              <SelectValue placeholder={t('configGeral.companyContext.placeholderSetor')} />
            </SelectTrigger>
            <SelectContent>
              {SETOR_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{t(`configGeral.companyContext.setores.${opt.key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('configGeral.companyContext.labelPorte')}</Label>
          <Select value={porte} onValueChange={setPorte}>
            <SelectTrigger>
              <SelectValue placeholder={t('configGeral.companyContext.placeholderPorte')} />
            </SelectTrigger>
            <SelectContent>
              {PORTE_KEYS.map(key => (
                <SelectItem key={key} value={key}>{t(`configGeral.companyContext.portes.${key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('configGeral.companyContext.labelMoeda')}</Label>
          <Select value={moeda} onValueChange={(v) => setMoeda(v as MoedaCodigo)}>
            <SelectTrigger>
              <SelectValue placeholder={t('configGeral.companyContext.placeholderMoeda')} />
            </SelectTrigger>
            <SelectContent>
              {MOEDAS.map(code => (
                <SelectItem key={code} value={code}>{`${code} (${SIMBOLO_MOEDA[code]})`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t('configGeral.companyContext.descricaoMoeda')}</p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>{t('configGeral.companyContext.labelObjetivo')}</Label>
          <Textarea
            placeholder={t('configGeral.companyContext.placeholderObjetivo')}
            value={objetivo}
            onChange={e => setObjetivo(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('configGeral.companyContext.labelDataAlvo')}</Label>
          <Input
            type="date"
            value={dataAlvo}
            onChange={e => setDataAlvo(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? t('configGeral.companyContext.saving') : t('configGeral.companyContext.saveButton')}
        </Button>
      </div>
    </div>
  );
}
