import React from 'react';
import { IconAdd, IconEdit, IconDelete, IconBolt, IconPlay } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useAutomacoes, useUpsertAutomacao, useDeleteAutomacao, type Automacao } from '@/hooks/useProjetoExtras';
import type { ProjetoColuna } from '@/types/projetos';
import { UserSelect } from '@/components/riscos/UserSelect';
import { useLanguage } from '@/contexts/LanguageContext';

export function AutomacoesPanel({ projetoId, colunas }: { projetoId: string; colunas: ProjetoColuna[] }) {
  const { t } = useLanguage();
  const GATILHOS = [
    { value: 'tarefa_criada', label: t('projetos.automacoes.gatilhoTarefaCriada') },
    { value: 'tarefa_movida_para_coluna', label: t('projetos.automacoes.gatilhoTarefaMovida') },
    { value: 'prazo_vencido', label: t('projetos.automacoes.gatilhoPrazoVencido') },
    { value: 'sla_em_risco', label: t('projetos.automacoes.gatilhoSlaRisco') },
  ];
  const { data: automacoes = [], isLoading } = useAutomacoes(projetoId);
  const upsert = useUpsertAutomacao(projetoId);
  const del = useDeleteAutomacao(projetoId);
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<Automacao | null>(null);

  const toggleAtiva = (a: Automacao) => upsert.mutate({ id: a.id, nome: a.nome, gatilho: a.gatilho, ativa: !a.ativa } as any);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2"><IconBolt className="h-4 w-4 text-primary" strokeWidth={1.5} /> {t('projetos.automacoes.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('projetos.automacoes.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => { setEditando(null); setOpen(true); }}>
          <IconAdd className="h-4 w-4" /> {t('projetos.automacoes.newAutomation')}
        </Button>
      </div>

      {isLoading ? null : automacoes.length === 0 ? (
        <EmptyState
          variant="illustrated"
          icon={<IconBolt className="h-8 w-8" />}
          title={t('projetos.automacoes.emptyTitle')}
          description={t('projetos.automacoes.emptyDesc')}
          action={{ label: t('projetos.automacoes.createFirst'), onClick: () => { setEditando(null); setOpen(true); } }}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {automacoes.map((a) => (
            <div key={a.id} className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium truncate">{a.nome}</h4>
                  {a.ativa
                    ? <StatusBadge tone="success">{t('projetos.automacoes.active')}</StatusBadge>
                    : <StatusBadge tone="neutral">{t('projetos.automacoes.paused')}</StatusBadge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {GATILHOS.find((g) => g.value === a.gatilho)?.label ?? a.gatilho}
                  {' · '}{t('projetos.automacoes.actionsCount', { count: (a.acoes ?? []).length })}
                  {' · '}{t('projetos.automacoes.executionsCount', { count: a.execucoes_count })}
                </div>
                {a.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.descricao}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Switch checked={a.ativa} onCheckedChange={() => toggleAtiva(a)} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditando(a); setOpen(true); }}>
                  <IconEdit className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm(t('projetos.automacoes.removeConfirm'))) del.mutate(a.id); }}>
                  <IconDelete className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AutomacaoDialog open={open} onOpenChange={setOpen} projetoId={projetoId} colunas={colunas} automacao={editando} gatilhos={GATILHOS} />
    </div>
  );
}

function AutomacaoDialog({ open, onOpenChange, projetoId, colunas, automacao, gatilhos }: {
  open: boolean; onOpenChange: (v: boolean) => void; projetoId: string; colunas: ProjetoColuna[]; automacao: Automacao | null; gatilhos: { value: string; label: string }[];
}) {
  const { t } = useLanguage();
  const TIPOS_ACAO = [
    { value: 'mover_para_coluna', label: t('projetos.automacoes.acaoMoverColuna') },
    { value: 'mudar_prioridade', label: t('projetos.automacoes.acaoMudarPrioridade') },
    { value: 'atribuir_responsavel', label: t('projetos.automacoes.acaoAtribuirResponsavel') },
    { value: 'notificar_usuario', label: t('projetos.automacoes.acaoNotificarUsuario') },
  ];
  const upsert = useUpsertAutomacao(projetoId);
  const [form, setForm] = React.useState<any>({
    nome: '', descricao: '', gatilho: 'tarefa_criada', condicoes: {}, acoes: [{ tipo: 'notificar_usuario' }], ativa: true,
  });
  React.useEffect(() => {
    if (open) {
      setForm({
        nome: automacao?.nome ?? '',
        descricao: automacao?.descricao ?? '',
        gatilho: automacao?.gatilho ?? 'tarefa_criada',
        condicoes: automacao?.condicoes ?? {},
        acoes: automacao?.acoes && automacao.acoes.length > 0 ? automacao.acoes : [{ tipo: 'notificar_usuario' }],
        ativa: automacao?.ativa ?? true,
      });
    }
  }, [open, automacao]);

  const setAcao = (i: number, patch: any) => setForm({ ...form, acoes: form.acoes.map((a: any, idx: number) => idx === i ? { ...a, ...patch } : a) });
  const addAcao = () => setForm({ ...form, acoes: [...form.acoes, { tipo: 'notificar_usuario' }] });
  const rmAcao = (i: number) => setForm({ ...form, acoes: form.acoes.filter((_: any, idx: number) => idx !== i) });

  const submit = async () => {
    if (!form.nome.trim()) return;
    await upsert.mutateAsync({ id: automacao?.id, ...form });
    onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconBolt}
      title={automacao ? t('projetos.automacoes.dialogTitleEdit') : t('projetos.automacoes.dialogTitleNew')}
      size="md"
      onSubmit={submit}
      submitLabel={t('projetos.automacoes.save')}
      isSubmitting={upsert.isPending}
    >
        <div className="space-y-3">
          <div><Label>{t('projetos.automacoes.fieldNome')}</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>{t('projetos.automacoes.fieldDescricao')}</Label><Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>

          <div className="space-y-2">
            <Label>{t('projetos.automacoes.fieldGatilho')}</Label>
            <Select value={form.gatilho} onValueChange={(v) => setForm({ ...form, gatilho: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{gatilhos.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {form.gatilho === 'tarefa_movida_para_coluna' && (
            <div className="space-y-2">
              <Label>{t('projetos.automacoes.fieldColunaAlvo')}</Label>
              <Select value={form.condicoes?.coluna_id ?? ''} onValueChange={(v) => setForm({ ...form, condicoes: { ...form.condicoes, coluna_id: v } })}>
                <SelectTrigger><SelectValue placeholder={t('projetos.automacoes.placeholderQualquerColuna')} /></SelectTrigger>
                <SelectContent>{colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('projetos.automacoes.fieldAcoes')}</Label>
              <Button size="sm" variant="ghost" onClick={addAcao}><IconAdd className="h-3.5 w-3.5" /> {t('projetos.automacoes.addAction')}</Button>
            </div>
            {form.acoes.map((a: any, i: number) => (
              <div key={i} className="rounded-md border border-border bg-card p-2 space-y-2">
                <div className="flex gap-2">
                  <Select value={a.tipo} onValueChange={(v) => setAcao(i, { tipo: v })}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS_ACAO.map((tp) => <SelectItem key={tp.value} value={tp.value}>{tp.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => rmAcao(i)}><IconDelete className="h-3.5 w-3.5" /></Button>
                </div>
                {a.tipo === 'mover_para_coluna' && (
                  <Select value={a.coluna_id ?? ''} onValueChange={(v) => setAcao(i, { coluna_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t('projetos.automacoes.placeholderSelecioneColuna')} /></SelectTrigger>
                    <SelectContent>{colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {a.tipo === 'mudar_prioridade' && (
                  <Select value={a.prioridade ?? ''} onValueChange={(v) => setAcao(i, { prioridade: v })}>
                    <SelectTrigger><SelectValue placeholder={t('projetos.automacoes.placeholderPrioridade')} /></SelectTrigger>
                    <SelectContent>
                      {(['baixa', 'media', 'alta', 'critica'] as const).map((p) => <SelectItem key={p} value={p}>{t(`projetos.priority.${p}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {(a.tipo === 'atribuir_responsavel' || a.tipo === 'notificar_usuario') && (
                  <UserSelect value={a.user_id ?? ''} onValueChange={(v) => setAcao(i, { user_id: v })} />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Label>{t('projetos.automacoes.fieldAtiva')}</Label>
            <Switch checked={form.ativa} onCheckedChange={(v) => setForm({ ...form, ativa: v })} />
          </div>
        </div>

    </DialogShell>
  );
}
