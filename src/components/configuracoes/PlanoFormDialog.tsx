import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { MODULOS_DISPONIVEIS, type Plano } from '@/lib/planos-utils';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plano: Plano | null;
  onSaved: () => void;
}

const initialForm = {
  codigo: '',
  nome: '',
  descricao: '',
  preco_mensal: 0,
  preco_anual: 0,
  preco_setup: 0,
  setup_observacao: '',
  publico_alvo: '',
  creditos_franquia: 10,
  limite_usuarios: '' as string | number,
  modulos_habilitados: [] as string[],
  recursos_destacados: [] as string[],
  is_destaque: false,
  ordem: 0,
  ativo: true,
};

export const PlanoFormDialog: React.FC<Props> = ({ open, onOpenChange, plano, onSaved }) => {
  const [form, setForm] = useState(initialForm);
  const [novoRecurso, setNovoRecurso] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plano) {
      setForm({
        codigo: plano.codigo || '',
        nome: plano.nome || '',
        descricao: plano.descricao || '',
        preco_mensal: Number(plano.preco_mensal) || 0,
        preco_anual: Number(plano.preco_anual) || 0,
        creditos_franquia: plano.creditos_franquia || 0,
        limite_usuarios: plano.limite_usuarios ?? '',
        modulos_habilitados: plano.modulos_habilitados || [],
        recursos_destacados: plano.recursos_destacados || [],
        is_destaque: plano.is_destaque || false,
        ordem: plano.ordem || 0,
        ativo: plano.ativo,
      });
    } else {
      setForm(initialForm);
    }
    setNovoRecurso('');
  }, [plano, open]);

  const toggleModulo = (key: string) => {
    setForm(f => ({
      ...f,
      modulos_habilitados: f.modulos_habilitados.includes(key)
        ? f.modulos_habilitados.filter(m => m !== key)
        : [...f.modulos_habilitados, key],
    }));
  };

  const addRecurso = () => {
    const v = novoRecurso.trim();
    if (!v) return;
    setForm(f => ({ ...f, recursos_destacados: [...f.recursos_destacados, v] }));
    setNovoRecurso('');
  };

  const removeRecurso = (i: number) => {
    setForm(f => ({ ...f, recursos_destacados: f.recursos_destacados.filter((_, idx) => idx !== i) }));
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.codigo.trim()) {
      toast.error('Nome e código são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        codigo: form.codigo.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        preco_mensal: Number(form.preco_mensal) || 0,
        preco_anual: Number(form.preco_anual) || 0,
        creditos_franquia: Number(form.creditos_franquia) || 0,
        limite_usuarios: form.limite_usuarios === '' ? null : Number(form.limite_usuarios),
        modulos_habilitados: form.modulos_habilitados,
        recursos_destacados: form.recursos_destacados,
        is_destaque: form.is_destaque,
        ordem: Number(form.ordem) || 0,
        ativo: form.ativo,
      };

      const { error } = plano
        ? await supabase.from('planos').update(payload).eq('id', plano.id)
        : await supabase.from('planos').insert(payload);

      if (error) throw error;
      toast.success(plano ? 'Plano atualizado' : 'Plano criado');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar plano');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{plano ? 'Editar plano' : 'Novo plano'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-2">
            {/* Identificação */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: GRC Manager" />
              </div>
              <div className="space-y-1.5">
                <Label>Código *</Label>
                <Input
                  value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                  placeholder="ex: grc_manager"
                  disabled={!!plano}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Identificador único, não pode ser alterado depois</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} placeholder="Para empresas em crescimento" />
            </div>

            {/* Preços */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Preço mensal (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.preco_mensal} onChange={e => setForm(f => ({ ...f, preco_mensal: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Preço anual total (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.preco_anual} onChange={e => setForm(f => ({ ...f, preco_anual: Number(e.target.value) }))} />
              </div>
            </div>

            {/* Limites */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Créditos IA/mês</Label>
                <Input type="number" min={0} value={form.creditos_franquia} onChange={e => setForm(f => ({ ...f, creditos_franquia: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Limite usuários</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.limite_usuarios}
                  onChange={e => setForm(f => ({ ...f, limite_usuarios: e.target.value }))}
                  placeholder="Vazio = ilimitado"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ordem de exibição</Label>
                <Input type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))} />
              </div>
            </div>

            {/* Módulos */}
            <div className="space-y-2">
              <Label>Módulos liberados</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-md max-h-60 overflow-y-auto">
                {MODULOS_DISPONIVEIS.map(mod => (
                  <label key={mod.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.modulos_habilitados.includes(mod.key)}
                      onCheckedChange={() => toggleModulo(mod.key)}
                    />
                    {mod.label}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{form.modulos_habilitados.length} módulo(s) selecionado(s)</p>
            </div>

            {/* Recursos */}
            <div className="space-y-2">
              <Label>Recursos destacados (bullets exibidos no card)</Label>
              <div className="flex gap-2">
                <Input
                  value={novoRecurso}
                  onChange={e => setNovoRecurso(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecurso(); } }}
                  placeholder="Ex: Suporte prioritário 24h"
                />
                <Button type="button" variant="outline" onClick={addRecurso}><Plus className="h-4 w-4" /></Button>
              </div>
              {form.recursos_destacados.length > 0 && (
                <div className="space-y-1 pt-1">
                  {form.recursos_destacados.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 rounded bg-muted text-sm">
                      <span>{r}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeRecurso(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Flags */}
            <div className="flex flex-col sm:flex-row gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={form.is_destaque} onCheckedChange={(v) => setForm(f => ({ ...f, is_destaque: v }))} />
                Marcar como "Mais popular"
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm(f => ({ ...f, ativo: v }))} />
                Plano ativo
              </label>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <AkurisPulse size={16} className="mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
