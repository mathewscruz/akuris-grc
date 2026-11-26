import { useMemo, useRef, useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconFile, IconDownload, IconSearch } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { estruturarDocumento, sumarioDe, contarPalavras } from './estrutura-documento';
import { abrirDocumentoAnalisado } from './autoria';

interface Props {
  analise: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function Realce({ texto, termo }: { texto: string; termo: string }) {
  if (!termo || termo.length < 2) return <>{texto}</>;
  const partes = texto.split(new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {partes.map((p, i) =>
        i % 2 ? <mark key={i} data-hit className="rounded-sm bg-primary/20 px-0.5 text-foreground">{p}</mark> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

export function DocumentoAnalisadoViewer({ analise, open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId() as any;
  const caminho = analise?.metadados_analise?.arquivo_storage as string | undefined;
  const [busca, setBusca] = useState('');
  const [hit, setHit] = useState(0);
  const corpo = useRef<HTMLDivElement>(null);

  const { data: texto, isLoading, error } = useQuery({
    queryKey: ['documento-analisado', empresaId, caminho],
    enabled: open && !!caminho && !!empresaId && caminho.startsWith(`${empresaId}/`),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('adherence-documents').download(caminho!);
      if (error || !data) throw error ?? new Error('download');
      return new TextDecoder('utf-8').decode(await data.arrayBuffer());
    },
  });

  const blocos = useMemo(() => estruturarDocumento(texto ?? ''), [texto]);
  const sumario = useMemo(() => sumarioDe(blocos), [blocos]);
  const palavras = useMemo(() => contarPalavras(texto ?? ''), [texto]);

  const irPara = (id: string) => corpo.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const proximo = () => {
    const hits = corpo.current?.querySelectorAll('mark[data-hit]');
    if (!hits?.length) return;
    const i = hit % hits.length;
    hits[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHit(i + 1);
  };
  const nHits = useMemo(() => {
    if (!texto || busca.length < 2) return 0;
    return (texto.match(new RegExp(busca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) ?? []).length;
  }, [texto, busca]);

  const nome = analise?.documento_nome || analise?.nome_analise || t('gapAnalysis.adherenceUi.view.viewer_title');
  const meta = [
    analise?.framework_nome,
    analise?.created_at ? formatDateOnly(analise.created_at) : null,
    palavras ? t('gapAnalysis.adherenceUi.view.viewer_words', { n: palavras.toLocaleString() }) : null,
    palavras ? t('gapAnalysis.adherenceUi.view.viewer_pages', { n: Math.max(1, Math.ceil(palavras / 450)) }) : null,
  ].filter(Boolean).join('  ·  ');

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      variant="side"
      size="2xl"
      icon={IconFile as any}
      eyebrow={t('gapAnalysis.adherenceUi.view.viewer_eyebrow')}
      title={nome}
      description={meta || t('gapAnalysis.adherenceUi.view.viewer_title')}
      hideFooter
      noScroll
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <div className="relative min-w-[220px] flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setHit(0); }}
              onKeyDown={(e) => e.key === 'Enter' && proximo()}
              placeholder={t('gapAnalysis.adherenceUi.view.viewer_search')}
              className="h-9 pl-9"
            />
          </div>
          {busca.length >= 2 && (
            <span className="text-xs text-muted-foreground">{t('gapAnalysis.adherenceUi.view.viewer_hits', { n: nHits })}</span>
          )}
          {nHits > 0 && <Button size="sm" variant="outline" onClick={proximo}>{t('gapAnalysis.adherenceUi.view.viewer_next')}</Button>}
          <Button size="sm" variant="outline" onClick={() => abrirDocumentoAnalisado(analise, t)} disabled={!caminho}>
            <IconDownload className="mr-1.5 h-4 w-4" />{t('gapAnalysis.adherenceUi.view.viewer_download')}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-16"><AkurisPulse size={32} /></div>
        ) : error || !caminho ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t('gapAnalysis.adherenceUi.view.openDocumentError')}</p>
        ) : (
          <div className="flex min-h-0 flex-1 gap-6 pt-4">
            {sumario.length > 1 && (
              <nav className="hidden w-52 shrink-0 overflow-y-auto pr-2 md:block">
                <p className="mb-2 text-micro font-semibold uppercase tracking-[0.11em] text-muted-foreground">{t('gapAnalysis.adherenceUi.view.viewer_contents')}</p>
                <ul className="space-y-0.5 border-l border-border/60">
                  {sumario.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => irPara(s.id)}
                        className={cn('-ml-px block w-full border-l border-transparent py-1 pr-1 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground', s.nivel === 2 ? 'pl-6 text-xs' : 'pl-3')}
                      >
                        {s.texto}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <div ref={corpo} className="min-w-0 flex-1 overflow-y-auto pb-10 pr-2">
              <article className="mx-auto max-w-[68ch] space-y-4 text-[15px] leading-7 text-foreground/90">
                {blocos.map((b, i) => {
                  if (b.tipo === 'titulo')
                    return b.nivel === 1 ? (
                      <h2 key={i} id={b.id} className="scroll-mt-4 border-b border-border/60 pb-2 pt-6 text-lg font-semibold text-foreground first:pt-0">
                        <Realce texto={b.texto} termo={busca} />
                      </h2>
                    ) : (
                      <h3 key={i} id={b.id} className="scroll-mt-4 pt-3 text-base font-semibold text-foreground">
                        <Realce texto={b.texto} termo={busca} />
                      </h3>
                    );
                  if (b.tipo === 'lista')
                    return (
                      <ul key={i} className="space-y-2 pl-1">
                        {b.itens.map((it, j) => (
                          <li key={j} className="flex gap-3">
                            <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                            <span><Realce texto={it} termo={busca} /></span>
                          </li>
                        ))}
                      </ul>
                    );
                  if (b.tipo === 'definicao')
                    return (
                      <p key={i} className="rounded-md border border-border/60 bg-muted/30 px-4 py-3">
                        <span className="font-semibold text-foreground"><Realce texto={b.termo} termo={busca} /></span>
                        <span className="text-muted-foreground"> — </span>
                        <Realce texto={b.texto} termo={busca} />
                      </p>
                    );
                  return <p key={i}><Realce texto={b.texto} termo={busca} /></p>;
                })}
              </article>
            </div>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
