import React, { useEffect, useState } from 'react';
import { intlLocale } from '@/lib/date-utils';
import { IconAdd, IconDelete, IconSend, IconChecklist } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Label } from '@/components/ui/label';
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
}

export function TarefaDialog({ open, onOpenChange, projetoId, colunas, tarefa, defaultColunaId }: Props) {
  const { t } = useLanguage();
  const upsert = useUpsertTarefa();
  const remove = useDeleteTarefa(projetoId);
  const { data: sprints = [] } = useSprints(projetoId);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'media' as ProjetoTarefaPrioridade,
    coluna_id: '',
    responsavel_id: '',
    prazo: '',
    estimativa_horas: '',
    sprint_id: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        titulo: tarefa?.titulo ?? '',
        descricao: tarefa?.descricao ?? '',
        prioridade: (tarefa?.prioridade ?? 'media') as ProjetoTarefaPrioridade,
        coluna_id: tarefa?.coluna_id ?? defaultColunaId ?? colunas[0]?.id ?? '',
        responsavel_id: tarefa?.responsavel_id ?? '',
        prazo: tarefa?.prazo ? tarefa.prazo.slice(0, 10) : '',
        estimativa_horas: tarefa?.estimativa_horas ? String(tarefa.estimativa_horas) : '',
        sprint_id: (tarefa as any)?.sprint_id ?? '',
      });
    }
  }, [open, tarefa, defaultColunaId, colunas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    await upsert.mutateAsync({
      id: tarefa?.id,
      projeto_id: projetoId,
      coluna_id: form.coluna_id || null,
      titulo: form.titulo.trim(),
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      responsavel_id: form.responsavel_id || null,
      prazo: form.prazo || null,
      estimativa_horas: form.estimativa_horas ? Number(form.estimativa_horas) : null,
      sprint_id: form.sprint_id || null,
    } as any);
    onOpenChange(false);
  };

  return (
    <>
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconChecklist}
      title={tarefa ? t('projetos.tarefaDialog.titleEdit') : t('projetos.tarefaDialog.titleNew')}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          {tarefa && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="mr-auto"
              onClick={() => setDeleteConfirm(true)}
            >
              <IconDelete className="h-4 w-4" /> {t('projetos.tarefaDialog.delete')}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{t('projetos.tarefaDialog.close')}</Button>
          <Button type="submit" size="sm" form="tarefa-form" disabled={upsert.isPending}>{t('projetos.tarefaDialog.save')}</Button>
        </div>
      }
    >
        <Tabs defaultValue="detalhes">
          <TabsList>
            <TabsTrigger value="detalhes">{t('projetos.tarefaDialog.tabDetalhes')}</TabsTrigger>
            {tarefa && <TabsTrigger value="checklist">{t('projetos.tarefaDialog.tabChecklist')}</TabsTrigger>}
            {tarefa && <TabsTrigger value="tempo">{t('projetos.tarefaDialog.tabTempo')}</TabsTrigger>}
            {tarefa && <TabsTrigger value="comentarios">{t('projetos.tarefaDialog.tabComentarios')}</TabsTrigger>}
            {tarefa && <TabsTrigger value="vinculos">{t('projetos.tarefaDialog.tabVinculos')}</TabsTrigger>}
          </TabsList>

          <TabsContent value="detalhes" className="space-y-4 pt-3">
            <form onSubmit={handleSubmit} className="space-y-4" id="tarefa-form">
              <div className="space-y-2">
                <Label>{t('projetos.tarefaDialog.fieldTitulo')}</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>{t('projetos.tarefaDialog.fieldDescricao')}</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('projetos.tarefaDialog.fieldColuna')}</Label>
                  <Select value={form.coluna_id} onValueChange={(v) => setForm({ ...form, coluna_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('projetos.tarefaDialog.fieldPrioridade')}</Label>
                  <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as ProjetoTarefaPrioridade })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">{t('projetos.priority.baixa')}</SelectItem>
                      <SelectItem value="media">{t('projetos.priority.media')}</SelectItem>
                      <SelectItem value="alta">{t('projetos.priority.alta')}</SelectItem>
                      <SelectItem value="critica">{t('projetos.priority.critica')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('projetos.tarefaDialog.fieldResponsavel')}</Label>
                <UserSelect value={form.responsavel_id} onValueChange={(v) => setForm({ ...form, responsavel_id: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('projetos.tarefaDialog.fieldPrazo')}</Label>
                  <DateField value={form.prazo || null} onChange={(v) => setForm({ ...form, prazo: v ?? '' })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('projetos.tarefaDialog.fieldEstimativa')}</Label>
                  <Input type="number" step="0.5" value={form.estimativa_horas} onChange={(e) => setForm({ ...form, estimativa_horas: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('projetos.tarefaDialog.fieldSprint')}</Label>
                <Select value={form.sprint_id || 'none'} onValueChange={(v) => setForm({ ...form, sprint_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder={t('projetos.tarefaDialog.noSprint')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('projetos.tarefaDialog.noSprint')}</SelectItem>
                    {sprints.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} {s.ativa ? `· ${t('projetos.sprints.active')}` : s.concluida ? `· ${t('projetos.sprints.completed')}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </form>
          </TabsContent>

          {tarefa && (
            <TabsContent value="tempo" className="pt-3">
              <TempoPanel tarefaId={tarefa.id} estimativa={tarefa.estimativa_horas} gasto={tarefa.tempo_gasto_horas} />
            </TabsContent>
          )}

          {tarefa && (
            <TabsContent value="checklist" className="pt-3">
              <ChecklistPanel tarefaId={tarefa.id} />
            </TabsContent>
          )}
          {tarefa && (
            <TabsContent value="comentarios" className="pt-3">
              <ComentariosPanel tarefaId={tarefa.id} />
            </TabsContent>
          )}
          {tarefa && (
            <TabsContent value="vinculos" className="pt-3">
              <VinculosGRCPanel tarefaId={tarefa.id} />
            </TabsContent>
          )}
        </Tabs>
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
        <Button type="button" size="icon" onClick={() => { if (novo.trim()) { add.mutate(novo.trim()); setNovo(''); } }}>
          <IconAdd className="h-4 w-4" />
        </Button>
      </div>
      <ul className="space-y-1.5">
        {itens.map((i) => (
          <li key={i.id} className="flex items-center gap-2 group">
            <Checkbox checked={i.concluido} onCheckedChange={(c) => toggle.mutate({ id: i.id, concluido: !!c })} />
            <span className={`flex-1 text-sm ${i.concluido ? 'line-through text-muted-foreground' : ''}`}>{i.texto}</span>
            <Button type="button" variant="ghost" size="icon" className="md:opacity-0 md:group-hover:opacity-100 h-7 w-7" onClick={() => remove.mutate(i.id)}>
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
