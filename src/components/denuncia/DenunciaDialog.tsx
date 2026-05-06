import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveGravidadeTone } from '@/lib/status-tone';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Calendar, 
  User, 
  Mail, 
  Shield, 
  FileText, 
  History,
  UserCheck,
  Save,
  Download,
  Upload,
  MessageSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateOnly } from '@/lib/date-utils';
import { useIntegrationNotify } from '@/hooks/useIntegrationNotify';

interface DenunciaDialogProps {
  denuncia: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDenunciaAtualizada: () => void;
}

interface Movimentacao {
  id: string;
  acao: string;
  status_anterior?: string;
  status_novo?: string;
  observacoes?: string;
  created_at: string;
  usuario?: {
    nome: string;
  } | null;
}

interface Anexo {
  id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  tamanho_arquivo: number;
  arquivo_url: string;
  tipo_anexo: string;
  created_at: string;
}

const statusOptions = [
  { value: 'nova', label: 'Nova' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'em_investigacao', label: 'Em Investigação' },
  { value: 'resolvida', label: 'Resolvida' },
  { value: 'arquivada', label: 'Arquivada' }
];

export function DenunciaDialog({ 
  denuncia, 
  open, 
  onOpenChange, 
  onDenunciaAtualizada 
}: DenunciaDialogProps) {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { notify } = useIntegrationNotify();
  const { empresaId } = useEmpresaId();

  const [formData, setFormData] = useState({
    status: denuncia.status,
    responsavel_id: denuncia.responsavel_id || '',
    observacoes: '',
    parecer_final: denuncia.parecer_final || ''
  });

  useEffect(() => {
    if (open && denuncia) {
      carregarDados();
    }
  }, [open, denuncia]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar movimentações
      const { data: movData } = await supabase
        .from('denuncias_movimentacoes')
        .select('*')
        .eq('denuncia_id', denuncia.id)
        .order('created_at', { ascending: false });

      setMovimentacoes(movData || []);

      // Carregar anexos
      const { data: anexosData } = await supabase
        .from('denuncias_anexos')
        .select('*')
        .eq('denuncia_id', denuncia.id)
        .order('created_at', { ascending: false });

      setAnexos(anexosData || []);

      // Carregar usuários para atribuição (filtrado por empresa)
      let usersQuery = supabase
        .from('profiles')
        .select('user_id, nome, role')
        .in('role', ['admin', 'super_admin'])
        .order('nome');
      if (empresaId) usersQuery = usersQuery.eq('empresa_id', empresaId);
      const { data: usersData } = await usersQuery;

      setUsuarios(usersData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    setSaving(true);
    try {
      const statusAnterior = denuncia.status;
      const statusNovo = formData.status;

      // Atualizar denúncia
      const updateData: any = {
        status: formData.status,
        responsavel_id: formData.responsavel_id || null,
        parecer_final: formData.parecer_final
      };

      // Definir datas baseadas no status
      if (statusNovo === 'em_analise' && statusAnterior === 'nova') {
        updateData.data_atribuicao = new Date().toISOString();
      }
      if (statusNovo === 'em_investigacao' && statusAnterior !== 'em_investigacao') {
        updateData.data_inicio_investigacao = new Date().toISOString();
      }
      if (['resolvida', 'arquivada'].includes(statusNovo) && !['resolvida', 'arquivada'].includes(statusAnterior)) {
        updateData.data_conclusao = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('denuncias')
        .update(updateData)
        .eq('id', denuncia.id);

      if (updateError) throw updateError;

      // Registrar movimentação se houver mudança de status ou observações
      if (statusAnterior !== statusNovo || formData.observacoes) {
        const { error: movError } = await supabase
          .from('denuncias_movimentacoes')
          .insert({
            denuncia_id: denuncia.id,
            acao: statusAnterior !== statusNovo ? 'status_alterado' : 'observacao_adicionada',
            status_anterior: statusAnterior,
            status_novo: statusNovo,
            observacoes: formData.observacoes
          });

        if (movError) throw movError;
      }

      // Notificar integrações externas sobre atualização da denúncia
      try {
        await notify('denuncia_recebida', {
          titulo: `Denúncia ${denuncia.protocolo} atualizada para ${statusNovo}`,
          descricao: `A denúncia "${denuncia.titulo}" teve seu status alterado de ${statusAnterior} para ${statusNovo}.${formData.observacoes ? ` Observação: ${formData.observacoes}` : ''}`,
          link: `${window.location.origin}/denuncias`,
          gravidade: denuncia.gravidade === 'critica' ? 'critica' : denuncia.gravidade === 'alta' ? 'alta' : 'media',
          dados: { protocolo: denuncia.protocolo, status_anterior: statusAnterior, status_novo: statusNovo }
        });
      } catch (notifyErr) {
        console.error('Erro ao notificar integrações:', notifyErr);
      }

      toast({
        title: "Sucesso",
        description: "Denúncia atualizada com sucesso"
      });

      onDenunciaAtualizada();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar denúncia",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const downloadAnexo = async (anexo: Anexo) => {
    try {
      const { data, error } = await supabase.storage
        .from('denuncias-anexos')
        .download(anexo.arquivo_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = anexo.nome_arquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar anexo:', error);
      toast({
        title: "Erro",
        description: "Erro ao baixar anexo",
        variant: "destructive"
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const datePart = formatDateOnly(dateString);
    const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  };

  const gravidadeLabel: Record<string, string> = {
    baixa: 'Baixa',
    media: 'Média',
    alta: 'Alta',
    critica: 'Crítica',
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={`Denúncia ${denuncia.protocolo}`}
      description="Gerencie e acompanhe esta denúncia"
      icon={Shield}
      size="lg"
      hideFooter
      disableShortcuts
    >
        <Tabs defaultValue="detalhes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="tratamento">Tratamento</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* Tab Detalhes */}
          <TabsContent value="detalhes" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Informações da Denúncia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Protocolo</Label>
                    <div className="font-mono text-sm">{denuncia.protocolo}</div>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">Título</Label>
                    <div className="text-sm">{denuncia.titulo}</div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Gravidade</Label>
                    <div>
                      <StatusBadge {...resolveGravidadeTone(denuncia.gravidade)}>
                        {gravidadeLabel[denuncia.gravidade] || denuncia.gravidade}
                      </StatusBadge>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Data da Denúncia</Label>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-4 w-4" />
                      {formatDateTime(denuncia.created_at)}
                    </div>
                  </div>

                  {denuncia.categoria && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Categoria</Label>
                      <div>
                        <Badge variant="outline" style={{ borderColor: denuncia.categoria.cor }}>
                          {denuncia.categoria.nome}
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Denunciante</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {denuncia.anonima ? (
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="secondary">Denúncia Anônima</Badge>
                    </div>
                  ) : (
                    <>
                      {denuncia.nome_denunciante && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Nome</Label>
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4" />
                            {denuncia.nome_denunciante}
                          </div>
                        </div>
                      )}
                      
                      {denuncia.email_denunciante && (
                        <div>
                          <Label className="text-xs text-muted-foreground">E-mail</Label>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4" />
                            {denuncia.email_denunciante}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {denuncia.ip_origem && (
                    <div>
                      <Label className="text-xs text-muted-foreground">IP de Origem</Label>
                      <div className="font-mono text-sm">{denuncia.ip_origem}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg">
                  {denuncia.descricao}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Tratamento */}
          <TabsContent value="tratamento" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsavel">Responsável</Label>
                  <Select 
                    value={formData.responsavel_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, responsavel_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios.map((usuario) => (
                        <SelectItem key={usuario.user_id} value={usuario.user_id}>
                          {usuario.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações da Movimentação</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                    placeholder="Adicione observações sobre esta movimentação..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parecer">Parecer Final</Label>
              <Textarea
                id="parecer"
                value={formData.parecer_final}
                onChange={(e) => setFormData(prev => ({ ...prev, parecer_final: e.target.value }))}
                placeholder="Parecer final da investigação..."
                rows={4}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSalvar} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </TabsContent>

          {/* Tab Anexos */}
          <TabsContent value="anexos" className="space-y-4">
            <div className="grid gap-4">
              {anexos.length > 0 ? (
                anexos.map((anexo) => (
                  <Card key={anexo.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{anexo.nome_arquivo}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatBytes(anexo.tamanho_arquivo)} • {anexo.tipo_anexo}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(anexo.created_at)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadAnexo(anexo)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar
                      </Button>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum anexo encontrado
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico" className="space-y-4">
            <div className="space-y-4">
              {movimentacoes.length > 0 ? (
                movimentacoes.map((mov) => (
                  <Card key={mov.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                          <div>
                            <div className="font-medium">
                              {mov.acao === 'status_alterado' 
                                ? `Status alterado de "${mov.status_anterior}" para "${mov.status_novo}"`
                                : mov.acao === 'observacao_adicionada'
                                ? 'Observação adicionada'
                                : mov.acao
                              }
                            </div>
                            {mov.observacoes && (
                              <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                {mov.observacoes}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(mov.created_at)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma movimentação registrada</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
    </DialogShell>
  );
}
