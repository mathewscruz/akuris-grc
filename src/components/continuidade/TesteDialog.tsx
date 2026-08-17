import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { FlaskConical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';

interface TesteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planoId: string;
  teste?: any;
  onSuccess: () => void;
}

export function TesteDialog({ open, onOpenChange, planoId, teste, onSuccess }: TesteDialogProps) {
  const { toast } = useToast();
  const { empresaId } = useEmpresaId();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    tipo_teste: 'tabletop',
    descricao: '',
    data_teste: '',
    resultado: '',
    observacoes: '',
    licoes_aprendidas: '',
    participantes: '',
  });

  useEffect(() => {
    if (teste) {
      setForm({
        tipo_teste: teste.tipo_teste || 'tabletop',
        descricao: teste.descricao || '',
        data_teste: teste.data_teste || '',
        resultado: teste.resultado || '',
        observacoes: teste.observacoes || '',
        licoes_aprendidas: teste.licoes_aprendidas || '',
        participantes: (teste.participantes || []).join(', '),
      });
    } else {
      setForm({ tipo_teste: 'tabletop', descricao: '', data_teste: new Date().toISOString().split('T')[0], resultado: '', observacoes: '', licoes_aprendidas: '', participantes: '' });
    }
  }, [teste, open]);

  const handleSubmit = async () => {
    if (!form.data_teste) {
      toast({ title: t('modDialogs.continuidade.teste.dataObrigatoria'), variant: 'destructive' });
      return;
    }
    if (!empresaId) return;
    setLoading(true);

    const payload = {
      tipo_teste: form.tipo_teste,
      descricao: form.descricao || null,
      data_teste: form.data_teste,
      resultado: form.resultado || null,
      observacoes: form.observacoes || null,
      licoes_aprendidas: form.licoes_aprendidas || null,
      participantes: form.participantes
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      plano_id: planoId,
      empresa_id: empresaId,
      ...(teste ? {} : { created_by: user?.id }),
    };

    try {
      if (teste) {
        const { error } = await supabase.from('continuidade_testes').update(payload).eq('id', teste.id);
        if (error) throw error;
        toast({ title: t('modDialogs.continuidade.teste.toastUpdated') });
      } else {
        const { error } = await supabase.from('continuidade_testes').insert(payload);
        if (error) throw error;
        toast({ title: t('modDialogs.continuidade.teste.toastCreated') });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: t('modDialogs.continuidade.teste.toastError'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FlaskConical}
      title={teste ? t('modDialogs.continuidade.teste.titleEdit') : t('modDialogs.continuidade.teste.titleNew')}
      size="lg"
      onSubmit={handleSubmit}
      submitLabel={teste ? t('modDialogs.continuidade.teste.submitUpdate') : t('modDialogs.continuidade.teste.submitCreate')}
      isSubmitting={loading}
    >
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('modDialogs.continuidade.teste.fieldTipo')}</Label>
              <Select value={form.tipo_teste} onValueChange={v => setForm(p => ({ ...p, tipo_teste: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tabletop">{t('modDialogs.continuidade.teste.tipoTabletop')}</SelectItem>
                  <SelectItem value="simulacao">{t('modDialogs.continuidade.teste.tipoSimulacao')}</SelectItem>
                  <SelectItem value="real">{t('modDialogs.continuidade.teste.tipoReal')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('modDialogs.continuidade.teste.fieldData')}</Label>
              <DateField value={form.data_teste || null} onChange={(v) => setForm(p => ({ ...p, data_teste: v || '' }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('modDialogs.continuidade.teste.fieldDescricao')}</Label>
            <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={3} placeholder={t('modDialogs.continuidade.teste.fieldDescricaoPlaceholder')} />
          </div>

          <div className="space-y-2">
            <Label>{t('modDialogs.continuidade.teste.fieldResultado')}</Label>
            <Select value={form.resultado} onValueChange={v => setForm(p => ({ ...p, resultado: v }))}>
              <SelectTrigger><SelectValue placeholder={t('modDialogs.continuidade.teste.fieldResultadoPlaceholder')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aprovado">{t('modDialogs.continuidade.teste.resultadoAprovado')}</SelectItem>
                <SelectItem value="reprovado">{t('modDialogs.continuidade.teste.resultadoReprovado')}</SelectItem>
                <SelectItem value="parcial">{t('modDialogs.continuidade.teste.resultadoParcial')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('t4.continuidade.participantes')}</Label>
            <Input
              value={form.participantes}
              onChange={e => setForm(p => ({ ...p, participantes: e.target.value }))}
              placeholder={t('t4.continuidade.participantesPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('modDialogs.continuidade.teste.fieldObservacoes')}</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>{t('modDialogs.continuidade.teste.fieldLicoes')}</Label>
            <Textarea value={form.licoes_aprendidas} onChange={e => setForm(p => ({ ...p, licoes_aprendidas: e.target.value }))} rows={2} />
          </div>
        </div>
    </DialogShell>
  );
}
