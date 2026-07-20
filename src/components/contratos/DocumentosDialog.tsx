import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { FolderOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText, Upload, Download, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDateOnly } from '@/lib/date-utils';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Contrato {
  id: string;
  nome: string;
  numero_contrato: string;
}

interface Documento {
  id: string;
  nome: string;
  tipo: string;
  arquivo_url: string | null;
  arquivo_nome: string;
  arquivo_tipo: string;
  arquivo_tamanho: number;
  versao: number;
  is_current_version: boolean;
  data_upload: string;
  uploaded_by: string;
  descricao: string;
}

interface DocumentosDialogProps {
  contrato: Contrato | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentosDialog({ contrato, open, onOpenChange }: DocumentosDialogProps) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'contrato_principal',
    descricao: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; documento: Documento | null }>({
    open: false,
    documento: null
  });
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && contrato) {
      fetchDocumentos();
    }
  }, [open, contrato]);

  const fetchDocumentos = async () => {
    if (!contrato) return;

    try {
      const { data, error } = await supabase
        .from('contrato_documentos')
        .select('*')
        .eq('contrato_id', contrato.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocumentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!formData.nome) {
        setFormData({ ...formData, nome: file.name });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !selectedFile || !contrato) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos e selecione um arquivo",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Upload do arquivo
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${contrato.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('contrato-documentos')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Salvar dados do documento
      const { error: insertError } = await supabase
        .from('contrato_documentos')
        .insert([{
          contrato_id: contrato.id,
          nome: formData.nome,
          tipo: formData.tipo,
          arquivo_url: uploadData.path,
          arquivo_nome: selectedFile.name,
          arquivo_tipo: selectedFile.type,
          arquivo_tamanho: selectedFile.size,
          descricao: formData.descricao,
          uploaded_by: user?.id
        }]);

      if (insertError) throw insertError;

      toast({
        title: "Sucesso",
        description: "Documento enviado com sucesso",
      });

      resetForm();
      fetchDocumentos();
    } catch (error) {
      console.error('Erro ao enviar documento:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar documento",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documento: Documento) => {
    try {
      if (!documento.arquivo_url) return;

      const { data, error } = await supabase.storage
        .from('contrato-documentos')
        .download(documento.arquivo_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = documento.arquivo_nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar documento:', error);
      toast({
        title: "Erro",
        description: "Erro ao baixar documento",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (documento: Documento) => {
    setDeleteConfirm({ open: true, documento });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.documento) return;

    setDeleting(true);

    try {
      // Deletar arquivo do storage
      if (deleteConfirm.documento.arquivo_url) {
        await supabase.storage
          .from('contrato-documentos')
          .remove([deleteConfirm.documento.arquivo_url]);
      }

      // Deletar registro do banco
      const { error } = await supabase
        .from('contrato_documentos')
        .delete()
        .eq('id', deleteConfirm.documento.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Documento excluído com sucesso",
      });

      fetchDocumentos();
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir documento",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteConfirm({ open: false, documento: null });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo: 'contrato_principal',
      descricao: ''
    });
    setSelectedFile(null);
    setShowForm(false);
  };

  const getTipoBadge = (tipo: string) => {
    const tipoMap: Record<string, { tone: StatusTone; label: string }> = {
      contrato_principal: { tone: 'info', label: 'Contrato Principal' },
      aditivo: { tone: 'primary', label: 'Aditivo' },
      anexo: { tone: 'success', label: 'Anexo' },
      proposta: { tone: 'warning', label: 'Proposta' },
      outros: { tone: 'neutral', label: 'Outros' }
    };

    const tipoInfo = tipoMap[tipo] || { tone: 'neutral' as StatusTone, label: tipo };
    return <StatusBadge size="sm" tone={tipoInfo.tone}>{tipoInfo.label}</StatusBadge>;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!contrato) return null;

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        icon={FolderOpen}
        title={`Documentos — ${contrato.nome}`}
        description={`Gerencie documentos relacionados ao contrato ${contrato.numero_contrato}`}
        size="lg"
        hideFooter
      >
          <div className="space-y-4">
            {!showForm && (
              <div className="flex justify-end items-center">
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Documento
                </Button>
              </div>
            )}

            {showForm && (
              <Card>
                <CardHeader>
                  <CardTitle>Enviar Documento</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome do Documento *</Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                          placeholder="Ex: Contrato Principal v1.0"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tipo">Tipo</Label>
                        <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contrato_principal">Contrato Principal</SelectItem>
                            <SelectItem value="aditivo">Aditivo</SelectItem>
                            <SelectItem value="anexo">Anexo</SelectItem>
                            <SelectItem value="proposta">Proposta</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="arquivo">Arquivo *</Label>
                        <Input
                          id="arquivo"
                          type="file"
                          onChange={handleFileSelect}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Formatos aceitos: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (máx. 10MB)
                        </p>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="descricao">Descrição</Label>
                        <Textarea
                          id="descricao"
                          value={formData.descricao}
                          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                          placeholder="Descrição do documento..."
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={uploading}>
                        {uploading ? 'Enviando...' : 'Enviar'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {documentos.map((documento) => (
                <Card key={documento.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold">{documento.nome}</h3>
                          {documento.is_current_version && (
                            <StatusBadge size="sm" tone="success" variant="outline">Versão Atual</StatusBadge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{documento.descricao}</p>
                      </div>
                      <div className="flex gap-2">
                        {getTipoBadge(documento.tipo)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <span className="font-medium text-muted-foreground">Arquivo:</span>
                        <p>{documento.arquivo_nome}</p>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Tamanho:</span>
                        <p>{formatFileSize(documento.arquivo_tamanho)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Upload:</span>
                        <p>{formatDateOnly(documento.data_upload)}</p>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDownload(documento)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Baixar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteClick(documento)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {documentos.length === 0 && !showForm && (
              <Card>
                <CardContent className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum documento cadastrado</p>
                </CardContent>
              </Card>
            )}
          </div>
      </DialogShell>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title="Excluir Documento"
        description={`Tem certeza que deseja excluir o documento "${deleteConfirm.documento?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </>
  );
}
