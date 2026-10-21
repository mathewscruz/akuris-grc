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
import ConfirmDialog from '@/components/ConfirmDialog';

const ACAO_KEY: Record<string, string> = {
  mover_para_coluna: 'projetos.automacoes.acaoMoverColuna',
  mudar_prioridade: 'projetos.automacoes.acaoMudarPrioridade',
  atribuir_responsavel: 'projetos.automacoes.acaoAtribuirResponsavel',
  notificar_usuario: 'projetos.automacoes.acaoNotificarUsuario',
};
const MODELOS = [
  { key: 'concluir', gatilho: 'tarefa_concluida', acao: 'notificar_usuario' },
  { key: 'criada', gatilho: 'tarefa_criada', acao: 'atribuir_responsavel' },
  { key: 'movida', gatilho: 'tarefa_movida_para_coluna', acao: 'mudar_prioridade' },
];

export function AutomacoesPanel({ projetoId, colunas }: { projetoId: string; colunas: ProjetoColuna[] }) {
  const { t } = useLanguage();
  const GATILHOS = [
    { value: 'tarefa_criada', label: t('projetos.automacoes.gatilhoTarefaCriada') },
    { value: 'tarefa_movida_para_coluna', label: t('projetos.automacoes.gatilhoTarefaMovida') },
    { value: 'tarefa_concluida', label: t('projetos.automacoes.gatilhoTarefaConcluida') },
    /*
      O vocabulario da lista tem de ser o que o executor conhece.

      Ofereciam-se aqui `prazo_vencido` e `sla_em_risco`; o executor so conhece
      `tarefa_criada | tarefa_movida_para_coluna | tarefa_concluida |
      prazo_excedido`. Metade dos gatilhos nunca casaria -- a regra ficava
      gravada, com selo «Ativa», e nao podia disparar nem em teoria.

      `prazo_excedido` fica de fora ate haver quem o emita: nao ha rotina a
      correr que repare em prazos vencidos, e po-lo na lista seria prometer
      outra vez o que nao acontece.
    */
  ];
  const { data: automacoes = [], isLoading } = useAutomacoes(projetoId);
  const upsert = useUpsertAutomacao(projetoId);
  const del = useDeleteAutomacao(projetoId);
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<Automacao | null>(null);
  const [removendo, setRemovendo] = React.useState<Automacao | null>(null);

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
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {automacoes.map((a) => (
            <div key={a.id} className={`rounded-xl border bg-card p-4 transition-colors ${a.ativa ? 'border-border' : 'border-dashed border-border opacity-70'}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.ativa ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}><IconBolt className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold">{a.nome}</h4>
                  {a.descricao && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.descricao}</p>}
                </div>
                <Switch checked={a.ativa} onCheckedChange={() => toggleAtiva(a)} aria-label={a.ativa ? t('projetos.automacoes.active') : t('projetos.automacoes.paused')} />
              </div>
              <div className="mt-3 space-y-1.5 rounded-lg bg-muted/40 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">{t('p3Projetos.automacoes.quando')}</span>
                  <span className="rounded-md bg-card px-2 py-1 font-medium">{GATILHOS.find((g) => g.value === a.gatilho)?.label ?? a.gatilho}</span>
                </div>
                {(a.acoes ?? []).map((ac, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">{i === 0 ? t('p3Projetos.automacoes.entao') : '+'}</span>
                    <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">{t(ACAO_KEY[ac.tipo] ?? 'projetos.automacoes.addAction')}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <IconPlay className="h-3.5 w-3.5" />
                <span>{t('projetos.automacoes.executionsCount', { count: a.execucoes_count })}</span>
                {a.ultima_execucao_em && <span>· {new Date(a.ultima_execucao_em).toLocaleDateString()}</span>}
                <span className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditando(a); setOpen(true); }} aria-label={t('common.edit')} title={t('common.edit')}><IconEdit className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" onClick={() => setRemovendo(a)} aria-label={t('common.delete')} title={t('common.delete')}><IconDelete className="h-3.5 w-3.5" /></Button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && automacoes.length === 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {MODELOS.map((m) => (
            <button key={m.key} type="button" onClick={() => { setEditando({ nome: t(`p3Projetos.automacoes.modelo_${m.key}`), descricao: null, gatilho: m.gatilho, condicoes: {}, acoes: [{ tipo: m.acao }], ativa: true } as unknown as Automacao); setOpen(true); }}
              className="rounded-xl border border-dashed border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('p3Projetos.automacoes.modelo')}</p>
              <p className="mt-1 text-sm font-medium">{t(`p3Projetos.automacoes.modelo_${m.key}`)}</p>
            </button>
          ))}
        </div>
      )}

      <AutomacaoDialog open={open} onOpenChange={setOpen} projetoId={projetoId} colunas={colunas} automacao={editando} gatilhos={GATILHOS} />

      <ConfirmDialog
        open={!!removendo}
        onOpenChange={(o) => !o && setRemovendo(null)}
        title={t('projetos.automacoes.removeTitle')}
        description={t('projetos.automacoes.removeConfirm')}
        variant="destructive"
        confirmText={t('projetos.automacoes.removeConfirmText')}
        loading={del.isPending}
        onConfirm={() => { if (removendo) { del.mutate(removendo.id); setRemovendo(null); } }}
      />
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
      title={automacao?.id ? t('projetos.automacoes.dialogTitleEdit') : t('projetos.automacoes.dialogTitleNew')}
      size="md"
      onSubmit={submit}
      submitLabel={t('projetos.automacoes.save')}
      isSubmitting={upsert.isPending}
    >
        <div className="space-y-3">
          <div><Label htmlFor="nome">{t('projetos.automacoes.fieldNome')}</Label><Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label htmlFor="descricao">{t('projetos.automacoes.fieldDescricao')}</Label><Textarea id="descricao" rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>

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
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => rmAcao(i)} aria-label={t('common.delete')} title={t('common.delete')}><IconDelete className="h-3.5 w-3.5" /></Button>
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
