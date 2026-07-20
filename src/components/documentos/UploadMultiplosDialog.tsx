import React, { useState } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Upload, FileText, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
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
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione pelo menos um arquivo.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.empresa_id) throw new Error('Empresa não encontrada');

      for (const file of files) {
        try {
          // Upload do arquivo ao storage
          const filePath = `${profile.empresa_id}/${Date.now()}_${file.name}`;
          const { error: storageError } = await supabase.storage
            .from('documentos')
            .upload(filePath, file);

          if (storageError) {
            // Se o bucket não existe, criar registro sem arquivo
            logger.warn('Erro no storage, criando registro sem arquivo', { error: storageError.message, module: 'documentos' });
          }

          const { data: publicUrl } = supabase.storage
            .from('documentos')
            .getPublicUrl(filePath);

          // Criar registro na tabela documentos
          const nomeBase = file.name.replace(/\.[^/.]+$/, '');
          const { error: dbError } = await supabase
            .from('documentos')
            .insert({
              empresa_id: profile.empresa_id,
              nome: nomeBase,
              tipo: 'outros',
              status: 'rascunho',
              arquivo_url: storageError ? null : publicUrl?.publicUrl,
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
          title: "Upload concluído",
          description: `${successCount} arquivo(s) enviado(s) com sucesso.${errorCount > 0 ? ` ${errorCount} erro(s).` : ''}`,
        });
        onSuccess();
        onOpenChange(false);
        setFiles([]);
      } else {
        toast({
          title: "Erro no upload",
          description: "Nenhum arquivo foi enviado com sucesso.",
          variant: "destructive",
        });
      }
    } catch (error) {
      logger.error('Erro geral no upload', { error: (error as Error)?.message, module: 'documentos' });
      toast({
        title: "Erro no upload",
        description: "Tente novamente em alguns instantes.",
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
      icon={Upload}
      title="Upload Múltiplo de Documentos"
      description='Selecione múltiplos arquivos para upload simultâneo. Os documentos serão criados com status "Rascunho".'
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleUpload} disabled={uploading || files.length === 0}>
            {uploading ? (
              <>
                <AkurisPulse size={16} className="mr-2" />
                Enviando...
              </>
            ) : (
              `Enviar ${files.length} arquivo(s)`
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
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground">
                  Clique para selecionar arquivos
                </p>
                <p className="text-sm text-muted-foreground">
                  ou arraste e solte os arquivos aqui
                </p>
              </div>
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Arquivos selecionados ({files.length})</h3>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
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
                      <X className="h-4 w-4" />
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
