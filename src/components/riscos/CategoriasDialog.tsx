
import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
  cor?: string;
}

interface CategoriasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CategoriasDialog({ open, onOpenChange, onSuccess }: CategoriasDialogProps) {
  const { profile } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoriaToDelete, setCategoriaToDelete] = useState<Categoria | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cor: '#3B82F6'
  });

  const fetchCategorias = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('riscos_categorias')
        .select('*')
        .order('nome');

      if (error) throw error;
      setCategorias(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar categorias: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && profile) {
      fetchCategorias();
    }
  }, [open, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id) return;

    try {
      setLoading(true);
      
      if (editingCategoria) {
        const { error } = await supabase
          .from('riscos_categorias')
          .update({
            nome: formData.nome,
            descricao: formData.descricao || null,
            cor: formData.cor
          })
          .eq('id', editingCategoria.id);

        if (error) throw error;
        toast.success('Categoria atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('riscos_categorias')
          .insert({
            empresa_id: profile.empresa_id,
            nome: formData.nome,
            descricao: formData.descricao || null,
            cor: formData.cor
          });

        if (error) throw error;
        toast.success('Categoria criada com sucesso!');
      }

      setFormData({ nome: '', descricao: '', cor: '#3B82F6' });
      setEditingCategoria(null);
      setShowForm(false);
      fetchCategorias();
      onSuccess();
    } catch (error: any) {
      toast.error('Erro ao salvar categoria: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setFormData({
      nome: categoria.nome,
      descricao: categoria.descricao || '',
      cor: categoria.cor || '#3B82F6'
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!categoriaToDelete) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('riscos_categorias')
        .delete()
        .eq('id', categoriaToDelete.id);

      if (error) throw error;
      toast.success('Categoria excluída com sucesso!');
      setDeleteDialogOpen(false);
      setCategoriaToDelete(null);
      fetchCategorias();
      onSuccess();
    } catch (error: any) {
      toast.error('Erro ao excluir categoria: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (categoria: Categoria) => {
    setCategoriaToDelete(categoria);
    setDeleteDialogOpen(true);
  };

  const handleNewCategoria = () => {
    setEditingCategoria(null);
    setFormData({ nome: '', descricao: '', cor: '#3B82F6' });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingCategoria(null);
    setFormData({ nome: '', descricao: '', cor: '#3B82F6' });
  };

  // Categorias padrão para criar automaticamente
  const createDefaultCategories = async () => {
    const defaultCategories = [
      { nome: 'Operacional', descricao: 'Riscos relacionados às operações do dia a dia', cor: '#EF4444' },
      { nome: 'Financeiro', descricao: 'Riscos relacionados a aspectos financeiros', cor: '#10B981' },
      { nome: 'Estratégico', descricao: 'Riscos relacionados ao planejamento estratégico', cor: '#3B82F6' },
      { nome: 'Regulatório', descricao: 'Riscos relacionados ao cumprimento de regulamentações', cor: '#F59E0B' },
      { nome: 'Tecnológico', descricao: 'Riscos relacionados à tecnologia e sistemas', cor: '#8B5CF6' },
      { nome: 'Reputacional', descricao: 'Riscos relacionados à imagem e reputação', cor: '#EC4899' }
    ];

    try {
      setLoading(true);
      for (const categoria of defaultCategories) {
        await supabase
          .from('riscos_categorias')
          .insert({
            empresa_id: profile?.empresa_id,
            ...categoria
          });
      }
      toast.success('Categorias padrão criadas com sucesso!');
      fetchCategorias();
      onSuccess();
    } catch (error: any) {
      toast.error('Erro ao criar categorias padrão: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        icon={Tag}
        title="Gerenciar Categorias de Risco"
        description="Crie e gerencie as categorias utilizadas para classificar os riscos"
        size="lg"
        hideFooter
      >
          <div className="space-y-6">
            {!showForm && (
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button onClick={handleNewCategoria} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Categoria
                  </Button>
                  {categorias.length === 0 && (
                    <Button variant="outline" onClick={createDefaultCategories} size="sm" disabled={loading}>
                      Criar Categorias Padrão
                    </Button>
                  )}
                </div>
              </div>
            )}

            {showForm && (
              <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome da Categoria</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cor">Cor</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="cor"
                        type="color"
                        value={formData.cor}
                        onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                        className="w-20 h-10"
                      />
                      <div 
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: formData.cor }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="descricao">Descrição (opcional)</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading}>
                    {editingCategoria ? 'Atualizar' : 'Criar'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelForm}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        Carregando categorias...
                      </TableCell>
                    </TableRow>
                  ) : categorias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        Nenhuma categoria encontrada. Clique em "Nova Categoria" ou "Criar Categorias Padrão" para começar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    categorias.map((categoria) => (
                      <TableRow key={categoria.id}>
                        <TableCell className="font-medium">{categoria.nome}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-6 h-6 rounded border"
                              style={{ backgroundColor: categoria.cor || '#9CA3AF' }}
                            />
                            <span className="text-sm text-muted-foreground">
                              {categoria.cor || '#9CA3AF'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{categoria.descricao || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(categoria)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(categoria)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
      </DialogShell>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Categoria"
        description={`Tem certeza que deseja excluir a categoria "${categoriaToDelete?.nome}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
      />
    </>
  );
}
