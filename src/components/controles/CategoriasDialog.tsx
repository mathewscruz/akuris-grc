import { useState } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useEmpresaId } from "@/hooks/useEmpresaId";

interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
}

interface CategoriasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CategoriasDialog({ open, onOpenChange }: CategoriasDialogProps) {
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    cor: "#3B82F6"
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; nome?: string }>({ open: false, id: '' });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaId();

  const cores = [
    "#3B82F6", "#EF4444", "#10B981", "#F59E0B",
    "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"
  ];

  // Buscar categorias filtradas por empresa
  const { data: categorias = [] } = useQuery({
    queryKey: ['controles_categorias', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controles_categorias')
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('nome');
      
      if (error) throw error;
      return data as Categoria[];
    },
    enabled: open && !!empresaId
  });

  // Salvar categoria
  const saveCategoriaMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!empresaId) throw new Error('Empresa não encontrada');

      const categoriaData = {
        ...data,
        empresa_id: empresaId
      };

      if (editingId) {
        const { error } = await supabase
          .from('controles_categorias')
          .update(categoriaData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('controles_categorias')
          .insert([categoriaData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles_categorias'] });
      toast({
        title: editingId ? "Categoria atualizada" : "Categoria criada",
        description: editingId ? "A categoria foi atualizada com sucesso." : "A categoria foi criada com sucesso.",
      });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Não foi possível ${editingId ? 'atualizar' : 'criar'} a categoria: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Deletar categoria
  const deleteCategoriaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('controles_categorias')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles_categorias'] });
      toast({
        title: "Categoria excluída",
        description: "A categoria foi excluída com sucesso.",
      });
      setDeleteConfirm({ open: false, id: '' });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a categoria.",
        variant: "destructive",
      });
      setDeleteConfirm({ open: false, id: '' });
    }
  });

  const resetForm = () => {
    setFormData({ nome: "", descricao: "", cor: "#3B82F6" });
    setEditingId(null);
  };

  const handleEdit = (categoria: Categoria) => {
    setFormData({
      nome: categoria.nome,
      descricao: categoria.descricao || "",
      cor: categoria.cor
    });
    setEditingId(categoria.id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast({
        title: "Erro",
        description: "O nome da categoria é obrigatório.",
        variant: "destructive",
      });
      return;
    }
    saveCategoriaMutation.mutate(formData);
  };

  const handleDelete = (id: string, nome?: string) => {
    setDeleteConfirm({ open: true, id, nome });
  };

  const confirmDelete = () => {
    deleteCategoriaMutation.mutate(deleteConfirm.id);
  };

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        icon={Tag}
        title="Gerenciar Categorias"
        description="Crie e gerencie as categorias utilizadas para classificar os controles."
        size="lg"
        hideFooter
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome da categoria"
                  required
                />
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição da categoria"
                  rows={3}
                />
              </div>

              <div>
                <Label>Cor</Label>
                <div className="flex gap-2 mt-2">
                  {cores.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${formData.cor === cor ? 'border-gray-900' : 'border-gray-300'}`}
                      style={{ backgroundColor: cor }}
                      onClick={() => setFormData(prev => ({ ...prev, cor }))}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saveCategoriaMutation.isPending}>
                  {saveCategoriaMutation.isPending ? "Salvando..." : (editingId ? "Atualizar" : "Criar")}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Lista de categorias */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Categorias Existentes</h3>
            
            {categorias.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Plus className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhuma categoria criada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {categorias.map((categoria) => (
                  <Card key={categoria.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: categoria.cor }}
                          />
                          <CardTitle className="text-base">{categoria.nome}</CardTitle>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(categoria)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(categoria.id, categoria.nome)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {categoria.descricao && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground">
                          {categoria.descricao}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

      </DialogShell>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title="Excluir Categoria"
        description={`Tem certeza que deseja excluir "${deleteConfirm.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={confirmDelete}
        loading={deleteCategoriaMutation.isPending}
      />
    </>
  );
}
