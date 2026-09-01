import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconClose, IconDownload, IconExternal, IconFile, IconImage } from '@/components/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveItemStatusTone } from '@/lib/status-tone';
import DOMPurify from 'dompurify';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { DocGenMarkdown } from '@/components/documentos/DocGenMarkdown';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';

interface Documento {
  id: string;
  nome: string;
  arquivo_url?: string;
  arquivo_url_externa?: string;
  arquivo_nome?: string;
  arquivo_tipo?: string;
  arquivo_tamanho?: number;
  tipo: string;
  status: string;
  created_at: string;
  descricao?: string | null;
}

interface DocumentoPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: Documento;
}

interface GeneratedSection {
  nome?: string;
  titulo?: string;
  conteudo?: string;
}

type PreviewKind = 'pdf' | 'image' | 'word' | 'text' | 'markdown' | 'external' | 'unknown';

function extensionOf(...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const clean = candidate.split('?')[0].split('#')[0];
    const match = /\.([a-z0-9]+)$/i.exec(clean);
    if (match) return match[1].toLowerCase();
  }
  return '';
}

function resolveKind(documento: Documento): PreviewKind {
  const mime = (documento.arquivo_tipo || '').toLowerCase();
  const ext = extensionOf(documento.arquivo_nome, documento.arquivo_url, documento.arquivo_url_externa);

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (
    mime.includes('officedocument.wordprocessingml') ||
    mime === 'application/msword' ||
    ['docx', 'doc'].includes(ext)
  ) {
    return 'word';
  }
  if (mime === 'text/markdown' || ['md', 'markdown'].includes(ext)) return 'markdown';
  if (mime.startsWith('text/') || mime === 'application/json' || ['txt', 'csv', 'json', 'log'].includes(ext)) {
    return 'text';
  }
  if (!documento.arquivo_url && documento.arquivo_url_externa) return 'external';
  return 'unknown';
}

export function DocumentoPreview({ open, onOpenChange, documento }: DocumentoPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [wordHtml, setWordHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [secoes, setSecoes] = useState<GeneratedSection[] | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const hasFile = !!documento.arquivo_url || !!documento.arquivo_url_externa;
  const kind = useMemo(() => resolveKind(documento), [documento]);

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    releaseObjectUrl();
    setObjectUrl(null);
    setExternalUrl(null);
    setTextContent(null);
    setWordHtml(null);
    setSecoes(null);
    setFailed(false);
  }, [releaseObjectUrl]);

  const loadGenerated = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('docgen_generated_docs')
        .select('conteudo')
        .eq('documento_id', documento.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const conteudo = (data?.conteudo ?? null) as { secoes?: GeneratedSection[] } | null;
      setSecoes(conteudo?.secoes?.length ? conteudo.secoes : null);
    } catch (error) {
      logger.error('Erro ao carregar conteúdo gerado', error);
      setSecoes(null);
    }
  }, [documento.id]);

  const loadStoredFile = useCallback(async () => {
    if (!documento.arquivo_url) return;
    try {
      // Download the blob so PDFs/Word render inline regardless of content-disposition.
      const { data, error } = await supabase.storage.from('documentos').download(documento.arquivo_url);
      if (error || !data) throw error ?? new Error('empty file');

      if (kind === 'word') {
        try {
          const mammoth = await import('mammoth');
          const buffer = await data.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
          setWordHtml(DOMPurify.sanitize(result.value || ''));
          return;
        } catch (conversionError) {
          logger.error('Erro ao converter DOCX', conversionError);
          setFailed(true);
          return;
        }
      }

      if (kind === 'text' || kind === 'markdown') {
        setTextContent(await data.text());
        return;
      }

      const blob = kind === 'pdf' ? new Blob([data], { type: 'application/pdf' }) : data;
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setObjectUrl(url);
    } catch (error) {
      logger.error('Erro ao carregar preview', error);
      setFailed(true);
      toast({
        title: t('documentosExtras.preview.erroCarregarTitulo'),
        description: t('documentosExtras.preview.erroCarregarDesc'),
        variant: 'destructive',
      });
    }
  }, [documento.arquivo_url, kind, t, toast]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }

    let cancelled = false;
    reset();
    setLoading(true);

    (async () => {
      if (documento.arquivo_url) {
        await loadStoredFile();
      } else if (documento.arquivo_url_externa) {
        setExternalUrl(documento.arquivo_url_externa);
      } else {
        await loadGenerated();
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documento.id, documento.arquivo_url, documento.arquivo_url_externa]);

  useEffect(() => releaseObjectUrl, [releaseObjectUrl]);

  const handleDownload = async () => {
    if (documento.arquivo_url_externa && !documento.arquivo_url) {
      window.open(documento.arquivo_url_externa, '_blank', 'noopener');
      return;
    }

    if (!documento.arquivo_url) {
      if (!secoes?.length) return;
      const md = secoes
        .map((s) => `## ${s.nome || s.titulo || ''}\n\n${s.conteudo || ''}`)
        .join('\n\n');
      const blob = new Blob([`# ${documento.nome}\n\n${md}`], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documento.nome}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    try {
      const { data, error } = await supabase.storage.from('documentos').download(documento.arquivo_url);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = documento.arquivo_nome || documento.nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: t('documentosExtras.preview.downloadIniciadoTitulo'),
        description: t('documentosExtras.preview.downloadIniciadoDesc'),
      });
    } catch (error) {
      logger.error('Erro ao baixar documento', error);
      toast({
        title: t('documentosExtras.preview.erroBaixarTitulo'),
        description: t('documentosExtras.preview.erroBaixarDesc'),
        variant: 'destructive',
      });
    }
  };

  const openInNewTab = () => {
    const url = objectUrl || externalUrl;
    if (url) window.open(url, '_blank', 'noopener');
  };

  const getFileIcon = (className = 'h-5 w-5') => {
    if (kind === 'image') return <IconImage className={className} />;
    if (kind === 'pdf' || kind === 'word' || !hasFile) return <IconFile className={className} />;
    return <IconFile className={className} />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  };

  const metaItems = [
    documento.arquivo_nome,
    formatFileSize(documento.arquivo_tamanho),
    documento.arquivo_tipo,
    new Date(documento.created_at).toLocaleDateString(),
  ].filter(Boolean) as string[];

  const canDownload = hasFile || !!secoes?.length;
  const canOpenTab = !!(objectUrl || externalUrl);

  const renderBody = () => {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center">
          <AkurisPulse size={48} />
        </div>
      );
    }

    if (kind === 'image' && objectUrl) {
      return (
        <div className="h-full overflow-auto p-4">
          <img src={objectUrl} alt={documento.nome} className="mx-auto h-auto max-w-full rounded-md" />
        </div>
      );
    }

    if (objectUrl && (kind === 'pdf' || kind === 'unknown')) {
      return (
        <object data={objectUrl} type="application/pdf" className="h-full w-full">
          <iframe src={objectUrl} className="h-full w-full border-0" title={documento.nome} />
        </object>
      );
    }

    if (externalUrl) {
      return <iframe src={externalUrl} className="h-full w-full border-0" title={documento.nome} />;
    }

    if (wordHtml !== null) {
      return (
        <div className="h-full overflow-auto">
          <article
            className="prose prose-sm dark:prose-invert mx-auto max-w-3xl bg-card px-8 py-10 my-6 rounded-md border border-border shadow-sm dark:shadow-none"
            dangerouslySetInnerHTML={{ __html: wordHtml }}
          />
        </div>
      );
    }

    if (textContent !== null) {
      return (
        <div className="h-full overflow-auto">
          <article className="mx-auto max-w-3xl bg-card px-8 py-10 my-6 rounded-md border border-border shadow-sm dark:shadow-none">
            {kind === 'markdown' ? (
              <DocGenMarkdown content={textContent} />
            ) : (
              <pre className="whitespace-pre-wrap break-words text-sm text-foreground">{textContent}</pre>
            )}
          </article>
        </div>
      );
    }

    if (secoes?.length) {
      return (
        <div className="h-full overflow-auto">
          <article className="mx-auto max-w-3xl space-y-6 bg-card px-8 py-10 my-6 rounded-md border border-border shadow-sm dark:shadow-none">
            <h1 className="text-2xl font-semibold text-foreground">{documento.nome}</h1>
            {secoes.map((secao, index) => (
              <section key={index} className="space-y-2">
                {(secao.nome || secao.titulo) && (
                  <h2 className="text-base font-semibold text-foreground">{secao.nome || secao.titulo}</h2>
                )}
                <DocGenMarkdown content={secao.conteudo || ''} />
              </section>
            ))}
          </article>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
        {getFileIcon('h-10 w-10 opacity-60')}
        <p className="text-sm font-medium text-foreground">
          {hasFile
            ? failed && kind === 'word'
              ? t('documentosExtras.preview.erroConverterDocx')
              : t('documentosExtras.preview.previewIndisponivel')
            : t('documentosExtras.preview.semConteudo')}
        </p>
        <p className="text-xs">
          {hasFile
            ? t('documentosExtras.preview.usarDownload')
            : t('documentosExtras.preview.semConteudoAjuda')}
        </p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-6xl h-[92vh] p-0 sm:p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-lg truncate">
                {getFileIcon()}
                <span className="truncate">{documento.nome}</span>
              </DialogTitle>
              {metaItems.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground truncate">{metaItems.join(' · ')}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary">{formatStatus(documento.tipo)}</Badge>
              <StatusBadge tone={resolveItemStatusTone(documento.status).tone}>
                {formatStatus(documento.status)}
              </StatusBadge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-card border border-border">{renderBody()}</div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <IconClose className="h-4 w-4 mr-2" />
            {t('documentosExtras.preview.fechar')}
          </Button>
          <div className="flex gap-2">
            {canOpenTab && (
              <Button variant="outline" onClick={openInNewTab}>
                <IconExternal className="h-4 w-4 mr-2" />
                {t('documentosExtras.preview.abrirNovaAba')}
              </Button>
            )}
            {canDownload && (
              <Button onClick={handleDownload}>
                <IconDownload className="h-4 w-4 mr-2" />
                {t('documentosExtras.preview.download')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
