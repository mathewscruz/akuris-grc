import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { ListChecks } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';

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
      toast({ title: 'Título é obrigatório', variant: 'destructive' });
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
        toast({ title: 'Tarefa atualizada' });
      } else {
        const { error } = await supabase.from('continuidade_tarefas').insert(payload);
        if (error) throw error;
        toast({ title: 'Tarefa criada' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar tarefa', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ListChecks}
      title={tarefa ? 'Editar Tarefa' : 'Nova Tarefa'}
      size="sm"
      onSubmit={handleSubmit}
      submitLabel={tarefa ? 'Atualizar' : 'Criar'}
      isSubmitting={loading}
    >
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Título da tarefa" />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={3} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => setForm(p => ({ ...p, prioridade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={form.prazo} onChange={e => setForm(p => ({ ...p, prazo: e.target.value }))} />
            </div>
          </div>
        </div>
    </DialogShell>
  );
}
