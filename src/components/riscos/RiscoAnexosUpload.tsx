import { logger } from '@/lib/logger';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, File, Download, Trash2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AnexoFile {
  id?: string;
  nome_arquivo: string;
  url_arquivo: string;
  tipo_arquivo?: string;
  tamanho_arquivo?: number;
  created_at?: string;
}

interface RiscoAnexosUploadProps {
  riscoId?: string;
  anexos: AnexoFile[];
  onAnexosChange: (anexos: AnexoFile[]) => void;
  tipoAnexo?: string;
  disabled?: boolean;
}

export function RiscoAnexosUpload({ 
  riscoId, 
  anexos, 
  onAnexosChange, 
  tipoAnexo = 'aceite',
  disabled = false 
}: RiscoAnexosUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo não permitido",
        description: "Apenas PDF, DOC, DOCX e imagens são permitidos.",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Upload para o bucket
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${riscoId || 'temp'}/${tipoAnexo}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('riscos-anexos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('riscos-anexos')
        .getPublicUrl(filePath);

      const novoAnexo: AnexoFile = {
        nome_arquivo: file.name,
        url_arquivo: publicUrl,
        tipo_arquivo: file.type,
        tamanho_arquivo: file.size,
        created_at: new Date().toISOString()
      };

      // Se temos um riscoId, salvar no banco
      if (riscoId) {
        // Buscar dados do usuário
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('user_id', userId)
          .single();

        const { data, error } = await supabase
          .from('riscos_anexos')
          .insert({
            risco_id: riscoId,
            nome_arquivo: file.name,
            url_arquivo: publicUrl,
            tipo_arquivo: file.type,
            tamanho_arquivo: file.size,
            tipo_anexo: tipoAnexo,
            empresa_id: profileData?.empresa_id,
            created_by: userId
          })
          .select()
          .single();

        if (error) throw error;
        novoAnexo.id = data.id;
      }

      onAnexosChange([...anexos, novoAnexo]);

      toast({
        title: "Arquivo enviado com sucesso",
        description: `${file.name} foi anexado aos anexos de aceite.`
      });

    } catch (error: any) {
      logger.error('Erro no upload:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Ocorreu um erro ao enviar o arquivo.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = async (anexo: AnexoFile, index: number) => {
    try {
      // Remover do storage
      const filePath = new URL(anexo.url_arquivo).pathname.split('/').slice(-3).join('/');
      await supabase.storage
        .from('riscos-anexos')
        .remove([filePath]);

      // Remover do banco se tem ID
      if (anexo.id) {
        const { error } = await supabase
          .from('riscos_anexos')
          .delete()
          .eq('id', anexo.id);

        if (error) throw error;
      }

      // Atualizar estado local
      const novosAnexos = anexos.filter((_, i) => i !== index);
      onAnexosChange(novosAnexos);

      toast({
        title: "Arquivo removido",
        description: `${anexo.nome_arquivo} foi removido dos anexos.`
      });

    } catch (error: any) {
      logger.error('Erro ao deletar anexo:', error);
      toast({
        title: "Erro ao remover arquivo",
        description: error.message || "Ocorreu um erro ao remover o arquivo.",
        variant: "destructive"
      });
    }
  };

  const handleFileDownload = (anexo: AnexoFile) => {
    window.open(anexo.url_arquivo, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div className="flex items-center gap-4">
        <input
          type="file"
          id="anexo-upload"
          className="hidden"
          onChange={handleFileUpload}
          disabled={uploading || disabled}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById('anexo-upload')?.click()}
          disabled={uploading || disabled}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Enviando...' : 'Adicionar Anexo'}
        </Button>
        <div className="text-sm text-muted-foreground">
          PDF, DOC, DOCX ou imagens (máx. 10MB)
        </div>
      </div>

      {/* Lista de Anexos */}
      {anexos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Anexos ({anexos.length})</h4>
          <div className="space-y-2">
            {anexos.map((anexo, index) => (
              <Card key={index} className="p-3">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {anexo.nome_arquivo}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {anexo.tipo_arquivo && (
                            <Badge variant="secondary" className="text-xs">
                              {anexo.tipo_arquivo.split('/')[1]?.toUpperCase()}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(anexo.tamanho_arquivo)}
                          </span>
                          {anexo.created_at && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(anexo.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFileDownload(anexo)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFileDownload(anexo)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {!disabled && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFileDelete(anexo, index)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}