import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { ListChecks } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useLanguage } from '@/contexts/LanguageContext';

interface TarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planoId: string;
  tarefa?: any;
  onSuccess: () => void;
}

export function TarefaDialog({ open, onOpenChange, planoId, tarefa, onSuccess }: TarefaDialogProps) {
  const { toast } = useToast();
  const { empresaId } = useEmpresaId();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'media',
    status: 'pendente',
    prazo: '',
  });

  useEffect(() => {
    if (tarefa) {
      setForm({
        titulo: tarefa.titulo || '',
        descricao: tarefa.descricao || '',
        prioridade: tarefa.prioridade || 'media',
        status: tarefa.status || 'pendente',
        prazo: tarefa.prazo || '',
      });
    } else {
      setForm({ titulo: '', descricao: '', prioridade: 'media', status: 'pendente', prazo: '' });
    }
  }, [tarefa, open]);

  const handleSubmit = async () => {
    if (!form.titulo.trim()) {
      toast({ title: t('modDialogs.continuidade.tarefa.tituloObrigatorio'), variant: 'destructive' });
      return;
    }
    if (!empresaId) return;
    setLoading(true);

    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      status: form.status,
      prazo: form.prazo || null,
      plano_id: planoId,
      empresa_id: empresaId,
    };

    try {
      if (tarefa) {
        const { error } = await supabase.from('continuidade_tarefas').update(payload).eq('id', tarefa.id);
        if (error) throw error;
        toast({ title: t('modDialogs.continuidade.tarefa.toastUpdated') });
      } else {
        const { error } = await supabase.from('continuidade_tarefas').insert(payload);
        if (error) throw error;
        toast({ title: t('modDialogs.continuidade.tarefa.toastCreated') });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: t('modDialogs.continuidade.tarefa.toastError'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ListChecks}
      title={tarefa ? t('modDialogs.continuidade.tarefa.titleEdit') : t('modDialogs.continuidade.tarefa.titleNew')}
      size="lg"
      onSubmit={handleSubmit}
      submitLabel={tarefa ? t('modDialogs.continuidade.tarefa.submitUpdate') : t('modDialogs.continuidade.tarefa.submitCreate')}
      isSubmitting={loading}
    >
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>{t('modDialogs.continuidade.tarefa.fieldTitulo')}</Label>
            <Input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder={t('modDialogs.continuidade.tarefa.fieldTituloPlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t('modDialogs.continuidade.tarefa.fieldDescricao')}</Label>
            <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('modDialogs.continuidade.tarefa.fieldPrioridade')}</Label>
              <Select value={form.prioridade} onValueChange={v => setForm(p => ({ ...p, prioridade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">{t('modDialogs.continuidade.tarefa.prioridadeBaixa')}</SelectItem>
                  <SelectItem value="media">{t('modDialogs.continuidade.tarefa.prioridadeMedia')}</SelectItem>
                  <SelectItem value="alta">{t('modDialogs.continuidade.tarefa.prioridadeAlta')}</SelectItem>
                  <SelectItem value="critica">{t('modDialogs.continuidade.tarefa.prioridadeCritica')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('modDialogs.continuidade.tarefa.fieldStatus')}</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">{t('modDialogs.continuidade.tarefa.statusPendente')}</SelectItem>
                  <SelectItem value="em_andamento">{t('modDialogs.continuidade.tarefa.statusEmAndamento')}</SelectItem>
                  <SelectItem value="concluida">{t('modDialogs.continuidade.tarefa.statusConcluida')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('modDialogs.continuidade.tarefa.fieldPrazo')}</Label>
              <DateField value={form.prazo || null} onChange={(v) => setForm(p => ({ ...p, prazo: v || '' }))} />
            </div>
          </div>
        </div>
    </DialogShell>
  );
}
