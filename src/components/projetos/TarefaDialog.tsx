import React, { useEffect, useState } from 'react';
import { intlLocale, parseDataLocal } from '@/lib/date-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { TAG_MARCO } from '@/lib/projeto-acompanhamento';
import { IconAdd, IconDelete, IconSend, IconChecklist, IconUser, IconFlag, IconCalendar, IconTime, IconTrendUp, IconTag, IconSuccess } from '@/components/icons';
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
} from '@/hooks/useProjetoTarefas';
import { VinculosGRCPanel } from './VinculosGRCPanel';
import { TempoPanel } from './TempoPanel';
import { ReacoesPorComentario } from './ReacoesBar';
import { useReacoes, useSprints } from '@/hooks/useProjetoExtras';
import type { ProjetoTarefa, ProjetoTarefaPrioridade, ProjetoColuna } from '@/types/projetos';
;
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

  const statusTone = colAtual?.is_concluido ? 'success' : /atras/i.test(colAtual?.nome ?? '') ? 'destructive' : /andamento|progress/i.test(colAtual?.nome ?? '') ? 'info' : 'neutral';

  return (
    <>
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconChecklist}
      title={tarefa ? t('projetos.tarefaDialog.titleEdit') : t('projetos.tarefaDialog.titleNew')}
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          {tarefa && (
            <Button type="button" variant="destructive" size="sm" className="mr-auto" onClick={() => setDeleteConfirm(true)}>
              <IconDelete className="h-4 w-4" /> {t('projetos.tarefaDialog.delete')}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{t('projetos.tarefaDialog.close')}</Button>
          <Button type="submit" size="sm" form="tarefa-form" disabled={upsert.isPending}>{t('projetos.tarefaDialog.save')}</Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} id="tarefa-form" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Coluna principal */}
        <div className="min-w-0 space-y-5 order-2 lg:order-1">
          <div className="space-y-1.5">
            {(projetoNome || caminho.length > 0) && (
              <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label={t('p3Projetos.tarefa.path')}>
                {projetoNome && <span>{projetoNome}</span>}
                {caminho.map((c) => (
                  <React.Fragment key={c.id}>
                    <span aria-hidden>/</span>
                    <button type="button" className="hover:text-foreground hover:underline truncate max-w-[220px]" onClick={() => onOpenTarefa?.(c)}>{c.titulo}</button>
                  </React.Fragment>
                ))}
              </nav>
            )}
            <Input
              aria-label={t('projetos.tarefaDialog.fieldTitulo')}
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              required
              placeholder={t('projetos.tarefaDialog.fieldTitulo')}
              className="h-auto border-transparent bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:border-border focus-visible:px-2"
            />
          </div>

          <Tabs defaultValue="detalhes">
            <TabsList>
              <TabsTrigger value="detalhes">{t('projetos.tarefaDialog.tabDetalhes')}</TabsTrigger>
              {tarefa && <TabsTrigger value="tempo">{t('projetos.tarefaDialog.tabTempo')}</TabsTrigger>}
              {tarefa && <TabsTrigger value="vinculos">{t('projetos.tarefaDialog.tabVinculos')}</TabsTrigger>}
            </TabsList>

            <TabsContent value="detalhes" className="space-y-6 pt-4">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t('projetos.tarefaDialog.fieldDescricao')}</h3>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={4} placeholder={t('p3Projetos.tarefa.descPlaceholder')} />
              </section>

              {tarefa && (
                <section className="space-y-2">
                  <SectionHead title={t('p3Projetos.tarefa.subtarefas')} done={subFeitas} total={subtarefas.length} />
                  {subtarefas.length > 0 && (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {subtarefas.map((s) => {
                        const fim = s.data_fim ?? s.prazo;
                        return (
                          <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                            <Checkbox checked={!!s.concluida_em} onCheckedChange={(c) => alternarSub(s, !!c)} aria-label={s.titulo} />
                            <button type="button" className={`flex-1 truncate text-left hover:underline ${s.concluida_em ? 'line-through text-muted-foreground' : ''}`} onClick={() => onOpenTarefa?.(s)}>{s.titulo}</button>
                            {fim && <span className="text-xs text-muted-foreground tabular-nums">{parseDataLocal(fim).toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short' })}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <Input value={novaSub} onChange={(e) => setNovaSub(e.target.value)} placeholder={t('p3Projetos.tarefa.addSub')}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void criarSub(); } }} className="h-9" />
                    <Button type="button" variant="outline" size="sm" onClick={() => void criarSub()} disabled={!novaSub.trim()}><IconAdd className="h-4 w-4" /></Button>
                  </div>
                </section>
              )}

              {tarefa && (
                <section className="space-y-2">
                  <SectionHead title={t('projetos.tarefaDialog.tabChecklist')} done={checklist.filter((c) => c.concluido).length} total={checklist.length} />
                  <ChecklistPanel tarefaId={tarefa.id} />
                </section>
              )}

              {tarefa && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">{t('p3Projetos.tarefa.atividade')}</h3>
                  <ComentariosPanel tarefaId={tarefa.id} />
                </section>
              )}
            </TabsContent>

            {tarefa && (
              <TabsContent value="tempo" className="pt-4">
                <TempoPanel tarefaId={tarefa.id} estimativa={tarefa.estimativa_horas} gasto={tarefa.tempo_gasto_horas} />
              </TabsContent>
            )}
            {tarefa && (
              <TabsContent value="vinculos" className="pt-4">
                <VinculosGRCPanel tarefaId={tarefa.id} />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Propriedades */}
        <aside className="order-1 lg:order-2 space-y-1 rounded-xl border border-border bg-muted/30 p-4 self-start">
          <Prop icon={<IconChecklist />} label={t('p3Projetos.tarefa.status')}>
            <Select value={form.coluna_id} onValueChange={(v) => setForm({ ...form, coluna_id: v })}>
              <SelectTrigger className="h-8 w-auto min-w-[150px] border-transparent bg-transparent px-1 shadow-none"><StatusBadge tone={statusTone}>{colAtual?.nome ?? '—'}</StatusBadge></SelectTrigger>
              <SelectContent>{colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Prop>
          <Prop icon={<IconUser />} label={t('projetos.tarefaDialog.fieldResponsavel')}>
            <UserSelect value={form.responsavel_id} onValueChange={(v) => setForm({ ...form, responsavel_id: v })} />
          </Prop>
          <Prop icon={<IconFlag />} label={t('projetos.tarefaDialog.fieldPrioridade')}>
            <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as ProjetoTarefaPrioridade })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">{t('projetos.priority.baixa')}</SelectItem>
                <SelectItem value="media">{t('projetos.priority.media')}</SelectItem>
                <SelectItem value="alta">{t('projetos.priority.alta')}</SelectItem>
                <SelectItem value="critica">{t('projetos.priority.critica')}</SelectItem>
              </SelectContent>
            </Select>
          </Prop>
          <Prop icon={<IconCalendar />} label={t('p3Projetos.tarefa.inicio')}>
            <DateField value={form.data_inicio || null} onChange={(v) => setForm({ ...form, data_inicio: v ?? '' })} />
          </Prop>
          <Prop icon={<IconCalendar />} label={t('p3Projetos.tarefa.conclusao')}>
            <DateField value={form.prazo || null} onChange={(v) => setForm({ ...form, prazo: v ?? '' })} />
          </Prop>
          <Prop icon={<IconTime />} label={t('projetos.tarefaDialog.fieldEstimativa')}>
            <Input type="number" min="0" step="0.5" className="h-8" value={form.estimativa_horas} onChange={(e) => setForm({ ...form, estimativa_horas: e.target.value })} />
          </Prop>
          <Prop icon={<IconTrendUp />} label={t('projetos.tarefaDialog.fieldSprint')}>
            <Select value={form.sprint_id || 'none'} onValueChange={(v) => setForm({ ...form, sprint_id: v === 'none' ? '' : v })}>
              <SelectTrigger className="h-8"><SelectValue placeholder={t('projetos.tarefaDialog.noSprint')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('projetos.tarefaDialog.noSprint')}</SelectItem>
                {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Prop>
          <Prop icon={<IconTag />} label={t('p3Projetos.tarefa.etiquetas')}>
            <div className="flex flex-wrap gap-1">
              {form.tags.map((g) => (
                <button key={g} type="button" onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== g) })}
                  className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary hover:bg-destructive/10 hover:text-destructive" title={t('common.delete')}>
                  {g === TAG_MARCO ? `◆ ${t('p3Projetos.lista.milestone')}` : g}
                </button>
              ))}
              <Input value={novaTag} onChange={(e) => setNovaTag(e.target.value)} placeholder="+"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} onBlur={addTag} className="h-6 w-20 px-1.5 text-xs" />
            </div>
          </Prop>
          <Prop icon={<IconSuccess />} label={t('p3Projetos.tarefa.progresso')}>
            <div className="flex items-center gap-3">
              <ProgressRing value={colAtual?.is_concluido ? 100 : form.progresso_pct} />
              <Input type="number" min={0} max={100} step={5} className="h-8 w-20" aria-label={t('p3Projetos.tarefa.progresso')}
                value={colAtual?.is_concluido ? 100 : form.progresso_pct} disabled={!!colAtual?.is_concluido}
                onChange={(e) => setForm({ ...form, progresso_pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            </div>
          </Prop>
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
      onConfirm={async () => {
        if (tarefa) {
          await remove.mutateAsync(tarefa.id);
          setDeleteConfirm(false);
          onOpenChange(false);
        }
      }}
      loading={remove.isPending}
    />
    </>
  );
}

function Prop({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2 py-1.5">
      <span className="flex items-center gap-2 text-xs text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SectionHead({ title, done, total }: { title: string; done: number; total: number }) {
  const { t } = useLanguage();
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {total > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('p3Projetos.tarefa.doneOf', { done, total })}</span>
          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
          <span className="tabular-nums">{pct}%</span>
        </div>
      )}
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 14, c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 18 18)" className="transition-all" />
    </svg>
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
        />
        <Button type="button" size="icon" onClick={() => { if (novo.trim()) { add.mutate(novo.trim()); setNovo(''); } }} aria-label={t('common.add')} title={t('common.add')}>
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
      <div className="flex gap-2">
        <Textarea rows={2} placeholder={t('projetos.tarefaDialog.commentPlaceholder')} value={novo} onChange={(e) => setNovo(e.target.value)} />
        <Button type="button" onClick={() => { if (novo.trim()) { add.mutate(novo.trim()); setNovo(''); } }}>
          <IconSend className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
