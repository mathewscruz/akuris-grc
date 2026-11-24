import React, { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { ColorSwatchField } from '@/components/ui/color-swatch-field';
import { DialogShell } from '@/components/ui/dialog-shell';
import { toast } from '@/lib/toast';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserSelect } from '@/components/riscos/UserSelect';
import { useUpsertProjeto } from '@/hooks/useProjetos';
import { useAuth } from '@/components/AuthProvider';
import type { Projeto, ProjetoStatus } from '@/types/projetos';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconFolder, IconWarning } from '@/components/icons';
import { useProjetoTarefas } from '@/hooks/useProjetoTarefas';
import { indicadores } from '@/lib/projeto-acompanhamento';

/** Paleta de identificação do projeto (valor gravado; mantém-se estável entre temas). */

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projeto?: Projeto | null;
}

export function ProjetoDialog({ open, onOpenChange, projeto }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const upsert = useUpsertProjeto();
  const { data: tarefas = [] } = useProjetoTarefas(open && projeto?.id ? projeto.id : undefined);
  const ind = React.useMemo(() => indicadores(tarefas), [tarefas]);
  const [ownerInvalido, setOwnerInvalido] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    status: 'ativo' as ProjetoStatus,
    owner_id: '',
    data_inicio: '',
    data_fim_prevista: '',
    cor: '#7552FF',
    exigir_evidencia: true,
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
        exigir_evidencia: (projeto as any)?.exigir_evidencia ?? true,
      });
      setOwnerInvalido(false);
    }
  }, [open, projeto, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error(t('projetos.dialog.nomeObrigatorio')); return; }
    if (!form.owner_id) { setOwnerInvalido(true); toast.error(t('projetos.dialog.ownerObrigatorio')); return; }
    /* Um projeto que acaba antes de começar desenha-se tal e qual no
       cartão do módulo — «29/12/2026 → 29/06/2026» — e põe a barra de
       progresso a dividir por um intervalo negativo. */
    if (form.data_inicio && form.data_fim_prevista && form.data_fim_prevista < form.data_inicio) {
      toast.error(t('common.fimAntesDoInicio'));
      return;
    }
    await upsert.mutateAsync({
      id: projeto?.id,
      nome: form.nome.trim(),
      descricao: form.descricao || null,
      status: form.status,
      owner_id: form.owner_id,
      data_inicio: form.data_inicio || null,
      data_fim_prevista: form.data_fim_prevista || null,
      cor: form.cor,
      exigir_evidencia: form.exigir_evidencia,
    } as any);
    onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconFolder}
      title={projeto ? t('projetos.dialog.titleEdit') : t('projetos.dialog.titleNew')}
      description={t('layout.dialogDescription', { title: t('projetos.page.title') })}
      size="sm"
      onSubmit={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
      submitLabel={t('projetos.dialog.save')}
      isSubmitting={upsert.isPending}
    >
        <form onSubmit={handleSubmit} className="space-y-5">
          {projeto && ind.total > 0 && (
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs tabular-nums text-muted-foreground">
              {t('projetos.dialog.resumo', { total: ind.total, pct: Math.round((ind.concluidas / ind.total) * 100), atrasadas: ind.atrasadas })}
            </p>
          )}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t('projetos.dialog.secIdentificacao')}</h3>
            <div className="space-y-2">
              <Label htmlFor="nome">{t('projetos.dialog.fieldNome')}</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">{t('projetos.dialog.fieldDescricao')}</Label>
              <Textarea id="descricao" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t('projetos.dialog.fieldCor')}</Label>
              <ColorSwatchField value={form.cor} onChange={(c) => setForm({ ...form, cor: c })} aria-label={t('projetos.dialog.fieldCor')} />
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t('projetos.dialog.secResponsabilidade')}</h3>
            <div className="space-y-2">
              <Label>{t('projetos.dialog.fieldOwner')}</Label>
              <div className={ownerInvalido ? 'rounded-md ring-1 ring-destructive/60' : ''}>
                <UserSelect value={form.owner_id} onValueChange={(v) => { setOwnerInvalido(false); setForm({ ...form, owner_id: v }); }} />
              </div>
              {ownerInvalido && <p role="alert" className="text-xs text-destructive">{t('projetos.dialog.ownerObrigatorio')}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('projetos.dialog.fieldStatus')}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ProjetoStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">{t('projetos.status.ativo')}</SelectItem>
                  <SelectItem value="pausado">{t('projetos.status.pausado')}</SelectItem>
                  <SelectItem value="concluido">{t('projetos.status.concluido')}</SelectItem>
                  <SelectItem value="arquivado">{t('projetos.status.arquivado')}</SelectItem>
                </SelectContent>
              </Select>
              {form.status === 'concluido' && projeto && ind.total - ind.concluidas > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-warning"><IconWarning className="h-3.5 w-3.5" />{t('projetos.dialog.abertasAviso', { n: ind.total - ind.concluidas })}</p>
              )}
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t('projetos.dialog.secPrazos')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('projetos.dialog.fieldInicio')}</Label>
                <DateField value={form.data_inicio || null} onChange={(v) => setForm({ ...form, data_inicio: v ?? '' })} />
              </div>
              <div className="space-y-2">
                <Label>{t('projetos.dialog.fieldFimPrevisto')}</Label>
                <DateField value={form.data_fim_prevista || null} onChange={(v) => setForm({ ...form, data_fim_prevista: v ?? '' })} />
              </div>
            </div>
            <label className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <span><span className="block text-sm font-medium">{t('evidSemana.exigir')}</span><span className="block text-xs text-muted-foreground">{t('evidSemana.exigirSub')}</span></span>
              <Switch checked={form.exigir_evidencia} onCheckedChange={(v) => setForm({ ...form, exigir_evidencia: v })} />
            </label>
          </section>
        </form>
    </DialogShell>
  );
}
