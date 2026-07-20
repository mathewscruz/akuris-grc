import { useState } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUp, Download, Eye, Trash2, Upload, File } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EvidenciasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controleId: string;
  controleNome: string;
}

interface Evidencia {
  id: string;
  nome: string;
  descricao?: string;
  arquivo_url?: string;
  arquivo_nome?: string;
  arquivo_tamanho?: number;
  arquivo_tipo?: string;
  versao: number;
  is_current_version: boolean;
  created_at: string;
  created_by?: string;
}

export function EvidenciasDialog({ open, onOpenChange, controleId, controleNome }: EvidenciasDialogProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [novaEvidencia, setNovaEvidencia] = useState({
    nome: "",
    descricao: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar evidências do controle
  const { data: evidencias, isLoading } = useQuery({
    queryKey: ['controles-evidencias', controleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controles_evidencias')
        .select('*')
        .eq('controle_id', controleId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Evidencia[];
    },
    enabled: !!controleId
  });

  // Mutation para adicionar evidência
  const addEvidenciaMutation = useMutation({
    mutationFn: async (evidencia: any) => {
      const { error } = await supabase
        .from('controles_evidencias')
        .insert(evidencia);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles-evidencias', controleId] });
      setNovaEvidencia({ nome: "", descricao: "" });
      setUploadFile(null);
      toast({
        title: "Evidência adicionada",
        description: "A evidência foi adicionada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao adicionar evidência: " + error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation para deletar evidência
  const deleteEvidenciaMutation = useMutation({
    mutationFn: async (evidenciaId: string) => {
      const { error } = await supabase
        .from('controles_evidencias')
        .delete()
        .eq('id', evidenciaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles-evidencias', controleId] });
      toast({
        title: "Evidência removida",
        description: "A evidência foi removida com sucesso.",
      });
    }
  });

  const handleFileUpload = async () => {
    if (!uploadFile || !novaEvidencia.nome.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e selecione um arquivo.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Upload do arquivo para Supabase Storage
      const fileName = `${controleId}/${Date.now()}-${uploadFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('controles-evidencias')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      // Salvar metadados da evidência
      const evidenciaData = {
        controle_id: controleId,
        nome: novaEvidencia.nome,
        descricao: novaEvidencia.descricao,
        arquivo_url: fileName,
        arquivo_nome: uploadFile.name,
        arquivo_tamanho: uploadFile.size,
        arquivo_tipo: uploadFile.type,
        versao: 1,
        is_current_version: true
      };

      addEvidenciaMutation.mutate(evidenciaData);
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (evidencia: Evidencia) => {
    if (!evidencia.arquivo_url) return;

    try {
      const { data, error } = await supabase.storage
        .from('controles-evidencias')
        .download(evidencia.arquivo_url);

      if (error) throw error;

      // Criar URL para download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = evidencia.arquivo_nome || 'evidencia';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Erro no download",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FileUp}
      title="Gestão de Evidências"
      description={controleNome}
      size="lg"
      hideFooter
    >
        <Tabs defaultValue="evidencias">
          <TabsList>
            <TabsTrigger value="evidencias">Evidências</TabsTrigger>
            <TabsTrigger value="upload">Adicionar Evidência</TabsTrigger>
          </TabsList>

          <TabsContent value="evidencias" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">Carregando evidências...</div>
            ) : evidencias?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma evidência cadastrada para este controle.
              </div>
            ) : (
              <div className="space-y-4">
                {evidencias?.map((evidencia) => (
                  <Card key={evidencia.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{evidencia.nome}</CardTitle>
                          {evidencia.descricao && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {evidencia.descricao}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {evidencia.is_current_version && (
                            <Badge variant="default">Atual</Badge>
                          )}
                          <Badge variant="outline">v{evidencia.versao}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <File className="h-4 w-4" />
                            {evidencia.arquivo_nome || 'Arquivo não disponível'}
                          </div>
                          <span>{formatFileSize(evidencia.arquivo_tamanho)}</span>
                          <span>{new Date(evidencia.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(evidencia)}
                            disabled={!evidencia.arquivo_url}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteEvidenciaMutation.mutate(evidencia.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome da Evidência *</Label>
                <Input
                  id="nome"
                  value={novaEvidencia.nome}
                  onChange={(e) => setNovaEvidencia(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Relatório de Teste - Janeiro 2024"
                />
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={novaEvidencia.descricao}
                  onChange={(e) => setNovaEvidencia(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descreva o conteúdo da evidência..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="arquivo">Arquivo *</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    id="arquivo"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  />
                  <label htmlFor="arquivo" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-700">
                      {uploadFile ? uploadFile.name : "Clique para selecionar arquivo"}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      PDF, DOC, XLS, PNG, JPG (máx. 10MB)
                    </p>
                  </label>
                </div>
              </div>

              <Button 
                onClick={handleFileUpload} 
                disabled={addEvidenciaMutation.isPending}
                className="w-full"
              >
                {addEvidenciaMutation.isPending ? "Enviando..." : "Adicionar Evidência"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
    </DialogShell>
  );
}