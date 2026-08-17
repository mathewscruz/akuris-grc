import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { ShieldCheck } from 'lucide-react';
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

interface PlanoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano?: any;
  onSuccess: () => void;
}

export function PlanoDialog({ open, onOpenChange, plano, onSuccess }: PlanoDialogProps) {
  const { toast } = useToast();
  const { empresaId } = useEmpresaId();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const [form, setForm] = useState({
    nome: '',
    tipo: 'bcp',
    descricao: '',
    escopo: '',
    objetivos: '',
    status: 'rascunho',
    rto_horas: '',
    rpo_horas: '',
    proxima_revisao: '',
    versao: '1.0',
  });

  useEffect(() => {
    if (plano) {
      setForm({
        nome: plano.nome || '',
        tipo: plano.tipo || 'bcp',
        descricao: plano.descricao || '',
        escopo: plano.escopo || '',
        objetivos: plano.objetivos || '',
        status: plano.status || 'rascunho',
        rto_horas: plano.rto_horas?.toString() || '',
        rpo_horas: plano.rpo_horas?.toString() || '',
        proxima_revisao: plano.proxima_revisao || '',
        versao: plano.versao || '1.0',
      });
    } else {
      setForm({ nome: '', tipo: 'bcp', descricao: '', escopo: '', objetivos: '', status: 'rascunho', rto_horas: '', rpo_horas: '', proxima_revisao: '', versao: '1.0' });
    }
  }, [plano, open]);

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      toast({ title: t('continuidadeComp.planoDialog.toastNomeRequired'), variant: 'destructive' });
      return;
    }
    if (!empresaId) return;
    setLoading(true);

    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      descricao: form.descricao || null,
      escopo: form.escopo || null,
      objetivos: form.objetivos || null,
      status: form.status,
      rto_horas: form.rto_horas ? parseInt(form.rto_horas) : null,
      rpo_horas: form.rpo_horas ? parseInt(form.rpo_horas) : null,
      proxima_revisao: form.proxima_revisao || null,
      versao: form.versao || '1.0',
      empresa_id: empresaId,
      ...(plano ? {} : { created_by: user?.id }),
    };

    try {
      if (plano) {
        const { error } = await supabase.from('continuidade_planos').update(payload).eq('id', plano.id);
        if (error) throw error;
        toast({ title: t('continuidadeComp.planoDialog.toastUpdated') });
      } else {
        const { error } = await supabase.from('continuidade_planos').insert(payload);
        if (error) throw error;
        toast({ title: t('continuidadeComp.planoDialog.toastCreated') });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: t('continuidadeComp.planoDialog.toastError'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ShieldCheck}
      title={plano ? t('continuidadeComp.planoDialog.titleEdit') : t('continuidadeComp.planoDialog.titleNew')}
      size="lg"
      onSubmit={handleSubmit}
      submitLabel={plano ? t('continuidadeComp.planoDialog.submitUpdate') : t('continuidadeComp.planoDialog.submitCreate')}
      isSubmitting={loading}
    >
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('continuidadeComp.planoDialog.fieldNome')}</Label>
              <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder={t('continuidadeComp.planoDialog.fieldNomePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('continuidadeComp.planoDialog.fieldTipo')}</Label>
              <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bcp">{t('continuidadeComp.planoDialog.tipoBcp')}</SelectItem>
                  <SelectItem value="drp">{t('continuidadeComp.planoDialog.tipoDrp')}</SelectItem>
                  <SelectItem value="ambos">{t('continuidadeComp.planoDialog.tipoAmbos')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('continuidadeComp.planoDialog.fieldDescricao')}</Label>
            <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder={t('continuidadeComp.planoDialog.fieldDescricaoPlaceholder')} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('continuidadeComp.planoDialog.fieldEscopo')}</Label>
              <Textarea value={form.escopo} onChange={e => setForm(p => ({ ...p, escopo: e.target.value }))} placeholder={t('continuidadeComp.planoDialog.fieldEscopoPlaceholder')} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>{t('continuidadeComp.planoDialog.fieldObjetivos')}</Label>
              <Textarea value={form.objetivos} onChange={e => setForm(p => ({ ...p, objetivos: e.target.value }))} placeholder={t('continuidadeComp.planoDialog.fieldObjetivosPlaceholder')} rows={2} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('continuidadeComp.planoDialog.fieldStatus')}</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">{t('continuidadeComp.status.rascunho')}</SelectItem>
                  <SelectItem value="ativo">{t('continuidadeComp.status.ativo')}</SelectItem>
                  <SelectItem value="em_revisao">{t('continuidadeComp.status.em_revisao')}</SelectItem>
                  <SelectItem value="desativado">{t('continuidadeComp.status.desativado')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('continuidadeComp.planoDialog.fieldRto')}</Label>
              <Input type="number" value={form.rto_horas} onChange={e => setForm(p => ({ ...p, rto_horas: e.target.value }))} placeholder={t('continuidadeComp.planoDialog.fieldRtoPlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('continuidadeComp.planoDialog.fieldRpo')}</Label>
              <Input type="number" value={form.rpo_horas} onChange={e => setForm(p => ({ ...p, rpo_horas: e.target.value }))} placeholder={t('continuidadeComp.planoDialog.fieldRpoPlaceholder')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('continuidadeComp.planoDialog.fieldProximaRevisao')}</Label>
              <DateField value={form.proxima_revisao || null} onChange={(v) => setForm(p => ({ ...p, proxima_revisao: v || '' }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('continuidadeComp.planoDialog.fieldVersao')}</Label>
              <Input value={form.versao} onChange={e => setForm(p => ({ ...p, versao: e.target.value }))} placeholder={t('continuidadeComp.planoDialog.fieldVersao')} />
            </div>
          </div>
        </div>
    </DialogShell>
  );
}
