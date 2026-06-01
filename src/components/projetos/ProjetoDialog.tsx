import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserSelect } from '@/components/riscos/UserSelect';
import { useUpsertProjeto } from '@/hooks/useProjetos';
import { useAuth } from '@/components/AuthProvider';
import type { Projeto, ProjetoStatus } from '@/types/projetos';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projeto?: Projeto | null;
}

export function ProjetoDialog({ open, onOpenChange, projeto }: Props) {
  const { user } = useAuth();
  const upsert = useUpsertProjeto();
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    status: 'ativo' as ProjetoStatus,
    owner_id: '',
    data_inicio: '',
    data_fim_prevista: '',
    cor: '#7552FF',
  });

  useEffect(() => {
    if (open) {
      setForm({
        nome: projeto?.nome ?? '',
        descricao: projeto?.descricao ?? '',
        status: (projeto?.status ?? 'ativo') as ProjetoStatus,
        owner_id: projeto?.owner_id ?? user?.id ?? '',
        data_inicio: projeto?.data_inicio ?? '',
        data_fim_prevista: projeto?.data_fim_prevista ?? '',
        cor: projeto?.cor ?? '#7552FF',
      });
    }
  }, [open, projeto, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.owner_id) return;
    await upsert.mutateAsync({
      id: projeto?.id,
      nome: form.nome.trim(),
      descricao: form.descricao || null,
      status: form.status,
      owner_id: form.owner_id,
      data_inicio: form.data_inicio || null,
      data_fim_prevista: form.data_fim_prevista || null,
      cor: form.cor,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{projeto ? 'Editar projeto' : 'Novo projeto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ProjetoStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-10" />
            </div>
          </div>
          <div>
            <Label>Responsável (owner) *</Label>
            <UserSelect value={form.owner_id} onValueChange={(v) => setForm({ ...form, owner_id: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Fim previsto</Label>
              <Input type="date" value={form.data_fim_prevista} onChange={(e) => setForm({ ...form, data_fim_prevista: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
