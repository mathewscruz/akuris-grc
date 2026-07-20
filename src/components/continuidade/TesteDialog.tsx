import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { FlaskConical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useAuth } from '@/components/AuthProvider';

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
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    tipo_teste: 'tabletop',
    descricao: '',
    data_teste: '',
    resultado: '',
    observacoes: '',
    licoes_aprendidas: '',
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
      });
    } else {
      setForm({ tipo_teste: 'tabletop', descricao: '', data_teste: new Date().toISOString().split('T')[0], resultado: '', observacoes: '', licoes_aprendidas: '' });
    }
  }, [teste, open]);

  const handleSubmit = async () => {
    if (!form.data_teste) {
      toast({ title: 'Data do teste é obrigatória', variant: 'destructive' });
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
      plano_id: planoId,
      empresa_id: empresaId,
      ...(teste ? {} : { created_by: user?.id }),
    };

    try {
      if (teste) {
        const { error } = await supabase.from('continuidade_testes').update(payload).eq('id', teste.id);
        if (error) throw error;
        toast({ title: 'Teste atualizado' });
      } else {
        const { error } = await supabase.from('continuidade_testes').insert(payload);
        if (error) throw error;
        toast({ title: 'Teste registrado' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar teste', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FlaskConical}
      title={teste ? 'Editar Teste' : 'Registrar Teste'}
      size="sm"
      onSubmit={handleSubmit}
      submitLabel={teste ? 'Atualizar' : 'Registrar'}
      isSubmitting={loading}
    >
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Teste</Label>
              <Select value={form.tipo_teste} onValueChange={v => setForm(p => ({ ...p, tipo_teste: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tabletop">Tabletop</SelectItem>
                  <SelectItem value="simulacao">Simulação</SelectItem>
                  <SelectItem value="real">Teste Real</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data do Teste *</Label>
              <Input type="date" value={form.data_teste} onChange={e => setForm(p => ({ ...p, data_teste: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={3} placeholder="Descreva o cenário do teste" />
          </div>

          <div className="space-y-2">
            <Label>Resultado</Label>
            <Select value={form.resultado} onValueChange={v => setForm(p => ({ ...p, resultado: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione o resultado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="reprovado">Reprovado</SelectItem>
                <SelectItem value="parcial">Parcialmente Aprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Lições Aprendidas</Label>
            <Textarea value={form.licoes_aprendidas} onChange={e => setForm(p => ({ ...p, licoes_aprendidas: e.target.value }))} rows={2} />
          </div>
        </div>
    </DialogShell>
  );
}
