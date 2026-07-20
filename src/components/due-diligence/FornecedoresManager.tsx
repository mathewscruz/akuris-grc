import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Building, Mail, Phone, Filter, Eye, X, Shield, ClipboardList, MoreHorizontal } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';

interface Fornecedor {
  id: string;
  nome: string;
  email?: string;
  cnpj?: string;
  telefone?: string;
  endereco?: string;
  contato_responsavel?: string;
  observacoes?: string;
  status: string;
  categoria?: string;
  tipo: string;
  created_at?: string;
}

interface FornecedorFormData {
  nome: string;
  email: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  contato_responsavel: string;
  observacoes: string;
  categoria: string;
}

const CATEGORIAS = [
  'Tecnologia',
  'Serviços',
  'Financeiro',
  'Consultoria',
  'Logística',
  'Recursos Humanos',
  'Marketing',
  'Jurídico',
  'Outro'
];

export function FornecedoresManager() {
  const { empresaId } = useEmpresaId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ativo');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; fornecedor: Fornecedor | null }>({
    open: false,
    fornecedor: null
  });
  const [formData, setFormData] = useState<FornecedorFormData>({
    nome: '',
    email: '',
    cnpj: '',
    telefone: '',
    endereco: '',
    contato_responsavel: '',
    observacoes: '',
    categoria: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch fornecedores with assessment stats
  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ['fornecedores-with-stats', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data: fornecedoresData, error } = await supabase
        .from('fornecedores')
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('nome');

      if (error) throw error;

      // Fetch assessment stats for all fornecedores
      const { data: assessments } = await supabase
        .from('due_diligence_assessments')
        .select('fornecedor_email, status, score_final, created_at')
        .eq('empresa_id', empresaId!);

      const assessmentMap = new Map<string, { total: number; lastScore: number | null; pending: number }>();
      
      (assessments || []).forEach(a => {
        const key = a.fornecedor_email;
        if (!key) return;
        const existing = assessmentMap.get(key) || { total: 0, lastScore: null, pending: 0 };
        existing.total++;
        if (a.status === 'concluido' && a.score_final) {
          existing.lastScore = a.score_final;
        }
        if (a.status !== 'concluido') {
          existing.pending++;
        }
        assessmentMap.set(key, existing);
      });

      return (fornecedoresData || []).map(f => ({
        ...f,
        _assessmentStats: assessmentMap.get(f.email) || { total: 0, lastScore: null, pending: 0 }
      }));
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FornecedorFormData) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', userData.user?.id)
        .single();

      const { error } = await supabase
        .from('fornecedores')
        .insert({
          nome: data.nome,
          email: data.email || null,
          cnpj: data.cnpj || null,
          telefone: data.telefone || null,
          endereco: data.endereco || null,
          contato_responsavel: data.contato_responsavel || null,
          observacoes: data.observacoes || null,
          categoria: data.categoria || null,
          empresa_id: profile?.empresa_id,
          status: 'ativo',
          tipo: 'fornecedor'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores-with-stats'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Sucesso", description: "Fornecedor criado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro", description: "Erro ao criar fornecedor: " + error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FornecedorFormData }) => {
      const { error } = await supabase
        .from('fornecedores')
        .update({
          nome: data.nome,
          email: data.email || null,
          cnpj: data.cnpj || null,
          telefone: data.telefone || null,
          endereco: data.endereco || null,
          contato_responsavel: data.contato_responsavel || null,
          observacoes: data.observacoes || null,
          categoria: data.categoria || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores-with-stats'] });
      setDialogOpen(false);
      resetForm();
      setEditingFornecedor(null);
      toast({ title: "Sucesso", description: "Fornecedor atualizado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro", description: "Erro ao atualizar fornecedor: " + error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fornecedores')
        .update({ status: 'inativo' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores-with-stats'] });
      setDeleteDialog({ open: false, fornecedor: null });
      toast({ title: "Sucesso", description: "Fornecedor removido com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro", description: "Erro ao remover fornecedor: " + error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({ nome: '', email: '', cnpj: '', telefone: '', endereco: '', contato_responsavel: '', observacoes: '', categoria: '' });
  };

  const handleEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setFormData({
      nome: fornecedor.nome,
      email: fornecedor.email || '',
      cnpj: fornecedor.cnpj || '',
      telefone: fornecedor.telefone || '',
      endereco: fornecedor.endereco || '',
      contato_responsavel: fornecedor.contato_responsavel || '',
      observacoes: fornecedor.observacoes || '',
      categoria: fornecedor.categoria || ''
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (editingFornecedor) {
      updateMutation.mutate({ id: editingFornecedor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) { setEditingFornecedor(null); resetForm(); }
  };

  const getRiskBadge = (stats: { total: number; lastScore: number | null; pending: number }) => {
    const shieldIcon = <Shield strokeWidth={1.5} className="h-3 w-3" />;
    if (stats.total === 0) return <StatusBadge size="sm" tone="neutral" icon={shieldIcon}>Nunca avaliado</StatusBadge>;
    if (stats.lastScore === null) return <StatusBadge size="sm" tone="warning" icon={shieldIcon}>Pendente</StatusBadge>;
    const score = stats.lastScore * 10;
    if (score >= 80) return <StatusBadge size="sm" tone="success" icon={shieldIcon}>{score.toFixed(0)}%</StatusBadge>;
    if (score >= 60) return <StatusBadge size="sm" tone="warning" icon={shieldIcon}>{score.toFixed(0)}%</StatusBadge>;
    return <StatusBadge size="sm" tone="destructive" intensity="high" icon={shieldIcon}>{score.toFixed(0)}%</StatusBadge>;
  };

  const filteredFornecedores = fornecedores.filter(f => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return f.nome.toLowerCase().includes(term) || f.email?.toLowerCase().includes(term) || f.cnpj?.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <>
      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Input placeholder="Buscar fornecedores..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="h-4 w-4 mr-2" />Filtros
                </Button>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />Novo Fornecedor
                </Button>
              </div>
            </div>
            
            {showFilters && (
              <div className="bg-muted/50 rounded-lg p-4 mb-4 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Status:</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(statusFilter !== 'ativo' || searchTerm) && (
                  <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('ativo'); setSearchTerm(''); }}>
                    <X className="h-4 w-4 mr-1" />Limpar Filtros
                  </Button>
                )}
              </div>
            )}
          </div>
          
          <DialogShell
            open={dialogOpen}
            onOpenChange={handleOpenChange}
            icon={Building}
            title={editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            size="md"
            onSubmit={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
            submitLabel={editingFornecedor ? 'Atualizar' : 'Criar'}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome *</Label>
                    <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="categoria">Categoria</Label>
                    <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
                      <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="contato_responsavel">Contato Responsável</Label>
                    <Input id="contato_responsavel" value={formData.contato_responsavel} onChange={(e) => setFormData({ ...formData, contato_responsavel: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input id="endereco" value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea id="observacoes" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={3} />
                  </div>
                </div>
                
              </form>
          </DialogShell>
          
          <div className="p-6 pt-0">
            {isLoading ? (
              <div className="text-center py-8"><p>Carregando fornecedores...</p></div>
            ) : (
              <div className="space-y-3">
                {filteredFornecedores.map((fornecedor: any) => (
                  <Card key={fornecedor.id} className={fornecedor.status === 'inativo' ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <Building className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="text-lg font-semibold truncate">{fornecedor.nome}</h3>
                                {fornecedor.status === 'inativo' && <StatusBadge size="sm" tone="neutral">Inativo</StatusBadge>}
                                {fornecedor.categoria && (
                                  <StatusBadge size="sm" tone="neutral" variant="outline">{formatStatus(fornecedor.categoria)}</StatusBadge>
                                )}
                                {getRiskBadge(fornecedor._assessmentStats)}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                {fornecedor.email && (
                                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{fornecedor.email}</span>
                                )}
                                {fornecedor.telefone && (
                                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{fornecedor.telefone}</span>
                                )}
                                {fornecedor.cnpj && <span>CNPJ: {fornecedor.cnpj}</span>}
                                {fornecedor._assessmentStats.total > 0 && (
                                  <span className="flex items-center gap-1">
                                    <ClipboardList className="w-3 h-3" />
                                    {fornecedor._assessmentStats.total} avaliação(ões)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                const event = new CustomEvent('navigateToDueDiligence', {
                                  detail: { tab: 'assessments', filter: { fornecedorId: fornecedor.id, fornecedorNome: fornecedor.nome } }
                                });
                                window.dispatchEvent(event);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />Ver Avaliações
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                const event = new CustomEvent('createAssessment', {
                                  detail: { fornecedorId: fornecedor.id, fornecedorNome: fornecedor.nome }
                                });
                                window.dispatchEvent(event);
                              }}>
                                <Plus className="h-4 w-4 mr-2" />Nova Avaliação
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(fornecedor)}>
                                <Edit2 className="h-4 w-4 mr-2" />Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ open: true, fornecedor })}>
                                <Trash2 className="h-4 w-4 mr-2" />Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {filteredFornecedores.length === 0 && (
                  <div className="text-center py-8">
                    <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">Nenhum fornecedor encontrado</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, fornecedor: null })}
        title="Remover Fornecedor"
        description={`Tem certeza que deseja remover o fornecedor "${deleteDialog.fornecedor?.nome}"?`}
        onConfirm={() => deleteDialog.fornecedor && deleteMutation.mutate(deleteDialog.fornecedor.id)}
        confirmText="Remover"
        variant="destructive"
      />
    </>
  );
}
