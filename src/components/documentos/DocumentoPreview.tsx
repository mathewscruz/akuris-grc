import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveItemStatusTone } from '@/lib/status-tone';
import { X, Download, ExternalLink, FileText, Image as ImageIcon, File } from 'lucide-react';
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

export function DocumentoPreview({ open, onOpenChange, documento }: DocumentoPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secoes, setSecoes] = useState<GeneratedSection[] | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const hasFile = !!documento.arquivo_url || !!documento.arquivo_url_externa;

  const loadPreview = useCallback(async () => {
    if (!documento.arquivo_url) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('documentos')
        .createSignedUrl(documento.arquivo_url, 3600);
      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (error) {
      logger.error('Erro ao carregar preview', error);
      toast({
        title: t('documentosExtras.preview.erroCarregarTitulo'),
        description: t('documentosExtras.preview.erroCarregarDesc'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [documento.arquivo_url, t, toast]);

  const loadGenerated = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [documento.id]);

  useEffect(() => {
    if (!open) {
      setPreviewUrl(null);
      setSecoes(null);
      return;
    }
    if (documento.arquivo_url) {
      loadPreview();
    } else if (documento.arquivo_url_externa) {
      setPreviewUrl(documento.arquivo_url_externa);
    } else {
      loadGenerated();
    }
  }, [open, documento.arquivo_url, documento.arquivo_url_externa, loadPreview, loadGenerated]);

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

  const isExternal = !!documento.arquivo_url_externa && !documento.arquivo_url;
  const isImage = documento.arquivo_tipo?.startsWith('image/');
  const isPdf =
    documento.arquivo_tipo === 'application/pdf' ||
    (isExternal && /\.pdf($|\?)/i.test(documento.arquivo_url_externa || ''));
  const canPreview = isImage || isPdf || isExternal;

  const getFileIcon = (className = 'h-5 w-5') => {
    if (isImage) return <ImageIcon className={className} />;
    if (isPdf || !hasFile) return <FileText className={className} />;
    return <File className={className} />;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
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

        <div className="flex-1 min-h-0 bg-muted/30">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <AkurisPulse size={48} />
            </div>
          ) : canPreview && previewUrl ? (
            isImage ? (
              <div className="h-full overflow-auto p-4">
                <img src={previewUrl} alt={documento.nome} className="mx-auto h-auto max-w-full rounded-md" />
              </div>
            ) : (
              <iframe src={previewUrl} className="h-full w-full border-0" title={documento.nome} />
            )
          ) : secoes?.length ? (
            <div className="h-full overflow-auto">
              <article className="mx-auto max-w-3xl space-y-6 bg-card px-8 py-10 my-6 rounded-md border border-border shadow-sm">
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
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
              {getFileIcon('h-10 w-10 opacity-60')}
              <p className="text-sm font-medium text-foreground">
                {hasFile
                  ? t('documentosExtras.preview.previewIndisponivel')
                  : t('documentosExtras.preview.semConteudo')}
              </p>
              <p className="text-xs">
                {hasFile
                  ? t('documentosExtras.preview.usarDownload')
                  : t('documentosExtras.preview.semConteudoAjuda')}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            {t('documentosExtras.preview.fechar')}
          </Button>
          <div className="flex gap-2">
            {previewUrl && canPreview && (
              <Button variant="outline" onClick={() => window.open(previewUrl, '_blank', 'noopener')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('documentosExtras.preview.abrirNovaAba')}
              </Button>
            )}
            {canDownload && (
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                {t('documentosExtras.preview.download')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
