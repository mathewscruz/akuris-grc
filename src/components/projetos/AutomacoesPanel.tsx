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
import { useAutomacoes, useUpsertAutomacao, useDeleteAutomacao, useExecucoesAutomacao, type Automacao } from '@/hooks/useProjetoExtras';
import { useUsuariosEmpresa } from '@/hooks/useUsuariosEmpresa';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import type { ProjetoTarefa } from '@/types/projetos';
import { partirTitulo } from './projeto-visual';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import type { ProjetoColuna } from '@/types/projetos';
import { UserSelect } from '@/components/riscos/UserSelect';
import { useLanguage } from '@/contexts/LanguageContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { intlLocale } from '@/lib/date-utils';
import { toast } from '@/lib/toast';

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

export function AutomacoesPanel({ projetoId, colunas, tarefas = [] }: { projetoId: string; colunas: ProjetoColuna[]; tarefas?: ProjetoTarefa[] }) {
  const { t } = useLanguage();
  const GATILHOS = [
    { value: 'tarefa_criada', label: t('projetos.automacoes.gatilhoTarefaCriada') },
    { value: 'tarefa_movida_para_coluna', label: t('projetos.automacoes.gatilhoTarefaMovida') },
    { value: 'tarefa_concluida', label: t('projetos.automacoes.gatilhoTarefaConcluida') },
    // Emitido pela rotina diária de prazos (uma vez por atividade vencida).
    { value: 'prazo_excedido', label: t('autoMet.gatilhoPrazo') },
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
  const [historico, setHistorico] = React.useState<string | null>(null);
  const [testando, setTestando] = React.useState<Automacao | null>(null);
  const { data: usuarios = [] } = useUsuariosEmpresa();
  const nomeUser = (id?: string) => usuarios.find((u: any) => u.user_id === id)?.nome ?? '—';
  const nomeColuna = (id?: string) => colunas.find((c) => c.id === id)?.nome ?? '—';
  const frase = (a: Automacao) => {
    const g = GATILHOS.find((x) => x.value === a.gatilho)?.label ?? a.gatilho;
    const c = a.condicoes ?? {};
    const conds = [c.coluna_id && `${t('autoMet.condColuna')} ${nomeColuna(c.coluna_id)}`, c.prioridade && `${t('autoMet.condPrioridade')} ${t(`projetos.priority.${c.prioridade}`)}`, c.responsavel_id && `${t('autoMet.condResponsavel')} ${nomeUser(c.responsavel_id)}`].filter(Boolean);
    const acoes = (a.acoes ?? []).map((ac: any) => { const tp = ac.tipo === 'definir_prioridade' ? 'mudar_prioridade' : ac.tipo; const alvo = tp === 'mover_para_coluna' ? nomeColuna(ac.coluna_id) : tp === 'mudar_prioridade' ? (ac.prioridade ? t(`projetos.priority.${ac.prioridade}`) : '—') : nomeUser(ac.user_id); return `${t(ACAO_KEY[tp] ?? 'projetos.automacoes.addAction')} (${alvo})`; });
    return { g, conds, acoes };
  };

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
              {(() => { const f = frase(a); return (
                <p className="mt-3 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed">
                  <span className="font-semibold text-muted-foreground">{t('p3Projetos.automacoes.quando')}</span> {f.g.toLowerCase()}
                  {f.conds.length > 0 && <span className="text-muted-foreground"> · {f.conds.join(' · ')}</span>}
                  <span className="mx-1.5 text-primary">→</span>
                  <span className="font-medium text-primary">{f.acoes.join(' + ') || '—'}</span>
                </p>
              ); })()}
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <IconPlay className="h-3.5 w-3.5" />
                <span>{t('projetos.automacoes.executionsCount', { count: a.execucoes_count })}</span>
                {a.ultima_execucao_em && <span>· {new Date(a.ultima_execucao_em).toLocaleDateString(intlLocale())}</span>}
                <span className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setHistorico(historico === a.id ? null : a.id)} aria-expanded={historico === a.id}>{t('autoMet.historico')}</Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setTestando(a)}>{t('autoMet.testar')}</Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditando(a); setOpen(true); }} aria-label={t('common.edit')} title={t('common.edit')}><IconEdit className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" onClick={() => setRemovendo(a)} aria-label={t('common.delete')} title={t('common.delete')}><IconDelete className="h-3.5 w-3.5" /></Button>
                </span>
              </div>
              {historico === a.id && <HistoricoAutomacao automacaoId={a.id} />}
            </div>
          ))}
        </div>
      )}
      {testando && <TestarAutomacao automacao={testando} projetoId={projetoId} tarefas={tarefas} onClose={() => setTestando(null)} acaoLabel={(tp) => t(ACAO_KEY[tp === 'definir_prioridade' ? 'mudar_prioridade' : tp] ?? tp)} />}

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

  const [tentou, setTentou] = React.useState(false);
  React.useEffect(() => { if (open) setTentou(false); }, [open]);
  const acaoIncompleta = (a: any) => (a.tipo === 'mover_para_coluna' && !a.coluna_id) || ((a.tipo === 'mudar_prioridade' || a.tipo === 'definir_prioridade') && !a.prioridade) || ((a.tipo === 'atribuir_responsavel' || a.tipo === 'notificar_usuario') && !a.user_id);
  const invalido = !form.nome.trim() || form.acoes.length === 0 || form.acoes.some(acaoIncompleta);
  const submit = async () => {
    setTentou(true);
    if (invalido) { toast.error(t('autoMet.completarCampos')); return; }
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
          <div><Label htmlFor="nome">{t('projetos.automacoes.fieldNome')}</Label><Input id="nome" value={form.nome} aria-invalid={tentou && !form.nome.trim()} className={tentou && !form.nome.trim() ? 'border-destructive' : ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} />{tentou && !form.nome.trim() && <p role="alert" className="mt-1 text-xs text-destructive">{t('autoMet.nomeObrigatorio')}</p>}</div>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('autoMet.soSePrioridade')}</Label>
              <Select value={form.condicoes?.prioridade || 'qualquer'} onValueChange={(v) => setForm({ ...form, condicoes: { ...form.condicoes, prioridade: v === 'qualquer' ? '' : v } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualquer">{t('autoMet.qualquer')}</SelectItem>
                  {(['baixa', 'media', 'alta', 'critica'] as const).map((p) => <SelectItem key={p} value={p}>{t(`projetos.priority.${p}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('autoMet.soSeResponsavel')}</Label>
              <UserSelect value={form.condicoes?.responsavel_id ?? ''} onValueChange={(v) => setForm({ ...form, condicoes: { ...form.condicoes, responsavel_id: v } })} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('projetos.automacoes.fieldAcoes')}</Label>
              <Button size="sm" variant="ghost" onClick={addAcao}><IconAdd className="h-3.5 w-3.5" /> {t('projetos.automacoes.addAction')}</Button>
            </div>
            {form.acoes.map((a: any, i: number) => (
              <div key={i} className={`rounded-md border bg-card p-2 space-y-2 ${tentou && acaoIncompleta(a) ? 'border-destructive' : 'border-border'}`}>
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
                {a.tipo === 'notificar_usuario' && (
                  <Input value={a.mensagem ?? ''} onChange={(e) => setAcao(i, { mensagem: e.target.value })} placeholder={t('autoMet.mensagemPlaceholder')} aria-label={t('autoMet.mensagem')} />
                )}
                {tentou && acaoIncompleta(a) && <p role="alert" className="text-xs text-destructive">{t('autoMet.acaoIncompleta')}</p>}
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

function HistoricoAutomacao({ automacaoId }: { automacaoId: string }) {
  const { t } = useLanguage();
  const { data = [], isLoading } = useExecucoesAutomacao(automacaoId);
  if (isLoading) return <div className="mt-3 flex justify-center"><AkurisPulse size={24} /></div>;
  if (!data.length) return <p className="mt-3 text-xs text-muted-foreground">{t('autoMet.semExecucoes')}</p>;
  return (
    <ul className="mt-3 divide-y divide-border rounded-lg border text-xs">
      {data.map((e) => (
        <li key={e.id} className="flex items-center gap-2 px-3 py-2">
          <StatusBadge tone={e.resultado === 'sucesso' ? 'success' : e.resultado === 'parcial' ? 'warning' : 'destructive'}>{t(`autoMet.resultado.${e.resultado}`)}</StatusBadge>
          <span className="min-w-0 flex-1 truncate" title={e.erro ?? undefined}>{e.tarefa_titulo ? partirTitulo(e.tarefa_titulo).nome : '—'}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{new Date(e.created_at).toLocaleString(intlLocale(), { dateStyle: 'short', timeStyle: 'short' })}</span>
        </li>
      ))}
    </ul>
  );
}

function TestarAutomacao({ automacao, projetoId, tarefas, onClose, acaoLabel }: { automacao: Automacao; projetoId: string; tarefas: ProjetoTarefa[]; onClose: () => void; acaoLabel: (tipo: string) => string }) {
  const { t } = useLanguage();
  const [tarefaId, setTarefaId] = React.useState('');
  const [res, setRes] = React.useState<{ passa: boolean; acoes: string[] } | null>(null);
  const [carregando, setCarregando] = React.useState(false);
  const testar = async () => {
    if (!tarefaId) return;
    setCarregando(true); setRes(null);
    const { data } = await invokeEdgeFunction<{ previsao: { passa: boolean; acoes: string[] }[] }>('projeto-automacao-executor', {
      body: { projeto_id: projetoId, gatilho: automacao.gatilho, tarefa: { id: tarefaId }, dry_run: true, automacao_id: automacao.id },
    });
    setCarregando(false);
    if (data?.previsao?.[0]) setRes(data.previsao[0]);
  };
  return (
    <DialogShell open onOpenChange={(o) => !o && onClose()} icon={IconPlay} title={t('autoMet.testarTitulo', { nome: automacao.nome })} description={t('autoMet.testarDesc')} size="md" onSubmit={testar} submitLabel={t('autoMet.testar')} isSubmitting={carregando} submitDisabled={!tarefaId}>
      <div className="space-y-3">
        <Select value={tarefaId} onValueChange={(v) => { setTarefaId(v); setRes(null); }}>
          <SelectTrigger><SelectValue placeholder={t('autoMet.escolherAtividade')} /></SelectTrigger>
          <SelectContent>{tarefas.slice(0, 300).map((x) => <SelectItem key={x.id} value={x.id}>{partirTitulo(x.titulo).nome}</SelectItem>)}</SelectContent>
        </Select>
        {res && (
          <div className="rounded-lg border p-3 text-sm">
            {res.passa ? (
              <>
                <p className="font-medium">{t('autoMet.testarPassa')}</p>
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">{res.acoes.map((a, i) => <li key={i}>{acaoLabel(a)}</li>)}</ul>
              </>
            ) : <p className="text-muted-foreground">{t('autoMet.testarNaoPassa')}</p>}
          </div>
        )}
      </div>
    </DialogShell>
  );
}
