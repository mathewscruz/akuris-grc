import React, { useState } from 'react';
import { IconClose, IconUpload, IconFile } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
;
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
interface Categoria {
  id: string;
  nome: string;
}

interface UploadMultiplosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  categorias: Categoria[];
}

export function UploadMultiplosDialog({ open, onOpenChange, onSuccess, categorias }: UploadMultiplosDialogProps) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFiles(selectedFiles);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: t('documentosExtras.uploadMultiplo.nenhumArquivoTitulo'),
        description: t('documentosExtras.uploadMultiplo.nenhumArquivoDesc'),
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('documentosExtras.uploadMultiplo.usuarioNaoAutenticado'));

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.empresa_id) throw new Error(t('documentosExtras.uploadMultiplo.empresaNaoEncontrada'));

      for (const file of files) {
        try {
          // Upload do arquivo ao storage (bucket privado — salvamos apenas o path)
          const filePath = `${profile.empresa_id}/${Date.now()}_${file.name}`;
          const { error: storageError } = await supabase.storage
            .from('documentos')
            .upload(filePath, file);

          if (storageError) {
            errorCount++;
            logger.error('Erro no storage', { error: storageError.message, module: 'documentos' });
            continue;
          }

          // Criar registro na tabela documentos — arquivo_url guarda o PATH (não URL pública)
          const nomeBase = file.name.replace(/\.[^/.]+$/, '');
          const { error: dbError } = await supabase
            .from('documentos')
            .insert({
              empresa_id: profile.empresa_id,
              nome: nomeBase,
              tipo: 'outros',
              status: 'rascunho',
              arquivo_url: filePath,
              arquivo_nome: file.name,
              arquivo_tipo: file.type,
              arquivo_tamanho: file.size,
              created_by: user.id,
            });

          if (dbError) {
            errorCount++;
            logger.error('Erro ao criar documento', { error: dbError.message, module: 'documentos' });
          } else {
            successCount++;
          }
        } catch (fileError) {
          errorCount++;
          logger.error(`Erro no arquivo ${file.name}`, { error: (fileError as Error)?.message, module: 'documentos' });
        }
      }

      if (successCount > 0) {
        toast({
          title: t('documentosExtras.uploadMultiplo.uploadConcluidoTitulo'),
          description: t('documentosExtras.uploadMultiplo.uploadConcluidoDesc')
            .replace('{sucesso}', String(successCount))
            .replace('{erros}', errorCount > 0 ? t('documentosExtras.uploadMultiplo.errosDesc').replace('{erros}', String(errorCount)) : ''),
        });
        onSuccess();
        onOpenChange(false);
        setFiles([]);
      } else {
        toast({
          title: t('documentosExtras.uploadMultiplo.erroUploadTitulo'),
          description: t('documentosExtras.uploadMultiplo.erroUploadDesc'),
          variant: "destructive",
        });
      }
    } catch (error) {
      logger.error('Erro geral no upload', { error: (error as Error)?.message, module: 'documentos' });
      toast({
        title: t('documentosExtras.uploadMultiplo.erroUploadTitulo'),
        description: t('documentosExtras.uploadMultiplo.erroUploadTenteNovamente'),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconUpload}
      title={t('documentosExtras.uploadMultiplo.titulo')}
      description={t('documentosExtras.uploadMultiplo.descricao')}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('documentosExtras.uploadMultiplo.cancelar')}
          </Button>
          <Button size="sm" onClick={handleUpload} disabled={uploading || files.length === 0}>
            {uploading ? (
              <>
                <AkurisPulse size={16} className="mr-2" />
                {t('documentosExtras.uploadMultiplo.enviando')}
              </>
            ) : (
              t('documentosExtras.uploadMultiplo.enviarArquivos').replace('{qtd}', String(files.length))
            )}
          </Button>
        </div>
      }
    >
        <div className="space-y-4">
          <div>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="multiple-files"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
            />
            <label htmlFor="multiple-files">
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors">
                <IconUpload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground">
                  {t('documentosExtras.uploadMultiplo.clickeSelecionar')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('documentosExtras.uploadMultiplo.arrasteSolte')}
                </p>
              </div>
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">{t('documentosExtras.uploadMultiplo.arquivosSelecionados').replace('{qtd}', String(files.length))}</h3>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <IconFile className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <IconClose className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
    </DialogShell>
  );
}
