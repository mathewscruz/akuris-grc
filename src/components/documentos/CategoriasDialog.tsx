import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogShell } from '@/components/ui/dialog-shell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
  created_at: string;
}

interface CategoriasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  empresaId?: string | null;
}

const cores = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
];

export function CategoriasDialog({ open, onOpenChange, onSuccess, empresaId }: CategoriasDialogProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; nome?: string }>({ open: false, id: '' });
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cor: '#3B82F6'
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchCategorias();
    }
  }, [open]);

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('documentos_categorias')
        .select('*');

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      const { data, error } = await query.order('nome');

      if (error) throw error;
      setCategorias(data || []);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      toast({
        title: "Erro ao carregar categorias",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome da categoria.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { data: profileData } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!profileData?.empresa_id) throw new Error('Empresa não encontrada');

      const categoriaData = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || null,
        cor: formData.cor,
        empresa_id: profileData.empresa_id,
      };

      if (editingCategoria) {
        const { error } = await supabase
          .from('documentos_categorias')
          .update(categoriaData)
          .eq('id', editingCategoria.id);

        if (error) throw error;

        toast({
          title: "Categoria atualizada",
          description: "A categoria foi atualizada com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('documentos_categorias')
          .insert([categoriaData]);

        if (error) throw error;

        toast({
          title: "Categoria criada",
          description: "A categoria foi criada com sucesso.",
        });
      }

      resetForm();
      fetchCategorias();
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      toast({
        title: "Erro ao salvar categoria",
        description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setFormData({
      nome: categoria.nome,
      descricao: categoria.descricao || '',
      cor: categoria.cor
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('documentos_categorias')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast({
        title: "Categoria excluída",
        description: "A categoria foi excluída com sucesso.",
      });

      fetchCategorias();
      onSuccess();
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      toast({
        title: "Erro ao excluir categoria",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirm({ open: false, id: '' });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      cor: '#3B82F6'
    });
    setEditingCategoria(null);
    setShowForm(false);
  };

  return (
    <>
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FolderOpen}
      title="Gerenciar Categorias de Documentos"
      description="Organize seus documentos criando e gerenciando categorias."
      size="lg"
      hideFooter
    >
        <div className="space-y-6">
          {!showForm ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Categorias Existentes</h3>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Categoria
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <AkurisPulse size={32} />
                </div>
              ) : categorias.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center h-32">
                    <FolderOpen className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhuma categoria criada ainda</p>
                    <p className="text-sm text-muted-foreground">Clique em "Nova Categoria" para começar</p>
                  </CardContent>
                </Card>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categorias.map((categoria) => (
                      <TableRow key={categoria.id}>
                        <TableCell className="font-medium">{categoria.nome}</TableCell>
                        <TableCell>{categoria.descricao || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded-full border" 
                              style={{ backgroundColor: categoria.cor }}
                            />
                            <Badge 
                              style={{ 
                                backgroundColor: categoria.cor,
                                color: '#fff'
                              }}
                            >
                              {categoria.nome}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(categoria)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirm({ open: true, id: categoria.id, nome: categoria.nome })}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                  {editingCategoria ? 'Editar Categoria' : 'Nova Categoria'}
                </h3>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Voltar
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome da categoria"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição da categoria"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="grid grid-cols-5 gap-2">
                  {cores.map((cor) => (
                    <Button
                      key={cor}
                      type="button"
                      variant={formData.cor === cor ? "default" : "outline"}
                      className="h-12 p-0"
                      style={{ 
                        backgroundColor: formData.cor === cor ? cor : 'transparent',
                        borderColor: cor,
                        color: formData.cor === cor ? '#fff' : cor
                      }}
                      onClick={() => setFormData(prev => ({ ...prev, cor }))}
                    >
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-white" 
                        style={{ backgroundColor: cor }}
                      />
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div 
                    className="w-6 h-6 rounded-full border" 
                    style={{ backgroundColor: formData.cor }}
                  />
                  <Badge 
                    style={{ 
                      backgroundColor: formData.cor,
                      color: '#fff'
                    }}
                  >
                    {formData.nome || 'Preview'}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <AkurisPulse size={16} className="mr-2" />
                      Salvando...
                    </>
                  ) : (
                    editingCategoria ? 'Atualizar' : 'Criar'
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
    </DialogShell>

    <ConfirmDialog
      open={deleteConfirm.open}
      onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
      title="Excluir Categoria"
      description={`Tem certeza que deseja excluir a categoria "${deleteConfirm.nome}"? Esta ação não pode ser desfeita.`}
      confirmText="Excluir"
      cancelText="Cancelar"
      variant="destructive"
      onConfirm={handleDelete}
    />
    </>
  );
}