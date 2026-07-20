import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveMarcoStatusTone, resolveMarcoTipoTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, CalendarClock, DollarSign, User, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Contrato {
  id: string;
  nome: string;
  numero_contrato: string;
}

interface Marco {
  id: string;
  nome: string;
  tipo: string;
  data_prevista: string;
  data_realizada: string | null;
  status: string;
  responsavel: string | null;
  descricao: string;
  valor: number | null;
  alerta_antecedencia: number;
  observacoes: string;
}

interface MarcosDialogProps {
  contrato: Contrato | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarcosDialog({ contrato, open, onOpenChange }: MarcosDialogProps) {
  const [marcos, setMarcos] = useState<Marco[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMarco, setEditingMarco] = useState<Marco | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; nome?: string }>({ open: false, id: '' });
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'vencimento',
    data_prevista: '',
    data_realizada: '',
    status: 'pendente',
    responsavel: '',
    descricao: '',
    valor: '',
    alerta_antecedencia: '30',
    observacoes: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && contrato) {
      fetchMarcos();
      fetchUsuarios();
    }
  }, [open, contrato]);

  const fetchMarcos = async () => {
    if (!contrato) return;

    try {
      const { data, error } = await supabase
        .from('contrato_marcos')
        .select('*')
        .eq('contrato_id', contrato.id)
        .order('data_prevista');

      if (error) throw error;
      setMarcos(data || []);
    } catch (error) {
      console.error('Erro ao carregar marcos:', error);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile?.empresa_id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome')
        .eq('ativo', true)
        .eq('empresa_id', profile.empresa_id)
        .order('nome');

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.data_prevista || !contrato) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const marcoData = {
        contrato_id: contrato.id,
        nome: formData.nome,
        tipo: formData.tipo,
        data_prevista: formData.data_prevista,
        data_realizada: formData.data_realizada || null,
        status: formData.status,
        responsavel: formData.responsavel || null,
        descricao: formData.descricao,
        valor: formData.valor ? parseFloat(formData.valor) : null,
        alerta_antecedencia: parseInt(formData.alerta_antecedencia),
        observacoes: formData.observacoes
      };

      let error;
      
      if (editingMarco) {
        const { error: updateError } = await supabase
          .from('contrato_marcos')
          .update(marcoData)
          .eq('id', editingMarco.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('contrato_marcos')
          .insert([marcoData]);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Marco ${editingMarco ? 'atualizado' : 'criado'} com sucesso`,
      });

      resetForm();
      fetchMarcos();
    } catch (error) {
      console.error('Erro ao salvar marco:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar marco",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (marco: Marco) => {
    setEditingMarco(marco);
    setFormData({
      nome: marco.nome,
      tipo: marco.tipo,
      data_prevista: marco.data_prevista,
      data_realizada: marco.data_realizada || '',
      status: marco.status,
      responsavel: marco.responsavel || '',
      descricao: marco.descricao,
      valor: marco.valor?.toString() || '',
      alerta_antecedencia: marco.alerta_antecedencia.toString(),
      observacoes: marco.observacoes
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('contrato_marcos')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Marco excluído com sucesso",
      });

      fetchMarcos();
    } catch (error) {
      console.error('Erro ao excluir marco:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir marco",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirm({ open: false, id: '' });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo: 'vencimento',
      data_prevista: '',
      data_realizada: '',
      status: 'pendente',
      responsavel: '',
      descricao: '',
      valor: '',
      alerta_antecedencia: '30',
      observacoes: ''
    });
    setEditingMarco(null);
    setShowForm(false);
  };

  // status e tipo agora resolvidos via StatusBadge + resolvers

  const isOverdue = (dataPrevista: string, status: string) => {
    if (status === 'concluido' || status === 'cancelado') return false;
    return new Date(dataPrevista) < new Date();
  };

  if (!contrato) return null;

  return (
    <>
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={CalendarClock}
      title={`Marcos — ${contrato.nome}`}
      description={`Gerencie marcos importantes e datas do contrato ${contrato.numero_contrato}`}
      size="lg"
      hideFooter
    >
        <div className="space-y-4">
          {!showForm && (
            <div className="flex justify-end items-center">
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Marco
              </Button>
            </div>
          )}

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingMarco ? 'Editar Marco' : 'Novo Marco'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome do Marco *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Ex: Vencimento do contrato"
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
                          <SelectItem value="vencimento">Vencimento</SelectItem>
                          <SelectItem value="renovacao">Renovação</SelectItem>
                          <SelectItem value="pagamento">Pagamento</SelectItem>
                          <SelectItem value="entrega">Entrega</SelectItem>
                          <SelectItem value="revisao">Revisão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="data_prevista">Data Prevista *</Label>
                      <Input
                        id="data_prevista"
                        type="date"
                        value={formData.data_prevista}
                        onChange={(e) => setFormData({ ...formData, data_prevista: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="data_realizada">Data Realizada</Label>
                      <Input
                        id="data_realizada"
                        type="date"
                        value={formData.data_realizada}
                        onChange={(e) => setFormData({ ...formData, data_realizada: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                          <SelectItem value="atrasado">Atrasado</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="responsavel">Responsável</Label>
                      <Select value={formData.responsavel} onValueChange={(value) => setFormData({ ...formData, responsavel: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o responsável" />
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

                    <div className="space-y-2">
                      <Label htmlFor="valor">Valor</Label>
                      <Input
                        id="valor"
                        type="number"
                        step="0.01"
                        value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="alerta_antecedencia">Alerta (dias)</Label>
                      <Input
                        id="alerta_antecedencia"
                        type="number"
                        value={formData.alerta_antecedencia}
                        onChange={(e) => setFormData({ ...formData, alerta_antecedencia: e.target.value })}
                        placeholder="30"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="descricao">Descrição</Label>
                      <Textarea
                        id="descricao"
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        placeholder="Descrição do marco..."
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="observacoes">Observações</Label>
                      <Textarea
                        id="observacoes"
                        value={formData.observacoes}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        placeholder="Observações adicionais..."
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Salvando...' : (editingMarco ? 'Atualizar' : 'Criar')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {marcos.map((marco) => (
              <Card key={marco.id} className={`hover:shadow-md transition-shadow ${isOverdue(marco.data_prevista, marco.status) ? 'border-destructive/30' : ''}`}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{marco.nome}</h3>
                        {isOverdue(marco.data_prevista, marco.status) && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{marco.descricao}</p>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge size="sm" {...resolveMarcoTipoTone(marco.tipo)}>{formatStatus(marco.tipo)}</StatusBadge>
                      <StatusBadge size="sm" {...resolveMarcoStatusTone(marco.status)}>{formatStatus(marco.status)}</StatusBadge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">Data Prevista:</span>
                        <p>{format(new Date(marco.data_prevista), 'dd/MM/yyyy', { locale: ptBR })}</p>
                      </div>
                    </div>

                    {marco.data_realizada && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-success" />
                        <div>
                          <span className="font-medium">Data Realizada:</span>
                          <p>{format(new Date(marco.data_realizada), 'dd/MM/yyyy', { locale: ptBR })}</p>
                        </div>
                      </div>
                    )}

                    {marco.valor && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">Valor:</span>
                          <p>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(marco.valor))}</p>
                        </div>
                      </div>
                    )}

                    {marco.responsavel && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">Responsável:</span>
                          <p>{usuarios.find(u => u.user_id === marco.responsavel)?.nome || 'N/A'}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {marco.observacoes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">{marco.observacoes}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(marco)}>
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ open: true, id: marco.id, nome: marco.nome })}>
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {marcos.length === 0 && !showForm && (
            <Card>
              <CardContent className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum marco cadastrado</p>
              </CardContent>
            </Card>
          )}
        </div>
    </DialogShell>

    <ConfirmDialog
      open={deleteConfirm.open}
      onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
      title="Excluir Marco"
      description={`Tem certeza que deseja excluir o marco "${deleteConfirm.nome}"? Esta ação não pode ser desfeita.`}
      confirmText="Excluir"
      cancelText="Cancelar"
      variant="destructive"
      onConfirm={handleDelete}
    />
    </>
  );
}