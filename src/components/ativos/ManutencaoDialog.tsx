import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, User, DollarSign, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { UserSelect } from '@/components/riscos/UserSelect';
import { formatDateOnly } from '@/lib/date-utils';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Manutencao {
  id: string;
  ativo_id: string;
  tipo_manutencao: string;
  descricao: string;
  data_manutencao: string;
  data_prevista_conclusao: string | null;
  data_conclusao: string | null;
  responsavel: string | null;
  responsavel_nome?: string | null;
  responsavel_avatar?: string | null;
  fornecedor: string | null;
  custo: number | null;
  status: string;
  observacoes: string | null;
  proxima_manutencao: string | null;
  criticidade: string;
  created_at: string;
}

interface ManutencaoDialogProps {
  ativoId: string;
  ativoNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tiposManutencao = [
  { value: 'preventiva', label: 'Preventiva', color: 'default' },
  { value: 'corretiva', label: 'Corretiva', color: 'warning' },
  { value: 'emergencial', label: 'Emergencial', color: 'destructive' },
  { value: 'melhorias', label: 'Melhorias', color: 'secondary' },
];

const statusOptions = [
  { value: 'agendada', label: 'Agendada', color: 'secondary' },
  { value: 'em_andamento', label: 'Em Andamento', color: 'warning' },
  { value: 'concluida', label: 'Concluída', color: 'success' },
  { value: 'cancelada', label: 'Cancelada', color: 'destructive' },
];

const criticidades = [
  { value: 'baixa', label: 'Baixa', color: 'secondary' },
  { value: 'media', label: 'Média', color: 'default' },
  { value: 'alta', label: 'Alta', color: 'warning' },
  { value: 'critica', label: 'Crítica', color: 'destructive' },
];

const ManutencaoDialog: React.FC<ManutencaoDialogProps> = ({ ativoId, ativoNome, open, onOpenChange }) => {
  const { profile } = useAuth();
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingManutencao, setEditingManutencao] = useState<Manutencao | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; manutencaoId: string }>({
    open: false,
    manutencaoId: ''
  });
  const [formData, setFormData] = useState({
    tipo_manutencao: 'preventiva',
    descricao: '',
    data_manutencao: '',
    data_prevista_conclusao: '',
    data_conclusao: '',
    responsavel: '',
    fornecedor: '',
    custo: '',
    status: 'agendada',
    observacoes: '',
    proxima_manutencao: '',
    criticidade: 'media',
  });

  useEffect(() => {
    if (open && ativoId) {
      fetchManutencoes();
    }
  }, [open, ativoId]);

  const fetchManutencoes = async () => {
    try {
      const { data, error } = await supabase
        .from('ativos_manutencoes')
        .select('*')
        .eq('ativo_id', ativoId)
        .order('data_manutencao', { ascending: false });

      if (error) throw error;
      
      // Fetch responsible user profiles
      if (data && data.length > 0) {
        const responsavelIds = data
          .map(m => m.responsavel)
          .filter(r => r && r.trim() !== '');
        
        if (responsavelIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .rpc('get_profiles_by_text_ids', { text_ids: responsavelIds });
          
          if (!profilesError && profiles) {
            const profileMap = new Map(
              profiles.map((p: any) => [p.user_id.toString(), { nome: p.nome, foto_url: p.foto_url }])
            );
            
            const mappedData = data.map(manutencao => {
              const profileData = (manutencao.responsavel && manutencao.responsavel.trim() !== '')
                ? profileMap.get(manutencao.responsavel)
                : null;
              
              return {
                ...manutencao,
                responsavel_nome: profileData?.nome || null,
                responsavel_avatar: profileData?.foto_url || null
              };
            });
            
            setManutencoes(mappedData);
            setLoading(false);
            return;
          }
        }
      }
      
      setManutencoes(data || []);
    } catch (error) {
      console.error('Error fetching manutencoes:', error);
      toast.error('Erro ao carregar manutenções');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.empresa_id) {
      toast.error('Usuário deve estar vinculado a uma empresa');
      return;
    }

    try {
      const manutencaoData = {
        ...formData,
        ativo_id: ativoId,
        empresa_id: profile.empresa_id,
        created_by: profile.user_id,
        data_manutencao: formData.data_manutencao || null,
        data_prevista_conclusao: formData.data_prevista_conclusao || null,
        data_conclusao: formData.data_conclusao || null,
        proxima_manutencao: formData.proxima_manutencao || null,
        custo: formData.custo ? parseFloat(formData.custo) : null,
      };

      if (editingManutencao) {
        const { error } = await supabase
          .from('ativos_manutencoes')
          .update(manutencaoData)
          .eq('id', editingManutencao.id);

        if (error) throw error;
        toast.success('Manutenção atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('ativos_manutencoes')
          .insert(manutencaoData);

        if (error) throw error;
        toast.success('Manutenção criada com sucesso!');
      }

      setIsDialogOpen(false);
      setEditingManutencao(null);
      resetForm();
      fetchManutencoes();
    } catch (error: any) {
      console.error('Error saving manutencao:', error);
      toast.error(error.message || 'Erro ao salvar manutenção');
    }
  };

  const handleEdit = (manutencao: Manutencao) => {
    setEditingManutencao(manutencao);
    setFormData({
      tipo_manutencao: manutencao.tipo_manutencao,
      descricao: manutencao.descricao,
      data_manutencao: manutencao.data_manutencao,
      data_prevista_conclusao: manutencao.data_prevista_conclusao || '',
      data_conclusao: manutencao.data_conclusao || '',
      responsavel: manutencao.responsavel || '',
      fornecedor: manutencao.fornecedor || '',
      custo: manutencao.custo ? manutencao.custo.toString() : '',
      status: manutencao.status,
      observacoes: manutencao.observacoes || '',
      proxima_manutencao: manutencao.proxima_manutencao || '',
      criticidade: manutencao.criticidade,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ open: true, manutencaoId: id });
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('ativos_manutencoes')
        .delete()
        .eq('id', deleteConfirm.manutencaoId);

      if (error) throw error;
      toast.success('Manutenção excluída com sucesso!');
      fetchManutencoes();
    } catch (error: any) {
      console.error('Error deleting manutencao:', error);
      toast.error(error.message || 'Erro ao excluir manutenção');
    }
  };

  const resetForm = () => {
    setFormData({
      tipo_manutencao: 'preventiva',
      descricao: '',
      data_manutencao: '',
      data_prevista_conclusao: '',
      data_conclusao: '',
      responsavel: '',
      fornecedor: '',
      custo: '',
      status: 'agendada',
      observacoes: '',
      proxima_manutencao: '',
      criticidade: 'media',
    });
  };

  const COLOR_TO_TONE: Record<string, StatusTone> = {
    default: 'info',
    warning: 'warning',
    destructive: 'destructive',
    secondary: 'neutral',
    success: 'success',
  };

  const getBadgeTone = (type: string, value: string): StatusTone => {
    const option = type === 'tipo' ? tiposManutencao.find(t => t.value === value) :
                  type === 'status' ? statusOptions.find(s => s.value === value) :
                  criticidades.find(c => c.value === value);
    return COLOR_TO_TONE[option?.color || 'default'] || 'neutral';
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const renderResponsavel = (manutencao: Manutencao) => {
    if (!manutencao.responsavel_nome) return '-';
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                {manutencao.responsavel_avatar && (
                  <AvatarImage src={manutencao.responsavel_avatar} alt={manutencao.responsavel_nome} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {manutencao.responsavel_nome
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{manutencao.responsavel_nome.split(' ')[0]}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{manutencao.responsavel_nome}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Wrench}
      title={`Manutenções — ${ativoNome}`}
      description="Gerencie o histórico de manutenções do ativo"
      size="xl"
      hideFooter
    >
        <div className="space-y-6">
          {/* Resumo das Manutenções */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{manutencoes.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {manutencoes.filter(m => m.status === 'concluida').length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {manutencoes.filter(m => m.status === 'em_andamento').length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(manutencoes.reduce((sum, m) => sum + (m.custo || 0), 0))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Botão Nova Manutenção */}
          <div className="flex justify-end">
            <Button onClick={() => {
              setEditingManutencao(null);
              resetForm();
              setIsDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Manutenção
            </Button>
            <DialogShell
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
              icon={Wrench}
              title={editingManutencao ? 'Editar Manutenção' : 'Nova Manutenção'}
              size="md"
              onSubmit={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
              submitLabel={editingManutencao ? 'Atualizar' : 'Criar'}
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="tipo_manutencao">Tipo *</Label>
                      <Select value={formData.tipo_manutencao} onValueChange={(value) => setFormData(prev => ({...prev, tipo_manutencao: value}))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposManutencao.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="criticidade">Criticidade</Label>
                      <Select value={formData.criticidade} onValueChange={(value) => setFormData(prev => ({...prev, criticidade: value}))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {criticidades.map((crit) => (
                            <SelectItem key={crit.value} value={crit.value}>
                              {crit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição *</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData(prev => ({...prev, descricao: e.target.value}))}
                      required
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="data_manutencao">Data da Manutenção *</Label>
                      <Input
                        id="data_manutencao"
                        type="date"
                        value={formData.data_manutencao}
                        onChange={(e) => setFormData(prev => ({...prev, data_manutencao: e.target.value}))}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="data_prevista_conclusao">Previsão de Conclusão</Label>
                      <Input
                        id="data_prevista_conclusao"
                        type="date"
                        value={formData.data_prevista_conclusao}
                        onChange={(e) => setFormData(prev => ({...prev, data_prevista_conclusao: e.target.value}))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="data_conclusao">Data de Conclusão</Label>
                      <Input
                        id="data_conclusao"
                        type="date"
                        value={formData.data_conclusao}
                        onChange={(e) => setFormData(prev => ({...prev, data_conclusao: e.target.value}))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="responsavel">Responsável</Label>
                      <UserSelect
                        value={formData.responsavel}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, responsavel: value }))}
                        placeholder="Selecione o responsável"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="fornecedor">Fornecedor</Label>
                      <Input
                        id="fornecedor"
                        value={formData.fornecedor}
                        onChange={(e) => setFormData(prev => ({...prev, fornecedor: e.target.value}))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="custo">Custo (R$)</Label>
                      <Input
                        id="custo"
                        type="number"
                        step="0.01"
                        value={formData.custo}
                        onChange={(e) => setFormData(prev => ({...prev, custo: e.target.value}))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({...prev, status: value}))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="proxima_manutencao">Próxima Manutenção</Label>
                      <Input
                        id="proxima_manutencao"
                        type="date"
                        value={formData.proxima_manutencao}
                        onChange={(e) => setFormData(prev => ({...prev, proxima_manutencao: e.target.value}))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData(prev => ({...prev, observacoes: e.target.value}))}
                      rows={3}
                    />
                  </div>

                </form>
            </DialogShell>
          </div>

          {/* Tabela de Manutenções */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Manutenções</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <AkurisPulse size={32} />
                </div>
              ) : manutencoes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma manutenção registrada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criticidade</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manutencoes.map((manutencao) => (
                      <TableRow key={manutencao.id}>
                        <TableCell>
                          {formatDateOnly(manutencao.data_manutencao)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge size="sm" tone={getBadgeTone('tipo', manutencao.tipo_manutencao)}>
                            {tiposManutencao.find(t => t.value === manutencao.tipo_manutencao)?.label}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {manutencao.descricao}
                        </TableCell>
                        <TableCell>
                          <StatusBadge size="sm" tone={getBadgeTone('status', manutencao.status)}>
                            {statusOptions.find(s => s.value === manutencao.status)?.label}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge size="sm" tone={getBadgeTone('criticidade', manutencao.criticidade)}>
                            {criticidades.find(c => c.value === manutencao.criticidade)?.label}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>{renderResponsavel(manutencao)}</TableCell>
                        <TableCell>{formatCurrency(manutencao.custo)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(manutencao)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Editar manutenção</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(manutencao.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Excluir manutenção</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <ConfirmDialog
          open={deleteConfirm.open}
          onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
          onConfirm={confirmDelete}
          title="Excluir Manutenção"
          description="Tem certeza que deseja excluir esta manutenção? Esta ação não pode ser desfeita."
          confirmText="Excluir"
          cancelText="Cancelar"
          variant="destructive"
        />
    </DialogShell>
  );
};

export default ManutencaoDialog;
