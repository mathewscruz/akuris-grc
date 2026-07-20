import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useAuth } from '@/components/AuthProvider';

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
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
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
        toast({ title: 'Plano atualizado com sucesso' });
      } else {
        const { error } = await supabase.from('continuidade_planos').insert(payload);
        if (error) throw error;
        toast({ title: 'Plano criado com sucesso' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar plano', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ShieldCheck}
      title={plano ? 'Editar Plano' : 'Novo Plano de Continuidade'}
      size="md"
      onSubmit={handleSubmit}
      submitLabel={plano ? 'Atualizar' : 'Criar Plano'}
      isSubmitting={loading}
    >
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do plano" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bcp">BCP - Continuidade</SelectItem>
                  <SelectItem value="drp">DRP - Recuperação</SelectItem>
                  <SelectItem value="ambos">BCP + DRP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Descrição do plano" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Escopo</Label>
              <Textarea value={form.escopo} onChange={e => setForm(p => ({ ...p, escopo: e.target.value }))} placeholder="Escopo do plano" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Objetivos</Label>
              <Textarea value={form.objetivos} onChange={e => setForm(p => ({ ...p, objetivos: e.target.value }))} placeholder="Objetivos do plano" rows={2} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="em_revisao">Em Revisão</SelectItem>
                  <SelectItem value="desativado">Desativado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>RTO (horas)</Label>
              <Input type="number" value={form.rto_horas} onChange={e => setForm(p => ({ ...p, rto_horas: e.target.value }))} placeholder="Ex: 4" />
            </div>
            <div className="space-y-2">
              <Label>RPO (horas)</Label>
              <Input type="number" value={form.rpo_horas} onChange={e => setForm(p => ({ ...p, rpo_horas: e.target.value }))} placeholder="Ex: 1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Próxima Revisão</Label>
              <Input type="date" value={form.proxima_revisao} onChange={e => setForm(p => ({ ...p, proxima_revisao: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Versão</Label>
              <Input value={form.versao} onChange={e => setForm(p => ({ ...p, versao: e.target.value }))} placeholder="1.0" />
            </div>
          </div>
        </div>
    </DialogShell>
  );
}
