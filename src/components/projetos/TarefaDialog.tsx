import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { intlLocale, parseDataLocal } from '@/lib/date-utils';
import { TAG_MARCO } from '@/lib/projeto-acompanhamento';
import { undoableAction } from '@/lib/undoable-action';
import { IconAdd, IconDelete, IconSend, IconChecklist, IconPerson, IconFlag, IconCalendar, IconTime, IconTrendUp, IconTag, IconSuccess, IconChevron, IconLink } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { UserSelect } from '@/components/riscos/UserSelect';
import {
  useUpsertTarefa,
  useDeleteTarefa,
  useTarefaComentarios,
  useAddComentario,
  useTarefaChecklist,
  useChecklistMutations,
  useTarefaVinculos,
} from '@/hooks/useProjetoTarefas';
import { useUsuariosEmpresa } from '@/hooks/useUsuariosEmpresa';
import { VinculosGRCPanel } from './VinculosGRCPanel';
import { TempoPanel } from './TempoPanel';
import { ReacoesPorComentario } from './ReacoesBar';
import { StatusPill, statusKindDe } from './StatusPill';
import { useReacoes, useSprints } from '@/hooks/useProjetoExtras';
import type { ProjetoTarefa, ProjetoTarefaPrioridade, ProjetoColuna } from '@/types/projetos';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projetoId: string;
  colunas: ProjetoColuna[];
  tarefa?: ProjetoTarefa | null;
  defaultColunaId?: string | null;
  /** Todas as tarefas do projeto: alimenta o caminho (fase / domínio) e as subtarefas. */
  tarefas?: ProjetoTarefa[];
  projetoNome?: string;
  onOpenTarefa?: (t: ProjetoTarefa) => void;
  defaultParentId?: string | null;
}

export function TarefaDialog({ open, onOpenChange, projetoId, colunas, tarefa, defaultColunaId, tarefas = [], projetoNome, onOpenTarefa, defaultParentId }: Props) {
  const { t } = useLanguage();
  const upsert = useUpsertTarefa();
  const remove = useDeleteTarefa(projetoId);
  const { data: sprints = [] } = useSprints(projetoId);
  const { data: checklist = [] } = useTarefaChecklist(tarefa?.id ?? '');
  const { data: coms = [] } = useTarefaComentarios(tarefa?.id ?? '');
  const { data: vinculos = [] } = useTarefaVinculos(tarefa?.id ?? '');
  const { data: usuarios = [] } = useUsuariosEmpresa();
  const nomeUsuario = (id: string | null) => usuarios.find((u) => u.user_id === id)?.nome ?? null;
  const fotoUsuario = (id: string | null) => (usuarios.find((u) => u.user_id === id) as { foto_url?: string | null } | undefined)?.foto_url ?? null;
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [novaSub, setNovaSub] = useState('');
  const [novaTag, setNovaTag] = useState('');
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'media' as ProjetoTarefaPrioridade,
    coluna_id: '',
    responsavel_id: '',
    data_inicio: '',
    prazo: '',
    estimativa_horas: '',
    sprint_id: '',
    progresso_pct: 0,
    tags: [] as string[],
  });

  useEffect(() => {
    if (open) {
      setForm({
        titulo: tarefa?.titulo ?? '',
        descricao: tarefa?.descricao ?? '',
        prioridade: (tarefa?.prioridade ?? 'media') as ProjetoTarefaPrioridade,
        coluna_id: tarefa?.coluna_id ?? defaultColunaId ?? colunas[0]?.id ?? '',
        responsavel_id: tarefa?.responsavel_id ?? '',
        data_inicio: tarefa?.data_inicio ? tarefa.data_inicio.slice(0, 10) : '',
        prazo: (tarefa?.data_fim ?? tarefa?.prazo)?.slice(0, 10) ?? '',
        estimativa_horas: tarefa?.estimativa_horas ? String(tarefa.estimativa_horas) : '',
        sprint_id: tarefa?.sprint_id ?? '',
        progresso_pct: tarefa?.progresso_pct ?? 0,
        tags: tarefa?.tags ?? [],
      });
      setNovaSub('');
      setNovaTag('');
    }
  }, [open, tarefa, defaultColunaId, colunas]);

  const caminho = React.useMemo(() => {
    const porId = new Map(tarefas.map((x) => [x.id, x]));
    const out: ProjetoTarefa[] = [];
    let pid = tarefa?.parent_task_id ?? defaultParentId ?? null;
    while (pid && porId.has(pid) && out.length < 6) { const p = porId.get(pid)!; out.unshift(p); pid = p.parent_task_id; }
    return out;
  }, [tarefas, tarefa, defaultParentId]);
  const subtarefas = React.useMemo(() => (tarefa ? tarefas.filter((x) => x.parent_task_id === tarefa.id).sort((a, b) => a.ordem - b.ordem) : []), [tarefas, tarefa]);
  const colunaConcluida = colunas.find((c) => c.is_concluido);
  const colunaAberta = colunas.find((c) => !c.is_concluido);
  const subFeitas = subtarefas.filter((x) => x.concluida_em).length;
  const colAtual = colunas.find((c) => c.id === form.coluna_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    const concluida = colAtual?.is_concluido;
    await upsert.mutateAsync({
      id: tarefa?.id,
      projeto_id: projetoId,
      coluna_id: form.coluna_id || null,
      parent_task_id: tarefa ? tarefa.parent_task_id : defaultParentId ?? null,
      titulo: form.titulo.trim(),
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      responsavel_id: form.responsavel_id || null,
      data_inicio: form.data_inicio || null,
      data_fim: form.prazo || null,
      prazo: form.prazo || null,
      estimativa_horas: form.estimativa_horas ? Number(form.estimativa_horas) : null,
      sprint_id: form.sprint_id || null,
      progresso_pct: concluida ? 100 : form.progresso_pct,
      tags: form.tags,
      concluida_em: concluida ? (tarefa?.concluida_em ?? new Date().toISOString()) : null,
    } as any);
    onOpenChange(false);
  };

  const criarSub = async () => {
    if (!tarefa || !novaSub.trim()) return;
    await upsert.mutateAsync({
      projeto_id: projetoId, parent_task_id: tarefa.id, titulo: novaSub.trim(),
      coluna_id: colunaAberta?.id ?? null, prioridade: 'media', responsavel_id: tarefa.responsavel_id, ordem: subtarefas.length,
    } as any);
    setNovaSub('');
  };
  const alternarSub = (s: ProjetoTarefa, feito: boolean) => {
    upsert.mutate({
      id: s.id, projeto_id: projetoId,
      coluna_id: (feito ? colunaConcluida?.id : colunaAberta?.id) ?? s.coluna_id,
      concluida_em: feito ? new Date().toISOString() : null,
      progresso_pct: feito ? 100 : s.progresso_pct === 100 ? 0 : s.progresso_pct,
    } as any);
  };
  const addTag = () => {
    const v = novaTag.trim();
    if (v && !form.tags.includes(v)) setForm({ ...form, tags: [...form.tags, v] });
    setNovaTag('');
  };

  const kind = statusKindDe(colAtual);
  const codigoDe = (titulo: string) => titulo.match(/^([A-Z]{1,3}\d+(?:\.\d+)*)\s+—\s+(.*)$/);
  const nomeCurto = (titulo: string) => (codigoDe(titulo)?.[2] ?? titulo).replace(/^(FASE|DOMÍNIO|DOMINIO)\s+\d+\s+—\s+/i, '');
  const ghost = 'h-9 w-full justify-between border-transparent bg-transparent px-2 shadow-none hover:bg-muted focus:ring-0 data-[state=open]:bg-muted whitespace-nowrap [&>span]:line-clamp-none [&>span]:overflow-visible';
  const copiarLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?tarefa=${tarefa?.id ?? ''}`;
    void navigator.clipboard?.writeText(url).then(() => toast.success(t('p3Projetos.tarefa.linkCopied')));
  };

  return (
    <>
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconChecklist}
      eyebrow={projetoNome}
      title={tarefa ? t('projetos.tarefaDialog.titleEdit') : t('projetos.tarefaDialog.titleNew')}
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          {tarefa && (
            <Button type="button" variant="ghost" size="sm" className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteConfirm(true)}>
              <IconDelete className="h-4 w-4" /> {t('projetos.tarefaDialog.delete')}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{t('projetos.tarefaDialog.close')}</Button>
          <Button type="submit" size="sm" form="tarefa-form" disabled={upsert.isPending}>{t('projetos.tarefaDialog.save')}</Button>
        </div>
      }
    >
      {/* Barra superior: caminho + estado + link */}
      <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label={t('p3Projetos.tarefa.path')}>
          {projetoNome && <span className="font-medium text-foreground/80">{projetoNome}</span>}
          {caminho.map((c, i) => {
            const cod = codigoDe(c.titulo)?.[1];
            return (
              <React.Fragment key={c.id}>
                <IconChevron className="h-3 w-3 opacity-60" aria-hidden />
                <button type="button" onClick={() => onOpenTarefa?.(c)} className="inline-flex max-w-[240px] items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground">
                  {cod && <span className={i === 0 ? 'rounded bg-primary px-1 text-[10px] font-semibold text-primary-foreground' : 'rounded bg-[hsl(var(--chart-teal))] px-1 text-[10px] font-semibold text-primary-foreground'}>{cod}</span>}
                  <span className="truncate">{nomeCurto(c.titulo)}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>
        <Select value={form.coluna_id} onValueChange={(v) => setForm({ ...form, coluna_id: v })}>
          <SelectTrigger aria-label={t('p3Projetos.tarefa.status')} className="h-8 w-auto gap-1 border-transparent bg-transparent px-1 shadow-none focus:ring-0 [&>svg]:hidden [&>span]:line-clamp-none [&>span]:overflow-visible whitespace-nowrap">
            <div className="flex"><StatusPill kind={kind} className="py-1">{colAtual?.nome ?? '—'}<IconChevron className="h-3 w-3 rotate-90" /></StatusPill></div>
          </SelectTrigger>
          <SelectContent>{colunas.map((c) => <SelectItem key={c.id} value={c.id}><StatusPill kind={statusKindDe(c)}>{c.nome}</StatusPill></SelectItem>)}</SelectContent>
        </Select>
        {tarefa && (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={copiarLink} aria-label={t('p3Projetos.tarefa.copyLink')} title={t('p3Projetos.tarefa.copyLink')}>
            <IconLink className="h-4 w-4" />
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} id="tarefa-form" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Coluna principal */}
        <div className="min-w-0 space-y-6 order-2 lg:order-1">
          <Textarea
            aria-label={t('projetos.tarefaDialog.fieldTitulo')}
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value.replace(/\n/g, ' ') })}
            required
            rows={1}
            placeholder={t('projetos.tarefaDialog.fieldTitulo')}
            className="min-h-0 resize-none border-transparent bg-transparent px-2 -mx-2 py-1 text-2xl font-semibold leading-tight shadow-none hover:bg-muted/50 focus-visible:bg-muted/40 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
          />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t('projetos.tarefaDialog.fieldDescricao')}</h3>
            <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} placeholder={t('p3Projetos.tarefa.descPlaceholder')}
              className="border-transparent bg-muted/30 shadow-none hover:bg-muted/50 focus-visible:border-border focus-visible:bg-background" />
          </section>

          {tarefa && (
            <section className="space-y-2">
              <SectionHead title={t('p3Projetos.tarefa.subtarefas')} done={subFeitas} total={subtarefas.length} />
              <ul className="overflow-hidden rounded-lg border border-border divide-y divide-border">
                {subtarefas.map((s) => {
                  const fim = s.data_fim ?? s.prazo;
                  const cm = codigoDe(s.titulo);
                  const feito = !!s.concluida_em;
                  return (
                    <li key={s.id} className="group flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                      <button type="button" role="checkbox" aria-checked={feito} aria-label={s.titulo} onClick={() => alternarSub(s, !feito)}
                        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${feito ? 'border-state-done bg-state-done text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'}`}>
                        {feito && <IconSuccess className="h-3 w-3" />}
                      </button>
                      {cm && <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary tabular-nums">{cm[1]}</span>}
                      <button type="button" className={`min-w-0 flex-1 truncate text-left hover:text-primary ${feito ? 'line-through text-muted-foreground' : ''}`} onClick={() => onOpenTarefa?.(s)}>{cm?.[2] ?? s.titulo}</button>
                      <StatusPill kind={statusKindDe(colunas.find((c) => c.id === s.coluna_id))} className="hidden sm:inline-flex">{colunas.find((c) => c.id === s.coluna_id)?.nome ?? '—'}</StatusPill>
                      {nomeUsuario(s.responsavel_id) && <Avatar nome={nomeUsuario(s.responsavel_id)!} foto={fotoUsuario(s.responsavel_id)} />}
                      {fim && <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">{parseDataLocal(fim).toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short' })}</span>}
                    </li>
                  );
                })}
                <li className="flex items-center gap-3 px-3 py-1">
                  <IconAdd className="h-4 w-4 text-muted-foreground" />
                  <input value={novaSub} onChange={(e) => setNovaSub(e.target.value)} placeholder={t('p3Projetos.tarefa.addSub')}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void criarSub(); } }}
                    className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                </li>
              </ul>
            </section>
          )}

          {tarefa && (
            <section className="space-y-2">
              <SectionHead title={t('projetos.tarefaDialog.tabChecklist')} done={checklist.filter((c) => c.concluido).length} total={checklist.length} />
              <ChecklistPanel tarefaId={tarefa.id} />
            </section>
          )}

          {tarefa && (
            <Tabs defaultValue="comentarios">
              <TabsList>
                <TabsTrigger value="comentarios">{t('p3Projetos.tarefa.comentarios')}<Count n={coms.length} /></TabsTrigger>
                <TabsTrigger value="tempo">{t('projetos.tarefaDialog.tabTempo')}</TabsTrigger>
                <TabsTrigger value="vinculos">{t('projetos.tarefaDialog.tabVinculos')}<Count n={vinculos.length} /></TabsTrigger>
              </TabsList>
              <TabsContent value="comentarios" className="pt-4"><ComentariosPanel tarefaId={tarefa.id} /></TabsContent>
              <TabsContent value="tempo" className="pt-4">
                <TempoPanel tarefaId={tarefa.id} estimativa={tarefa.estimativa_horas} gasto={tarefa.tempo_gasto_horas} />
              </TabsContent>
              <TabsContent value="vinculos" className="pt-4"><VinculosGRCPanel tarefaId={tarefa.id} /></TabsContent>
            </Tabs>
          )}
        </div>

        {/* Propriedades */}
        <aside className="order-1 lg:order-2 self-start rounded-xl border border-border bg-muted/20 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-4">
          <Prop icon={<IconChecklist />} label={t('p3Projetos.tarefa.status')}>
            <Select value={form.coluna_id} onValueChange={(v) => setForm({ ...form, coluna_id: v })}>
              <SelectTrigger className={ghost}><div className="flex"><StatusPill kind={kind}>{colAtual?.nome ?? '—'}</StatusPill></div></SelectTrigger>
              <SelectContent>{colunas.map((c) => <SelectItem key={c.id} value={c.id}><StatusPill kind={statusKindDe(c)}>{c.nome}</StatusPill></SelectItem>)}</SelectContent>
            </Select>
          </Prop>
          <Prop icon={<IconPerson />} label={t('projetos.tarefaDialog.fieldResponsavel')}>
            <div className="[&_button]:h-9 [&_button]:border-transparent [&_button]:bg-transparent [&_button]:px-2 [&_button]:shadow-none [&_button:hover]:bg-muted">
              <UserSelect value={form.responsavel_id} onValueChange={(v) => setForm({ ...form, responsavel_id: v })} />
            </div>
          </Prop>
          <Prop icon={<IconFlag />} label={t('projetos.tarefaDialog.fieldPrioridade')}>
            <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as ProjetoTarefaPrioridade })}>
              <SelectTrigger className={ghost}>
                <div className="flex items-center gap-2"><IconFlag className={`h-4 w-4 ${PRIOR_COR[form.prioridade]}`} />{t(`projetos.priority.${form.prioridade}`)}</div>
              </SelectTrigger>
              <SelectContent>
                {(['baixa', 'media', 'alta', 'critica'] as const).map((p) => (
                  <SelectItem key={p} value={p}><span className="flex items-center gap-2"><IconFlag className={`h-4 w-4 ${PRIOR_COR[p]}`} />{t(`projetos.priority.${p}`)}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Prop>
          <Prop icon={<IconCalendar />} label={t('p3Projetos.tarefa.inicio')}>
            <div className="[&_button]:h-9 [&_button]:border-transparent [&_button]:bg-transparent [&_button]:px-2 [&_button]:shadow-none [&_button:hover]:bg-muted">
              <DateField value={form.data_inicio || null} onChange={(v) => setForm({ ...form, data_inicio: v ?? '' })} />
            </div>
          </Prop>
          <Prop icon={<IconCalendar />} label={t('p3Projetos.tarefa.conclusao')}>
            <div className="[&_button]:h-9 [&_button]:border-transparent [&_button]:bg-transparent [&_button]:px-2 [&_button]:shadow-none [&_button:hover]:bg-muted">
              <DateField value={form.prazo || null} onChange={(v) => setForm({ ...form, prazo: v ?? '' })} />
            </div>
          </Prop>
          <Prop icon={<IconTime />} label={t('projetos.tarefaDialog.fieldEstimativa')}>
            <Input type="number" min="0" step="0.5" placeholder={t('p3Projetos.tarefa.vazio')} className="h-9 border-transparent bg-transparent px-2 shadow-none hover:bg-muted focus-visible:bg-background" value={form.estimativa_horas} onChange={(e) => setForm({ ...form, estimativa_horas: e.target.value })} />
          </Prop>
          <Prop icon={<IconTrendUp />} label={t('projetos.tarefaDialog.fieldSprint')}>
            <Select value={form.sprint_id || 'none'} onValueChange={(v) => setForm({ ...form, sprint_id: v === 'none' ? '' : v })}>
              <SelectTrigger className={ghost}><SelectValue placeholder={t('projetos.tarefaDialog.noSprint')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('projetos.tarefaDialog.noSprint')}</SelectItem>
                {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Prop>
          <Prop icon={<IconTag />} label={t('p3Projetos.tarefa.etiquetas')}>
            <div className="flex flex-wrap items-center gap-1 px-2">
              {form.tags.map((g) => (
                <button key={g} type="button" onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== g) })}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-destructive/10 hover:text-destructive" title={t('common.delete')}>
                  {g === TAG_MARCO ? `◆ ${t('p3Projetos.lista.milestone')}` : g}
                </button>
              ))}
              <input value={novaTag} onChange={(e) => setNovaTag(e.target.value)} placeholder="+"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} onBlur={addTag}
                className="h-6 w-10 rounded-full border border-dashed border-border bg-transparent px-2 text-xs outline-none focus:border-primary" />
            </div>
          </Prop>
          <div className="col-span-full mt-2 flex items-center gap-4 border-t border-border px-1 pt-4">
            <ProgressRing value={colAtual?.is_concluido ? 100 : form.progresso_pct} />
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><IconSuccess className="h-4 w-4" />{t('p3Projetos.tarefa.progresso')}</p>
              <div className="flex items-center gap-1">
                <Input type="number" min={0} max={100} step={5} className="h-9 w-20" aria-label={t('p3Projetos.tarefa.progresso')}
                  value={colAtual?.is_concluido ? 100 : form.progresso_pct} disabled={!!colAtual?.is_concluido}
                  onChange={(e) => setForm({ ...form, progresso_pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </aside>
      </form>
    </DialogShell>

    <ConfirmDialog
      open={deleteConfirm}
      onOpenChange={setDeleteConfirm}
      title={t('projetos.tarefaDialog.deleteConfirmTitle')}
      description={t('projetos.tarefaDialog.deleteConfirmDesc')}
      confirmText={t('projetos.tarefaDialog.confirmText')}
      cancelText={t('projetos.tarefaDialog.cancelText')}
      variant="destructive"
      onConfirm={() => {
        if (!tarefa) return;
        const id = tarefa.id;
        setDeleteConfirm(false);
        onOpenChange(false);
        void undoableAction({
          message: t('p3Projetos.tarefa.deleted'),
          undoLabel: t('p3Projetos.tarefa.undo'),
          onCommit: () => remove.mutateAsync(id),
        }).catch(() => undefined);
      }}
      loading={remove.isPending}
    />
    </>
  );
}

const PRIOR_COR: Record<ProjetoTarefaPrioridade, string> = {
  critica: 'text-destructive', alta: 'text-warning', media: 'text-state-active', baixa: 'text-muted-foreground',
};

function Count({ n }: { n: number }) {
  return <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{n}</span>;
}

function Avatar({ nome, foto }: { nome: string; foto?: string | null }) {
  const ini = nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  if (foto) return <img src={foto} alt={nome} title={nome} className="h-6 w-6 shrink-0 rounded-full object-cover" />;
  return <span title={nome} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">{ini}</span>;
}

function Prop({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-10 grid-cols-[140px_minmax(0,1fr)] items-center gap-1 py-0.5">
      <span className="flex items-center gap-2 whitespace-nowrap px-1 text-xs text-muted-foreground [&>svg]:shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}{label}</span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

function SectionHead({ title, done, total }: { title: string; done: number; total: number }) {
  const { t } = useLanguage();
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{title}{total > 0 && <Count n={total} />}</h3>
      {total > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('p3Projetos.tarefa.doneOf', { done, total })}</span>
          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden"><div className={pct >= 100 ? 'h-full bg-success' : 'h-full bg-primary'} style={{ width: `${pct}%` }} /></div>
          <span className="tabular-nums">{pct}%</span>
        </div>
      )}
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 24, c = 2 * Math.PI * r;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={value >= 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))'} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 28 28)" className="transition-all duration-500" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">{value}%</span>
    </div>
  );
}


function ChecklistPanel({ tarefaId }: { tarefaId: string }) {
  const { t } = useLanguage();
  const { data: itens = [] } = useTarefaChecklist(tarefaId);
  const { add, toggle, remove } = useChecklistMutations(tarefaId);
  const [novo, setNovo] = useState('');

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder={t('projetos.tarefaDialog.addItemPlaceholder')}
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (novo.trim()) { add.mutate(novo.trim()); setNovo(''); } } }}
          className="h-9"
        />
        <Button type="button" size="icon" className="h-9 w-9 shrink-0" onClick={() => { if (novo.trim()) { add.mutate(novo.trim()); setNovo(''); } }} aria-label={t('common.add')} title={t('common.add')}>
          <IconAdd className="h-4 w-4" />
        </Button>
      </div>
      <ul className="space-y-1.5">
        {itens.map((i) => (
          <li key={i.id} className="flex items-center gap-2 group">
            <Checkbox checked={i.concluido} onCheckedChange={(c) => toggle.mutate({ id: i.id, concluido: !!c })} />
            <span className={`flex-1 text-sm ${i.concluido ? 'line-through text-muted-foreground' : ''}`}>{i.texto}</span>
            <Button type="button" variant="ghost" size="icon" className="md:opacity-0 md:group-hover:opacity-100 h-7 w-7" onClick={() => remove.mutate(i.id)} aria-label={t('common.delete')} title={t('common.delete')}>
              <IconDelete className="h-3 w-3" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ComentariosPanel({ tarefaId }: { tarefaId: string }) {
  const { t } = useLanguage();
  const { data: coms = [] } = useTarefaComentarios(tarefaId);
  const add = useAddComentario(tarefaId);
  const ids = coms.map((c) => c.id);
  const { data: reacoes } = useReacoes(ids);
  const [novo, setNovo] = useState('');
  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {coms.length === 0 && <p className="text-sm text-muted-foreground">{t('projetos.tarefaDialog.noCommentsYet')}</p>}
        {coms.map((c) => (
          <div key={c.id} className="rounded-md border border-border bg-card p-3 text-sm space-y-2">
            <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString(intlLocale())}</p>
            <p className="whitespace-pre-wrap">{c.conteudo}</p>
            <ReacoesPorComentario comentarioId={c.id} reacoes={reacoes} />
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <Textarea rows={2} className="min-h-[72px]" placeholder={t('projetos.tarefaDialog.commentPlaceholder')} value={novo} onChange={(e) => setNovo(e.target.value)} />
        <Button type="button" size="icon" className="h-9 w-9 shrink-0" onClick={() => { if (novo.trim()) { add.mutate(novo.trim()); setNovo(''); } }}>
          <IconSend className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
