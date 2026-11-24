import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconLink, IconDelete, IconAdd } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUsuariosEmpresa } from '@/hooks/useUsuariosEmpresa';
import { useTarefaEvidencias, useEvidenciaMutations, abrirEvidencia, useAnexoLigacoes, useLigarAnexo, type TarefaEvidencia, type AlvoEvidencia } from '@/hooks/useProjetoExtras';
import { useTarefaVinculos } from '@/hooks/useProjetoTarefas';
import { useAuth } from '@/components/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { IconFileText } from '@/components/icons';
import { LIMITE_EVIDENCIA_BYTES, linkEvidenciaValido } from '@/lib/projeto-evidencias';
import { undoableAction } from '@/lib/undoable-action';
import { intlLocale } from '@/lib/date-utils';
import { toast } from 'sonner';

export function EvidenciasPanel({ tarefaId, projetoId }: { tarefaId: string; projetoId: string }) {
  const { t } = useLanguage();
  const { data: lista = [] } = useTarefaEvidencias(tarefaId);
  const { data: usuarios = [] } = useUsuariosEmpresa();
  const { enviarArquivo, adicionarLink, adicionarDocumento, remover } = useEvidenciaMutations(tarefaId, projetoId);
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const [docAberto, setDocAberto] = useState(false);
  const { data: documentos = [] } = useQuery({
    queryKey: ['evid-docs-empresa', empresaId],
    enabled: !!empresaId && docAberto,
    queryFn: async () => {
      const { data } = await supabase.from('documentos').select('id, nome, status').eq('empresa_id', empresaId!).order('nome').limit(500);
      return (data ?? []) as { id: string; nome: string; status: string | null }[];
    },
  });
  // Requisitos/controlos ligados à tarefa: candidatos a reaproveitar a evidência.
  const { data: vinculos = [] } = useTarefaVinculos(tarefaId);
  const alvosBrutos = (vinculos as any[]).filter((v) => v.entidade_tipo === 'gap_requirement' || v.entidade_tipo === 'controle');
  const { data: nomesAlvos = {} } = useQuery({
    queryKey: ['evid-alvos-nomes', empresaId, alvosBrutos.map((v) => v.entidade_id).join(',')],
    enabled: alvosBrutos.length > 0 && !!empresaId,
    queryFn: async () => {
      const out: Record<string, string> = {};
      const req = alvosBrutos.filter((v) => v.entidade_tipo === 'gap_requirement').map((v) => v.entidade_id);
      const ctl = alvosBrutos.filter((v) => v.entidade_tipo === 'controle').map((v) => v.entidade_id);
      if (req.length) { const { data } = await supabase.from('gap_analysis_requirements').select('id, codigo, titulo').in('id', req); (data ?? []).forEach((r: any) => { out[r.id] = [r.codigo, r.titulo].filter(Boolean).join(' · '); }); }
      if (ctl.length) { const { data } = await supabase.from('controles').select('id, codigo, nome').eq('empresa_id', empresaId!).in('id', ctl); (data ?? []).forEach((r: any) => { out[r.id] = [r.codigo, r.nome].filter(Boolean).join(' · '); }); }
      return out;
    },
  });
  const alvos: (AlvoEvidencia & { nome: string })[] = alvosBrutos
    .filter((v) => nomesAlvos[v.entidade_id])
    .map((v) => ({ tipo: v.entidade_tipo === 'controle' ? 'controle' : 'requisito', id: v.entidade_id, nome: nomesAlvos[v.entidade_id] }));
  const { data: ligacoes = [] } = useAnexoLigacoes(alvos.length ? tarefaId : undefined);
  const ligar = useLigarAnexo(tarefaId);
  const ligado = (anexoId: string, a: AlvoEvidencia) => ligacoes.some((l) => l.anexo_id === anexoId && (a.tipo === 'requisito' ? l.requirement_id === a.id : l.controle_id === a.id));
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
        <Popover open={docAberto} onOpenChange={setDocAberto}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-9"><IconFileText className="mr-1 h-4 w-4" />{t('evidSemana.doAkuris')}</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <Command>
              <CommandInput placeholder={t('evidSemana.buscarDocumento')} />
              <CommandList>
                <CommandEmpty>{t('evidSemana.semDocumentos')}</CommandEmpty>
                {documentos.map((d) => (
                  <CommandItem key={d.id} value={`${d.nome} ${d.id}`} onSelect={() => { adicionarDocumento.mutate({ id: d.id, nome: d.nome }); setDocAberto(false); }}>
                    <span className="truncate">{d.nome}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </form>

      {lista.filter((e) => !ocultos.has(e.id)).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('evidSemana.vazio')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {lista.filter((e) => !ocultos.has(e.id)).map((ev) => (
            <li key={ev.id} className="flex items-center gap-3 px-3 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-micro font-semibold uppercase text-muted-foreground">
                {ev.tipo_origem === 'link' ? <IconLink className="h-4 w-4" /> : ev.tipo_origem === 'documento' ? <IconFileText className="h-4 w-4" /> : (ev.nome.split('.').pop() ?? '').slice(0, 4)}
              </span>
              <div className="min-w-0 flex-1">
              <button type="button" onClick={() => void abrirEvidencia(ev)} className="block w-full text-left">
                <span className="block truncate text-sm font-medium text-foreground hover:text-primary">{ev.nome}</span>
                <span className="block text-xs text-muted-foreground">
                  {[nomeDe(ev.uploaded_by), new Date(ev.created_at).toLocaleDateString(intlLocale()), ev.tamanho_bytes ? `${(ev.tamanho_bytes / 1048576).toFixed(1)} MB` : null].filter(Boolean).join(' · ')}
                </span>
              </button>
                {alvos.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {alvos.map((a) => (
                      <label key={a.id} className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox checked={ligado(ev.id, a)} onCheckedChange={(v) => ligar.mutate({ anexoId: ev.id, alvo: a, ligar: !!v })} className="h-3.5 w-3.5" />
                        <span className="max-w-[220px] truncate">{t(a.tipo === 'requisito' ? 'evidSemana.usarRequisito' : 'evidSemana.usarControle', { nome: a.nome })}</span>
                      </label>
                    ))}
                  </span>
                )}
              </div>
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
