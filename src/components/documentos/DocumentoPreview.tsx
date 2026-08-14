
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveItemStatusTone } from '@/lib/status-tone';
import { X, Download, ExternalLink, FileText, Image, File } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';
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
}

interface DocumentoPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: Documento;
}

export function DocumentoPreview({ open, onOpenChange, documento }: DocumentoPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  React.useEffect(() => {
    if (open && documento.arquivo_url) {
      loadPreview();
    } else if (open && documento.arquivo_url_externa) {
      setPreviewUrl(documento.arquivo_url_externa);
    }
  }, [open, documento.arquivo_url, documento.arquivo_url_externa]);

  const loadPreview = async () => {
    if (!documento.arquivo_url) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('documentos')
        .createSignedUrl(documento.arquivo_url, 3600); // 1 hora

      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (error) {
      console.error('Erro ao carregar preview:', error);
      toast({
        title: t('documentosExtras.preview.erroCarregarTitulo'),
        description: t('documentosExtras.preview.erroCarregarDesc'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!documento.arquivo_url) return;

    try {
      const { data, error } = await supabase.storage
        .from('documentos')
        .download(documento.arquivo_url);

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
      console.error('Erro ao baixar documento:', error);
      toast({
        title: t('documentosExtras.preview.erroBaixarTitulo'),
        description: t('documentosExtras.preview.erroBaixarDesc'),
        variant: "destructive",
      });
    }
  };

  const isExternal = !!documento.arquivo_url_externa && !documento.arquivo_url;
  const isImage = documento.arquivo_tipo?.startsWith('image/');
  const isPdf = documento.arquivo_tipo === 'application/pdf' || (isExternal && /\.pdf($|\?)/i.test(documento.arquivo_url_externa || ''));
  const canPreview = isImage || isPdf || isExternal;

  const getFileIcon = () => {
    if (isImage) return <Image className="h-8 w-8" />;
    if (isPdf) return <FileText className="h-8 w-8" />;
    return <File className="h-8 w-8" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return t('documentosExtras.preview.naoDisponivel');
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {getFileIcon()}
              {documento.nome}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{formatStatus(documento.tipo)}</Badge>
              <StatusBadge tone={resolveItemStatusTone(documento.status).tone}>
                {formatStatus(documento.status)}
              </StatusBadge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do arquivo */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-md">
            <div>
              <strong>{t('documentosExtras.preview.nomeArquivo')}</strong>
              <p className="text-sm text-muted-foreground">{documento.arquivo_nome}</p>
            </div>
            <div>
              <strong>{t('documentosExtras.preview.tamanho')}</strong>
              <p className="text-sm text-muted-foreground">{formatFileSize(documento.arquivo_tamanho)}</p>
            </div>
            <div>
              <strong>{t('documentosExtras.preview.tipo')}</strong>
              <p className="text-sm text-muted-foreground">{documento.arquivo_tipo}</p>
            </div>
            <div>
              <strong>{t('documentosExtras.preview.dataCriacao')}</strong>
              <p className="text-sm text-muted-foreground">
                {new Date(documento.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 border rounded-md overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <AkurisPulse size={48} />
              </div>
            ) : canPreview && previewUrl ? (
              <div className="h-96 overflow-auto">
                {isImage ? (
                  <img src={previewUrl} alt={documento.nome} className="w-full h-auto" />
                ) : (isPdf || isExternal) ? (
                  <iframe src={previewUrl} className="w-full h-full border-0" title={documento.nome} />
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                {getFileIcon()}
                <p className="mt-4">{t('documentosExtras.preview.previewIndisponivel')}</p>
                <p className="text-sm">{t('documentosExtras.preview.usarDownload')}</p>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              {t('documentosExtras.preview.fechar')}
            </Button>
            <div className="flex gap-2">
              {previewUrl && canPreview && (
                <Button
                  variant="outline"
                  onClick={() => window.open(previewUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('documentosExtras.preview.abrirNovaAba')}
                </Button>
              )}
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                {t('documentosExtras.preview.download')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
