import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { Trash2, Plus, Send } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projetoId: string;
  colunas: ProjetoColuna[];
  tarefa?: ProjetoTarefa | null;
  defaultColunaId?: string | null;
}

export function TarefaDialog({ open, onOpenChange, projetoId, colunas, tarefa, defaultColunaId }: Props) {
  const upsert = useUpsertTarefa();
  const remove = useDeleteTarefa(projetoId);
  const { data: sprints = [] } = useSprints(projetoId);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tarefa ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detalhes">
          <TabsList>
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            {tarefa && <TabsTrigger value="checklist">Checklist</TabsTrigger>}
            {tarefa && <TabsTrigger value="tempo">Tempo</TabsTrigger>}
            {tarefa && <TabsTrigger value="comentarios">Comentários</TabsTrigger>}
            {tarefa && <TabsTrigger value="vinculos">Vínculos GRC</TabsTrigger>}
          </TabsList>

          <TabsContent value="detalhes" className="space-y-4 pt-3">
            <form onSubmit={handleSubmit} className="space-y-4" id="tarefa-form">
              <div>
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Coluna</Label>
                  <Select value={form.coluna_id} onValueChange={(v) => setForm({ ...form, coluna_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as ProjetoTarefaPrioridade })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Responsável</Label>
                <UserSelect value={form.responsavel_id} onValueChange={(v) => setForm({ ...form, responsavel_id: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prazo</Label>
                  <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
                </div>
                <div>
                  <Label>Estimativa (h)</Label>
                  <Input type="number" step="0.5" value={form.estimativa_horas} onChange={(e) => setForm({ ...form, estimativa_horas: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Sprint</Label>
                <Select value={form.sprint_id || 'none'} onValueChange={(v) => setForm({ ...form, sprint_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Sem sprint" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem sprint</SelectItem>
                    {sprints.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} {s.ativa ? '· ativa' : s.concluida ? '· concluída' : ''}
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

        <DialogFooter className="mt-4">
          {tarefa && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (confirm('Remover esta tarefa?')) {
                  await remove.mutateAsync(tarefa.id);
                  onOpenChange(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button type="submit" form="tarefa-form" disabled={upsert.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistPanel({ tarefaId }: { tarefaId: string }) {
  const { data: itens = [] } = useTarefaChecklist(tarefaId);
  const { add, toggle, remove } = useChecklistMutations(tarefaId);
  const [novo, setNovo] = useState('');

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Adicionar item..."
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (novo.trim()) { add.mutate(novo.trim()); setNovo(''); } } }}
        />
        <Button type="button" size="icon" onClick={() => { if (novo.trim()) { add.mutate(novo.trim()); setNovo(''); } }}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ul className="space-y-1.5">
        {itens.map((i) => (
          <li key={i.id} className="flex items-center gap-2 group">
            <Checkbox checked={i.concluido} onCheckedChange={(c) => toggle.mutate({ id: i.id, concluido: !!c })} />
            <span className={`flex-1 text-sm ${i.concluido ? 'line-through text-muted-foreground' : ''}`}>{i.texto}</span>
            <Button type="button" variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={() => remove.mutate(i.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ComentariosPanel({ tarefaId }: { tarefaId: string }) {
  const { data: coms = [] } = useTarefaComentarios(tarefaId);
  const add = useAddComentario(tarefaId);
  const ids = coms.map((c) => c.id);
  const { data: reacoes } = useReacoes(ids);
  const [novo, setNovo] = useState('');
  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {coms.length === 0 && <p className="text-sm text-muted-foreground">Sem comentários ainda.</p>}
        {coms.map((c) => (
          <div key={c.id} className="rounded-md border border-border bg-card p-3 text-sm space-y-2">
            <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString('pt-BR')}</p>
            <p className="whitespace-pre-wrap">{c.conteudo}</p>
            <ReacoesPorComentario comentarioId={c.id} reacoes={reacoes} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Textarea rows={2} placeholder="Escreva um comentário..." value={novo} onChange={(e) => setNovo(e.target.value)} />
        <Button type="button" onClick={() => { if (novo.trim()) { add.mutate(novo.trim()); setNovo(''); } }}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
