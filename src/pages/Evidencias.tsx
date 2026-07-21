import { useMemo, useState } from 'react';
import { Library, Plus, Search, FileText, ExternalLink, Sparkles, Pencil, Trash2, Link2, Layers } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { EvidenceFormDialog, type EvidenceFormValues } from '@/components/evidencias/EvidenceFormDialog';
import { useEvidenceLibrary, type EvidenceLibraryItem } from '@/hooks/useEvidenceLibrary';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { akurisToast } from '@/lib/akuris-toast';

export default function Evidencias() {
  const { empresaId } = useEmpresaId();
  const lib = useEvidenceLibrary(empresaId);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EvidenceLibraryItem | null>(null);
  const [deleting, setDeleting] = useState<EvidenceLibraryItem | null>(null);
  const [matching, setMatching] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lib.items;
    return lib.items.filter((it) =>
      [it.nome, it.descricao, (it.tags || []).join(' '), it.arquivo_nome]
        .filter(Boolean).some((t) => String(t).toLowerCase().includes(q)));
  }, [lib.items, search]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (it: EvidenceLibraryItem) => { setEditing(it); setFormOpen(true); };

  const handleSubmit = async (values: EvidenceFormValues, file: File | null): Promise<boolean> => {
    if (editing) {
      return lib.updateEvidence(editing.id, {
        nome: values.nome,
        descricao: values.descricao || null,
        tags: values.tags,
        link_externo: values.link_externo || null,
      });
    }
    const created = await lib.uploadAndCreate({
      file,
      nome: values.nome,
      descricao: values.descricao,
      tags: values.tags,
      link_externo: values.link_externo || undefined,
    });
    return !!created;
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await lib.deleteEvidence(deleting.id);
    if (ok) akurisToast({ module: 'gap', tone: 'success', title: 'Evidência excluída', description: deleting.nome });
    setDeleting(null);
  };

  const runMatch = async (it: EvidenceLibraryItem) => {
    setMatching(it.id);
    try {
      const result = await lib.runCrossMatch(it.id);
      if (result && result.persisted > 0) {
        akurisToast({ module: 'gap', tone: 'success', title: 'Cruzamentos identificados', description: `${result.persisted} requisito(s) podem usar esta evidência.` });
      } else {
        akurisToast({ module: 'gap', tone: 'info', title: 'Nenhum cruzamento novo', description: 'A IA não encontrou outros requisitos compatíveis.' });
      }
    } finally {
      setMatching(null);
    }
  };

  const openArtifact = (it: EvidenceLibraryItem) => {
    const url = it.link_externo || it.arquivo_url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidências"
        description="Biblioteca central de evidências da empresa — arquivos e links reaproveitáveis entre todos os módulos de GRC."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Nova evidência
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total de evidências" value={lib.stats.total} icon={<Library />} variant="primary" loading={lib.loading} showAccent emptyHint="Adicione a primeira evidência reaproveitável." />
        <StatCard title="Em uso" value={lib.stats.com_links} icon={<Link2 />} variant="info" loading={lib.loading} />
        <StatCard title="Cruzamentos pendentes" value={lib.stats.com_sugestoes} icon={<Layers />} variant={lib.stats.com_sugestoes > 0 ? 'warning' : 'default'} loading={lib.loading} />
      </div>

      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, descrição ou tag..." className="pl-9" />
          </div>

          {lib.loading ? (
            <div className="py-12 flex justify-center"><AkurisPulse size={48} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              variant="illustrated"
              icon={<Library className="h-8 w-8" />}
              title={lib.items.length === 0 ? 'Sem evidências ainda' : 'Nenhum resultado'}
              description={lib.items.length === 0
                ? 'Cole um link ou faça upload de um arquivo. A evidência ficará disponível para reuso em qualquer módulo.'
                : 'Tente outro termo de busca.'}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((it) => (
                <div key={it.id} className="group rounded-lg border border-border/60 bg-background p-3 flex items-center gap-3 hover:border-primary/40 transition-colors">
                  <button
                    className="h-9 w-9 rounded-md bg-muted/50 flex items-center justify-center shrink-0 hover:bg-muted"
                    onClick={() => openArtifact(it)}
                    title={it.link_externo || it.arquivo_url ? 'Abrir' : 'Sem arquivo/link'}
                  >
                    {it.link_externo ? <ExternalLink className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} /> : <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{it.nome}</span>
                      {(it.total_links || 0) > 0 && <StatusBadge tone="neutral" size="sm">{it.total_links} uso{it.total_links === 1 ? '' : 's'}</StatusBadge>}
                      {(it.total_sugestoes || 0) > 0 && <StatusBadge tone="warning" size="sm">{it.total_sugestoes} pendente{it.total_sugestoes === 1 ? '' : 's'}</StatusBadge>}
                      {(it.tags || []).slice(0, 4).map((t) => (
                        <StatusBadge key={t} tone="neutral" variant="outline" size="sm">{t}</StatusBadge>
                      ))}
                    </div>
                    {it.descricao && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{it.descricao}</p>}
                  </div>
                  <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => runMatch(it)} disabled={matching === it.id}>
                    {matching === it.id ? <AkurisPulse size={16} /> : (<><Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} /> Cruzar com IA</>)}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(it)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleting(it)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EvidenceFormDialog open={formOpen} onOpenChange={setFormOpen} item={editing} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onConfirm={confirmDelete}
        title="Excluir evidência"
        description={`Tem certeza que deseja excluir "${deleting?.nome}"? Os vínculos com requisitos também serão removidos. Esta ação não pode ser desfeita.`}
        variant="destructive"
      />
    </div>
  );
}
