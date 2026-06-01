import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { EmptyState } from '@/components/ui/empty-state';
import { ArrowLeft, Layers, Plus, Trash2, Pencil, Sparkles } from 'lucide-react';
import { useTemplates, useUpsertTemplate, useDeleteTemplate, useAplicarTemplate, type Template } from '@/hooks/useProjetoExtras';
import { useAuth } from '@/components/AuthProvider';

export default function ProjetoTemplates() {
  const navigate = useNavigate();
  const { data: templates = [], isLoading } = useTemplates();
  const del = useDeleteTemplate();
  const aplicar = useAplicarTemplate();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const isAdmin = profile?.role === 'admin' || isSuperAdmin;

  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Template | null>(null);
  const [applyOpen, setApplyOpen] = React.useState(false);
  const [aplicando, setAplicando] = React.useState<Template | null>(null);
  const [nomeProjeto, setNomeProjeto] = React.useState('');

  const globais = templates.filter((t) => t.is_global);
  const empresa = templates.filter((t) => !t.is_global);

  const renderTpl = (t: Template) => (
    <Card key={t.id} variant="elevated" className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{t.nome}</h3>
              {t.is_global
                ? <StatusBadge tone="primary" size="sm">Global</StatusBadge>
                : <StatusBadge tone="neutral" size="sm">Empresa</StatusBadge>}
              {t.categoria && <StatusBadge tone="info" size="sm">{t.categoria}</StatusBadge>}
            </div>
            {t.descricao && <p className="text-xs text-muted-foreground mt-1">{t.descricao}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{(t.dados?.colunas ?? []).length} colunas</span>
          <span>·</span>
          <span>{(t.dados?.tarefas ?? []).length} tarefas pré-definidas</span>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1" onClick={() => { setAplicando(t); setNomeProjeto(t.nome); setApplyOpen(true); }}>
            <Sparkles className="h-3.5 w-3.5" /> Aplicar
          </Button>
          {(isAdmin || (isSuperAdmin && t.is_global)) && (
            <>
              <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => { setEditing(t); setEditOpen(true); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => { if (confirm(`Remover template "${t.nome}"?`)) del.mutate(t.id); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projetos')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2"><Layers className="h-7 w-7 text-primary" strokeWidth={1.5} /> Templates de projeto</h1>
          <p className="text-sm text-muted-foreground mt-1">Acelere criação de projetos a partir de modelos prontos.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setEditOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo template
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><AkurisPulse size={56} /></div>
      ) : templates.length === 0 ? (
        <EmptyState variant="illustrated" icon={<Layers className="h-8 w-8" />} title="Nenhum template" description="Crie modelos reutilizáveis com colunas e tarefas pré-definidas." />
      ) : (
        <>
          {globais.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Globais</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{globais.map(renderTpl)}</div>
            </section>
          )}
          {empresa.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Da minha empresa</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{empresa.map(renderTpl)}</div>
            </section>
          )}
        </>
      )}

      <TemplateEditor open={editOpen} onOpenChange={setEditOpen} template={editing} isSuperAdmin={!!isSuperAdmin} />

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar template</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome do novo projeto</Label>
            <Input value={nomeProjeto} onChange={(e) => setNomeProjeto(e.target.value)} placeholder="Ex: Remediação ISO 27001 Q1" />
            <p className="text-xs text-muted-foreground">Será criado com {(aplicando?.dados?.colunas ?? []).length} colunas e {(aplicando?.dados?.tarefas ?? []).length} tarefas iniciais.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancelar</Button>
            <Button
              disabled={!nomeProjeto.trim() || aplicar.isPending}
              onClick={async () => {
                if (!aplicando) return;
                const id = await aplicar.mutateAsync({ template: aplicando, nomeProjeto: nomeProjeto.trim() });
                setApplyOpen(false);
                navigate(`/projetos/${id}`);
              }}
            >
              <Sparkles className="h-4 w-4" /> Criar projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateEditor({ open, onOpenChange, template, isSuperAdmin }: { open: boolean; onOpenChange: (v: boolean) => void; template: Template | null; isSuperAdmin: boolean }) {
  const upsert = useUpsertTemplate();
  const [form, setForm] = React.useState<{ nome: string; descricao: string; categoria: string; is_global: boolean; colunas: string; tarefas: string }>({
    nome: '', descricao: '', categoria: '', is_global: false, colunas: 'Backlog\nEm execução\nConcluído', tarefas: '',
  });

  React.useEffect(() => {
    if (!open) return;
    if (template) {
      setForm({
        nome: template.nome,
        descricao: template.descricao ?? '',
        categoria: template.categoria ?? '',
        is_global: template.is_global,
        colunas: (template.dados?.colunas ?? []).map((c) => c.nome).join('\n'),
        tarefas: (template.dados?.tarefas ?? []).map((t) => `${t.titulo}${t.prioridade ? `|${t.prioridade}` : ''}`).join('\n'),
      });
    } else {
      setForm({ nome: '', descricao: '', categoria: '', is_global: false, colunas: 'Backlog\nEm execução\nConcluído', tarefas: '' });
    }
  }, [open, template]);

  const submit = async () => {
    if (!form.nome.trim()) return;
    const colunasArr = form.colunas.split('\n').map((l, i) => l.trim()).filter(Boolean).map((nome, i, arr) => ({
      nome, ordem: i, is_concluido: i === arr.length - 1,
    }));
    const tarefasArr = form.tarefas.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [titulo, prior] = l.split('|').map((x) => x.trim());
      return { titulo, prioridade: prior || 'media' };
    });
    await upsert.mutateAsync({
      id: template?.id,
      nome: form.nome.trim(),
      descricao: form.descricao || null as any,
      categoria: form.categoria || null as any,
      is_global: form.is_global,
      dados: { colunas: colunasArr, tarefas: tarefasArr },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar template' : 'Novo template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="compliance / auditoria / …" /></div>
          </div>
          <div><Label>Descrição</Label><Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
          {isSuperAdmin && (
            <div>
              <Label>Visibilidade</Label>
              <Select value={form.is_global ? 'global' : 'empresa'} onValueChange={(v) => setForm({ ...form, is_global: v === 'global' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empresa">Minha empresa</SelectItem>
                  <SelectItem value="global">Global (todas empresas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Colunas (1 por linha — a última é tratada como "concluído")</Label>
            <Textarea rows={4} value={form.colunas} onChange={(e) => setForm({ ...form, colunas: e.target.value })} />
          </div>
          <div>
            <Label>Tarefas iniciais (1 por linha, formato: <code>Título | prioridade</code>)</Label>
            <Textarea rows={6} value={form.tarefas} onChange={(e) => setForm({ ...form, tarefas: e.target.value })} placeholder={'Definir escopo | alta\nColetar evidências | media'} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={upsert.isPending}>Salvar template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
