import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DataTable, Column } from '@/components/ui/data-table';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  Tag
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDateOnly } from '@/lib/date-utils';

interface Categoria {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  ativo: boolean;
  created_at: string;
}

const coresPredefinidas = [
  '#EF4444', // red
  '#F97316', // orange  
  '#F59E0B', // yellow
  '#10B981', // green
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#6B7280', // gray
  '#0891B2'  // cyan
];

export function CategoriasDenuncia() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoriaToDelete, setCategoriaToDelete] = useState<Categoria | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<string>('nome');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cor: '#EF4444'
  });

  useEffect(() => {
    carregarCategorias();
  }, []);

  const carregarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('denuncias_categorias')
        .select('*')
        .order('nome');

      if (error) throw error;
      setCategorias(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar categorias",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const abrirDialog = (categoria?: Categoria) => {
    if (categoria) {
      setEditingCategoria(categoria);
      setFormData({
        nome: categoria.nome,
        descricao: categoria.descricao,
        cor: categoria.cor
      });
    } else {
      setEditingCategoria(null);
      setFormData({
        nome: '',
        descricao: '',
        cor: '#EF4444'
      });
    }
    setDialogOpen(true);
  };

  const fecharDialog = () => {
    setDialogOpen(false);
    setEditingCategoria(null);
    setFormData({ nome: '', descricao: '', cor: '#EF4444' });
  };

  const handleSalvar = async () => {
    if (!formData.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome da categoria é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      if (editingCategoria) {
        const { error } = await supabase
          .from('denuncias_categorias')
          .update({
            nome: formData.nome.trim(),
            descricao: formData.descricao.trim(),
            cor: formData.cor
          })
          .eq('id', editingCategoria.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Categoria atualizada com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('denuncias_categorias')
          .insert({
            nome: formData.nome.trim(),
            descricao: formData.descricao.trim(),
            cor: formData.cor,
            empresa_id: '00000000-0000-0000-0000-000000000000'
          });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Categoria criada com sucesso"
        });
      }

      fecharDialog();
      carregarCategorias();
    } catch (error: any) {
      console.error('Erro ao salvar categoria:', error);
      toast({
        title: "Erro",
        description: error.message?.includes('duplicate') 
          ? "Já existe uma categoria com este nome"
          : "Erro ao salvar categoria",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmarDelete = (categoria: Categoria) => {
    setCategoriaToDelete(categoria);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!categoriaToDelete) return;

    try {
      const { error } = await supabase
        .from('denuncias_categorias')
        .delete()
        .eq('id', categoriaToDelete.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso"
      });

      carregarCategorias();
    } catch (error: any) {
      console.error('Erro ao excluir categoria:', error);
      toast({
        title: "Erro",
        description: error.message?.includes('foreign key') 
          ? "Não é possível excluir esta categoria pois existem denúncias vinculadas"
          : "Erro ao excluir categoria",
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setCategoriaToDelete(null);
    }
  };

  const toggleAtivo = async (categoria: Categoria) => {
    try {
      const { error } = await supabase
        .from('denuncias_categorias')
        .update({ ativo: !categoria.ativo })
        .eq('id', categoria.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Categoria ${!categoria.ativo ? 'ativada' : 'desativada'} com sucesso`
      });

      carregarCategorias();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da categoria",
        variant: "destructive"
      });
    }
  };

  // Filtrar e ordenar
  const filteredAndSortedCategorias = useMemo(() => {
    let filtered = categorias;

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.nome.toLowerCase().includes(term) ||
        c.descricao?.toLowerCase().includes(term)
      );
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => 
        statusFilter === 'ativo' ? c.ativo : !c.ativo
      );
    }

    // Ordenar
    filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof Categoria];
      let bValue: any = b[sortField as keyof Categoria];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [categorias, searchTerm, statusFilter, sortField, sortDirection]);

  const columns: Column<Categoria>[] = [
    {
      key: 'nome',
      label: 'Categoria',
      sortable: true,
      render: (_value, cat) => (
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: cat.cor }}
          />
          <span className="font-medium">{cat.nome}</span>
        </div>
      )
    },
    {
      key: 'descricao',
      label: 'Descrição',
      sortable: true,
      render: (_value, cat) => (
        <span className="max-w-xs truncate block">{cat.descricao || '-'}</span>
      )
    },
    {
      key: 'ativo',
      label: 'Status',
      sortable: true,
      render: (_value, cat) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleAtivo(cat)}
        >
          <Badge variant={cat.ativo ? "default" : "secondary"} className="whitespace-nowrap">
            {cat.ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        </Button>
      )
    },
    {
      key: 'created_at',
      label: 'Criado em',
      sortable: true,
      render: (_value, cat) => formatDateOnly(cat.created_at)
    },
    {
      key: 'acoes',
      label: 'Ações',
      render: (_value, cat) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => abrirDialog(cat)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => confirmarDelete(cat)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  const filters = [
    {
      key: 'status',
      label: 'Status',
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'ativo', label: 'Ativo' },
        { value: 'inativo', label: 'Inativo' }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Categorias de Denúncia</h2>
          <p className="text-muted-foreground">
            Gerencie as categorias para classificar as denúncias
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => abrirDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategoria ? 'Editar Categoria' : 'Nova Categoria'}
              </DialogTitle>
              <DialogDescription>
                {editingCategoria 
                  ? 'Edite as informações da categoria'
                  : 'Crie uma nova categoria para classificar denúncias'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Assédio, Corrupção, Fraude..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição da categoria..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {coresPredefinidas.map((cor) => (
                    <button
                      key={cor}
                      onClick={() => setFormData(prev => ({ ...prev, cor }))}
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.cor === cor ? 'border-primary scale-110' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={formData.cor}
                  onChange={(e) => setFormData(prev => ({ ...prev, cor: e.target.value }))}
                  className="w-20 h-10"
                />
              </div>

              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  style={{ backgroundColor: formData.cor, color: 'white' }}
                >
                  {formData.nome || 'Preview'}
                </Badge>
                <span className="text-sm text-muted-foreground">Preview</span>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={fecharDialog}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSalvar} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Categorias Cadastradas
          </CardTitle>
          <CardDescription>
            {categorias.length} categoria(s) cadastrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredAndSortedCategorias}
            columns={columns}
            loading={loading}
            searchPlaceholder="Buscar categorias..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filters={filters}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={(field) => {
              if (field === sortField) {
                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
              } else {
                setSortField(field);
                setSortDirection('asc');
              }
            }}
            emptyState={{
              icon: <Tag className="w-12 h-12" />,
              title: "Nenhuma categoria encontrada",
              description: "Clique em 'Nova Categoria' para começar"
            }}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Categoria"
        description={`Tem certeza que deseja excluir a categoria "${categoriaToDelete?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
