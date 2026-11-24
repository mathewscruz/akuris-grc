import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconLink, IconDelete, IconAdd } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUsuariosEmpresa } from '@/hooks/useUsuariosEmpresa';
import { useTarefaEvidencias, useEvidenciaMutations, abrirEvidencia, type TarefaEvidencia } from '@/hooks/useProjetoExtras';
import { LIMITE_EVIDENCIA_BYTES, linkEvidenciaValido } from '@/lib/projeto-evidencias';
import { undoableAction } from '@/lib/undoable-action';
import { intlLocale } from '@/lib/date-utils';
import { toast } from 'sonner';

export function EvidenciasPanel({ tarefaId, projetoId }: { tarefaId: string; projetoId: string }) {
  const { t } = useLanguage();
  const { data: lista = [] } = useTarefaEvidencias(tarefaId);
  const { data: usuarios = [] } = useUsuariosEmpresa();
  const { enviarArquivo, adicionarLink, remover } = useEvidenciaMutations(tarefaId, projetoId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [url, setUrl] = useState('');
  const [nome, setNome] = useState('');
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const urlInvalida = url.length > 0 && !linkEvidenciaValido(url);

  const enviar = (files: FileList | null) => {
    Array.from(files ?? []).forEach((f) => {
      if (f.size > LIMITE_EVIDENCIA_BYTES) { toast.error(t('evidSemana.grande')); return; }
      enviarArquivo.mutate(f);
    });
  };
  const excluir = (ev: TarefaEvidencia) => {
    const mostrar = () => setOcultos((s) => { const n = new Set(s); n.delete(ev.id); return n; });
    void undoableAction({
      message: t('evidSemana.removida'), undoLabel: t('evidSemana.desfazer'),
      onHide: () => setOcultos((s) => new Set(s).add(ev.id)), onRestore: mostrar,
      onCommit: () => remover.mutateAsync(ev),
    }).catch(() => undefined);
  };
  const nomeDe = (id: string | null) => usuarios.find((u) => u.user_id === id)?.nome ?? '';

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); enviar(e.dataTransfer.files); }}
        className={`flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${arrastando ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
        <IconAdd className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{enviarArquivo.isPending ? t('evidSemana.enviando') : t('evidSemana.soltar')}</span>
        <span className="text-xs text-muted-foreground">{t('evidSemana.limite')}</span>
      </button>
      <input ref={inputRef} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt"
        onChange={(e) => { enviar(e.target.files); e.target.value = ''; }} />

      <form className="flex flex-wrap items-start gap-2" onSubmit={(e) => {
        e.preventDefault(); if (!linkEvidenciaValido(url)) return;
        adicionarLink.mutate({ url, nome }, { onSuccess: () => { setUrl(''); setNome(''); } });
      }}>
        <div className="min-w-[200px] flex-1">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('evidSemana.linkUrl')} aria-label={t('evidSemana.link')} aria-invalid={urlInvalida} className="h-9" />
          {urlInvalida && <p role="alert" className="pt-1 text-xs text-destructive">{t('evidSemana.linkInvalido')}</p>}
        </div>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('evidSemana.linkNome')} className="h-9 w-48" />
        <Button type="submit" size="sm" variant="outline" className="h-9" disabled={!url || urlInvalida || adicionarLink.isPending}>
          <IconLink className="mr-1 h-4 w-4" />{t('evidSemana.adicionar')}
        </Button>
      </form>

      {lista.filter((e) => !ocultos.has(e.id)).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('evidSemana.vazio')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {lista.filter((e) => !ocultos.has(e.id)).map((ev) => (
            <li key={ev.id} className="flex items-center gap-3 px-3 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-micro font-semibold uppercase text-muted-foreground">
                {ev.tipo_origem === 'link' ? <IconLink className="h-4 w-4" /> : (ev.nome.split('.').pop() ?? '').slice(0, 4)}
              </span>
              <button type="button" onClick={() => void abrirEvidencia(ev)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-foreground hover:text-primary">{ev.nome}</span>
                <span className="block text-xs text-muted-foreground">
                  {[nomeDe(ev.uploaded_by), new Date(ev.created_at).toLocaleDateString(intlLocale()), ev.tamanho_bytes ? `${(ev.tamanho_bytes / 1048576).toFixed(1)} MB` : null].filter(Boolean).join(' · ')}
                </span>
              </button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={t('evidSemana.remover')} onClick={() => excluir(ev)}>
                <IconDelete className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
