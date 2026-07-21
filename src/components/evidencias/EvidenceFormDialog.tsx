import { useEffect, useMemo, useRef, useState } from 'react';
import { Library, Upload, FileText, X } from 'lucide-react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import type { EvidenceLibraryItem } from '@/hooks/useEvidenceLibrary';

export interface EvidenceFormValues {
  nome: string;
  descricao: string;
  tags: string[];
  link_externo: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente => modo edição (metadados); ausente => modo criação (permite arquivo). */
  item?: EvidenceLibraryItem | null;
  onSubmit: (values: EvidenceFormValues, file: File | null) => Promise<boolean>;
}

const parseTags = (text: string): string[] =>
  text.split(',').map((t) => t.trim()).filter(Boolean);

export function EvidenceFormDialog({ open, onOpenChange, item, onSubmit }: Props) {
  const isEdit = !!item;
  const fileRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [linkExterno, setLinkExterno] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(item?.nome ?? '');
    setDescricao(item?.descricao ?? '');
    setTagsText((item?.tags ?? []).join(', '));
    setLinkExterno(item?.link_externo ?? '');
    setFile(null);
  }, [open, item]);

  const dirty = useMemo(() => {
    if (!open) return false;
    return (
      nome !== (item?.nome ?? '') ||
      descricao !== (item?.descricao ?? '') ||
      tagsText !== (item?.tags ?? []).join(', ') ||
      linkExterno !== (item?.link_externo ?? '') ||
      !!file
    );
  }, [open, nome, descricao, tagsText, linkExterno, file, item]);

  const handleSubmit = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    const ok = await onSubmit(
      { nome: nome.trim(), descricao: descricao.trim(), tags: parseTags(tagsText), link_externo: linkExterno.trim() },
      file,
    );
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Library}
      title={isEdit ? 'Editar evidência' : 'Nova evidência'}
      description={isEdit
        ? 'Atualize os metadados desta evidência da biblioteca.'
        : 'Adicione um arquivo ou um link. A evidência fica reaproveitável em qualquer módulo.'}
      size="md"
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Salvar' : 'Adicionar'}
      isSubmitting={saving}
      submitDisabled={!nome.trim()}
      isDirty={dirty}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ev-nome">Nome <span className="text-destructive">*</span></Label>
          <Input id="ev-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Política de Backup assinada" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ev-desc">Descrição</Label>
          <Textarea id="ev-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Contexto, período de vigência, responsável..." />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ev-tags">Tags</Label>
          <Input id="ev-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Separadas por vírgula: iso27001, backup, 2026" />
          {parseTags(tagsText).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {parseTags(tagsText).map((t) => (
                <StatusBadge key={t} tone="neutral" variant="outline" size="sm">{t}</StatusBadge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ev-link">Link externo</Label>
          <Input id="ev-link" value={linkExterno} onChange={(e) => setLinkExterno(e.target.value)} placeholder="https://... (Google Drive, SharePoint, painel de nuvem)" />
        </div>

        {!isEdit && (
          <div className="space-y-1.5">
            <Label>Arquivo</Label>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="truncate flex-1">{file.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" strokeWidth={1.5} /> Selecionar arquivo
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Opcional. Arquivos idênticos são deduplicados por hash.</p>
          </div>
        )}

        {isEdit && item?.arquivo_nome && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{item.arquivo_nome}</span>
            <span className="text-xs">(arquivo não editável — crie uma nova evidência para substituir)</span>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
