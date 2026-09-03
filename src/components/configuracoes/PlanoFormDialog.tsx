import React, { useEffect, useState } from 'react';
import { IconAdd, IconClose, IconCard } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
;
import { MODULOS_DISPONIVEIS, type Plano } from '@/lib/planos-utils';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { exigirEscrita } from '@/lib/supabase-write';
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
  const { t } = useLanguage();
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
        preco_setup: Number((plano as any).preco_setup) || 0,
        setup_observacao: (plano as any).setup_observacao || '',
        publico_alvo: (plano as any).publico_alvo || '',
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
      toast.error(t('configPlanos.planoForm.requiredFields'));
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
        preco_setup: Number(form.preco_setup) || 0,
        setup_observacao: form.setup_observacao.trim() || null,
        publico_alvo: form.publico_alvo.trim() || null,
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
      toast.success(plano ? t('configPlanos.planoForm.savedUpdate') : t('configPlanos.planoForm.savedCreate'));
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || t('configPlanos.planoForm.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconCard}
      title={plano ? t('configPlanos.planoForm.titleEdit') : t('configPlanos.planoForm.titleNew')}
      size="lg"
      onSubmit={handleSave}
      submitLabel={t('configPlanos.planoForm.submitLabel')}
      isSubmitting={saving}
    >
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-2">
            {/* Identificação */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome">{t('configPlanos.planoForm.fieldNome')}</Label>
                <Input id="nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder={t('configPlanos.planoForm.fieldNomePlaceholder')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="codigo">{t('configPlanos.planoForm.fieldCodigo')}</Label>
                <Input id="codigo"
                  value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                  placeholder={t('configPlanos.planoForm.fieldCodigoPlaceholder')}
                  disabled={!!plano}
                  className="font-mono text-sm"
                />
                <p className="text-micro text-muted-foreground">{t('configPlanos.planoForm.fieldCodigoHelp')}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descricao">{t('configPlanos.planoForm.fieldDescricao')}</Label>
              <Textarea id="descricao" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} placeholder={t('configPlanos.planoForm.fieldDescricaoPlaceholder')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="publico_alvo">{t('configPlanos.planoForm.fieldPublicoAlvo')}</Label>
              <Input id="publico_alvo"
                value={form.publico_alvo}
                onChange={e => setForm(f => ({ ...f, publico_alvo: e.target.value }))}
                placeholder={t('configPlanos.planoForm.fieldPublicoAlvoPlaceholder')}
              />
            </div>

            {/* Preços */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="preco_mensal">{t('configPlanos.planoForm.fieldPrecoMensal')}</Label>
                <Input id="preco_mensal" type="number" min={0} step={0.01} value={form.preco_mensal} onChange={e => setForm(f => ({ ...f, preco_mensal: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preco_anual">{t('configPlanos.planoForm.fieldPrecoAnual')}</Label>
                <Input id="preco_anual" type="number" min={0} step={0.01} value={form.preco_anual} onChange={e => setForm(f => ({ ...f, preco_anual: Number(e.target.value) }))} />
              </div>
            </div>

            {/* Setup */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="preco_setup">{t('configPlanos.planoForm.fieldPrecoSetup')}</Label>
                <Input id="preco_setup" type="number" min={0} step={0.01} value={form.preco_setup} onChange={e => setForm(f => ({ ...f, preco_setup: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setup_observacao">{t('configPlanos.planoForm.fieldSetupObs')}</Label>
                <Input id="setup_observacao"
                  value={form.setup_observacao}
                  onChange={e => setForm(f => ({ ...f, setup_observacao: e.target.value }))}
                  placeholder={t('configPlanos.planoForm.fieldSetupObsPlaceholder')}
                />
              </div>
            </div>

            {/* Limites */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="creditos_franquia">{t('configPlanos.planoForm.fieldCreditosIA')}</Label>
                <Input id="creditos_franquia" type="number" min={0} value={form.creditos_franquia} onChange={e => setForm(f => ({ ...f, creditos_franquia: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="limite_usuarios">{t('configPlanos.planoForm.fieldLimiteUsuarios')}</Label>
                <Input id="limite_usuarios"
                  type="number"
                  min={0}
                  value={form.limite_usuarios}
                  onChange={e => setForm(f => ({ ...f, limite_usuarios: e.target.value }))}
                  placeholder={t('configPlanos.planoForm.fieldLimiteUsuariosPlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ordem">{t('configPlanos.planoForm.fieldOrdem')}</Label>
                <Input id="ordem" type="number" min="0" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))} />
              </div>
            </div>

            {/* Módulos */}
            <div className="space-y-2">
              <Label>{t('configPlanos.planoForm.fieldModulos')}</Label>
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
              <p className="text-micro text-muted-foreground">{t('configPlanos.planoForm.modulosSelecionados', { count: form.modulos_habilitados.length })}</p>
            </div>

            {/* Recursos */}
            <div className="space-y-2">
              <Label>{t('configPlanos.planoForm.fieldRecursos')}</Label>
              <div className="flex gap-2">
                <Input
                  value={novoRecurso}
                  onChange={e => setNovoRecurso(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecurso(); } }}
                  placeholder={t('configPlanos.planoForm.recursoPlaceholder')}
                />
                <Button type="button" variant="outline" onClick={addRecurso} aria-label={t('common.add')} title={t('common.add')}><IconAdd className="h-4 w-4" /></Button>
              </div>
              {form.recursos_destacados.length > 0 && (
                <div className="space-y-1 pt-1">
                  {form.recursos_destacados.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 rounded bg-muted text-sm">
                      <span>{r}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeRecurso(i)}>
                        <IconClose className="h-3 w-3" />
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
                {t('configPlanos.planoForm.marcarPopular')}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm(f => ({ ...f, ativo: v }))} />
                {t('configPlanos.planoForm.planoAtivo')}
              </label>
            </div>
          </div>
        </ScrollArea>
    </DialogShell>
  );
};
