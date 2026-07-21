import { useCallback, useEffect, useMemo, useState } from 'react';
import { Library, Plus, Search, FileText, ExternalLink, X, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { DialogShell } from '@/components/ui/dialog-shell';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EvidenceFormDialog, type EvidenceFormValues } from '@/components/evidencias/EvidenceFormDialog';
import { useEvidenceLibrary, type EvidenceLibraryItem } from '@/hooks/useEvidenceLibrary';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { akurisToast } from '@/lib/akuris-toast';

interface Props {
  /** Nome do módulo de origem, ex.: 'controles', 'incidentes'. */
  modulo: string;
  /** Id do registro (controle, incidente, etc.). */
  registroId: string;
}

/**
 * Painel de "Evidências da biblioteca" reaproveitável em qualquer módulo.
 * Lista as evidências vinculadas ao registro, permite anexar da biblioteca
 * central e criar uma nova evidência já vinculada.
 */
export function EvidenceLinksPanel({ modulo, registroId }: Props) {
  const { empresaId } = useEmpresaId();
  const lib = useEvidenceLibrary(empresaId);
  const [links, setLinks] = useState<Array<{ id: string; evidence: EvidenceLibraryItem }>>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Depende só da função estável (useCallback no hook), NÃO do objeto lib inteiro
  // — senão o useEffect de refresh dispara a cada render (loop infinito de fetch).
  const { fetchLinksForRecord } = lib;
  const refresh = useCallback(async () => {
    if (!empresaId || !registroId) return;
    setLoading(true);
    const data = await fetchLinksForRecord(modulo, registroId);
    setLinks(data);
    setLoading(false);
  }, [empresaId, registroId, modulo, fetchLinksForRecord]);

  useEffect(() => { refresh(); }, [refresh]);

  const attachedIds = useMemo(() => new Set(links.map((l) => l.evidence?.id)), [links]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lib.items.filter((it) => {
      if (attachedIds.has(it.id)) return false;
      if (!q) return true;
      return [it.nome, it.descricao, (it.tags || []).join(' ')]
        .filter(Boolean).some((t) => String(t).toLowerCase().includes(q));
    });
  }, [lib.items, attachedIds, search]);

  const attach = async (evidenceId: string) => {
    const ok = await lib.linkToRecord({ evidence_id: evidenceId, modulo, registro_id: registroId });
    if (ok) await refresh();
  };

  const detach = async (linkId: string) => {
    const ok = await lib.unlink(linkId);
    if (ok) await refresh();
  };

  const handleCreate = async (values: EvidenceFormValues, file: File | null): Promise<boolean> => {
    const created = await lib.uploadAndCreate({
      file,
      nome: values.nome,
      descricao: values.descricao,
      tags: values.tags,
      link_externo: values.link_externo || undefined,
    });
    if (!created) return false;
    await lib.linkToRecord({ evidence_id: created.id, modulo, registro_id: registroId });
    await refresh();
    akurisToast({ module: 'gap', tone: 'success', title: 'Evidência anexada', description: created.nome });
    return true;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Library className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <span className="text-sm font-medium">Evidências da biblioteca</span>
          <StatusBadge tone="neutral" size="sm">{links.length}</StatusBadge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { setSearch(''); setPickerOpen(true); }}>
            <Link2 className="h-4 w-4 mr-2" strokeWidth={1.5} /> Anexar da biblioteca
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova evidência
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center"><AkurisPulse size={32} /></div>
      ) : links.length === 0 ? (
        <EmptyState
          title="Nenhuma evidência vinculada"
          description="Anexe uma evidência já existente na biblioteca ou crie uma nova — ela fica reaproveitável em outros módulos."
        />
      ) : (
        <div className="space-y-2">
          {links.map((l) => {
            const ev = l.evidence;
            if (!ev) return null;
            const url = ev.link_externo || ev.arquivo_url;
            return (
              <div key={l.id} className="rounded-lg border border-border/60 bg-background p-2.5 flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  {ev.link_externo ? <ExternalLink className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} /> : <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium truncate hover:underline">{ev.nome}</a>
                    ) : (
                      <span className="text-sm font-medium truncate">{ev.nome}</span>
                    )}
                    {(ev.tags || []).slice(0, 3).map((t) => (
                      <StatusBadge key={t} tone="neutral" variant="outline" size="sm">{t}</StatusBadge>
                    ))}
                  </div>
                  {ev.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{ev.descricao}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => detach(l.id)} title="Desvincular">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Picker: anexar da biblioteca */}
      <DialogShell
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        icon={Library}
        title="Anexar evidência da biblioteca"
        description="Reaproveite uma evidência já cadastrada. Clique para vincular a este registro."
        size="md"
        hideFooter
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, descrição ou tag..." className="pl-9" />
          </div>
          {lib.loading ? (
            <div className="py-8 flex justify-center"><AkurisPulse size={32} /></div>
          ) : candidates.length === 0 ? (
            <EmptyState
              title={lib.items.length === 0 ? 'Biblioteca vazia' : 'Nada para anexar'}
              description={lib.items.length === 0 ? 'Crie a primeira evidência com "Nova evidência".' : 'Todas as evidências compatíveis já estão vinculadas ou não há resultados.'}
            />
          ) : (
            <ScrollArea className="max-h-[420px]">
              <div className="space-y-2 pr-2">
                {candidates.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => attach(it.id)}
                    className="w-full text-left rounded-lg border border-border/60 bg-background p-2.5 flex items-center gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                      {it.link_externo ? <ExternalLink className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} /> : <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{it.nome}</span>
                        {(it.total_links || 0) > 0 && <StatusBadge tone="neutral" size="sm">{it.total_links} uso{it.total_links === 1 ? '' : 's'}</StatusBadge>}
                        {(it.tags || []).slice(0, 3).map((t) => (
                          <StatusBadge key={t} tone="neutral" variant="outline" size="sm">{t}</StatusBadge>
                        ))}
                      </div>
                      {it.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{it.descricao}</p>}
                    </div>
                    <Link2 className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogShell>

      <EvidenceFormDialog open={formOpen} onOpenChange={setFormOpen} onSubmit={handleCreate} />
    </div>
  );
}
