import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Pencil, Trash2, Zap, Play } from 'lucide-react';
import { useAutomacoes, useUpsertAutomacao, useDeleteAutomacao, type Automacao } from '@/hooks/useProjetoExtras';
import type { ProjetoColuna } from '@/types/projetos';
import { UserSelect } from '@/components/riscos/UserSelect';

const GATILHOS = [
  { value: 'tarefa_criada', label: 'Quando uma tarefa é criada' },
  { value: 'tarefa_movida_para_coluna', label: 'Quando uma tarefa é movida para uma coluna' },
  { value: 'prazo_vencido', label: 'Quando o prazo vence' },
  { value: 'sla_em_risco', label: 'Quando o SLA fica em risco' },
];

const TIPOS_ACAO = [
  { value: 'mover_para_coluna', label: 'Mover para coluna' },
  { value: 'mudar_prioridade', label: 'Mudar prioridade' },
  { value: 'atribuir_responsavel', label: 'Atribuir responsável' },
  { value: 'notificar_usuario', label: 'Notificar usuário' },
];

export function AutomacoesPanel({ projetoId, colunas }: { projetoId: string; colunas: ProjetoColuna[] }) {
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
          <h3 className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-primary" strokeWidth={1.5} /> Automações</h3>
          <p className="text-xs text-muted-foreground">Regras que disparam ações automaticamente neste projeto.</p>
        </div>
        <Button size="sm" onClick={() => { setEditando(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Nova automação
        </Button>
      </div>

      {isLoading ? null : automacoes.length === 0 ? (
        <EmptyState
          variant="illustrated"
          icon={<Zap className="h-8 w-8" />}
          title="Nenhuma automação"
          description="Automatize movimentações repetitivas. Exemplo: mover para 'Em revisão' quando a tarefa é concluída."
          action={{ label: 'Criar primeira automação', onClick: () => { setEditando(null); setOpen(true); } }}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {automacoes.map((a) => (
            <div key={a.id} className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium truncate">{a.nome}</h4>
                  {a.ativa
                    ? <StatusBadge tone="success" size="sm">Ativa</StatusBadge>
                    : <StatusBadge tone="neutral" size="sm">Pausada</StatusBadge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {GATILHOS.find((g) => g.value === a.gatilho)?.label ?? a.gatilho}
                  {' · '}{(a.acoes ?? []).length} ação(ões)
                  {' · '}{a.execucoes_count} execuções
                </div>
                {a.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.descricao}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Switch checked={a.ativa} onCheckedChange={() => toggleAtiva(a)} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditando(a); setOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm('Remover automação?')) del.mutate(a.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AutomacaoDialog open={open} onOpenChange={setOpen} projetoId={projetoId} colunas={colunas} automacao={editando} />
    </div>
  );
}

function AutomacaoDialog({ open, onOpenChange, projetoId, colunas, automacao }: {
  open: boolean; onOpenChange: (v: boolean) => void; projetoId: string; colunas: ProjetoColuna[]; automacao: Automacao | null;
}) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" strokeWidth={1.5} />{automacao ? 'Editar automação' : 'Nova automação'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>Descrição</Label><Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>

          <div>
            <Label>Gatilho (Quando)</Label>
            <Select value={form.gatilho} onValueChange={(v) => setForm({ ...form, gatilho: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GATILHOS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {form.gatilho === 'tarefa_movida_para_coluna' && (
            <div>
              <Label>Coluna alvo</Label>
              <Select value={form.condicoes?.coluna_id ?? ''} onValueChange={(v) => setForm({ ...form, condicoes: { ...form.condicoes, coluna_id: v } })}>
                <SelectTrigger><SelectValue placeholder="Qualquer coluna" /></SelectTrigger>
                <SelectContent>{colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ações (Então)</Label>
              <Button size="sm" variant="ghost" onClick={addAcao}><Plus className="h-3.5 w-3.5" /> ação</Button>
            </div>
            {form.acoes.map((a: any, i: number) => (
              <div key={i} className="rounded-md border border-border bg-card p-2 space-y-2">
                <div className="flex gap-2">
                  <Select value={a.tipo} onValueChange={(v) => setAcao(i, { tipo: v })}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS_ACAO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => rmAcao(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                {a.tipo === 'mover_para_coluna' && (
                  <Select value={a.coluna_id ?? ''} onValueChange={(v) => setAcao(i, { coluna_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione coluna" /></SelectTrigger>
                    <SelectContent>{colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {a.tipo === 'mudar_prioridade' && (
                  <Select value={a.prioridade ?? ''} onValueChange={(v) => setAcao(i, { prioridade: v })}>
                    <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
                    <SelectContent>
                      {['baixa', 'media', 'alta', 'critica'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
            <Label>Ativa</Label>
            <Switch checked={form.ativa} onCheckedChange={(v) => setForm({ ...form, ativa: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={upsert.isPending}><Play className="h-4 w-4" /> Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
