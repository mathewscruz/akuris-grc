import { useState } from "react";
import { IconAdd, IconEdit, IconDelete, IconTag } from '@/components/icons';
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();

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
        title: editingId ? t('controlesAuditorias.catToastUpdatedTitle') : t('controlesAuditorias.catToastCreatedTitle'),
        description: editingId ? t('controlesAuditorias.catToastUpdatedDesc') : t('controlesAuditorias.catToastCreatedDesc'),
      });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: t('controlesAuditorias.catToastErrorTitle'),
        description: t('controlesAuditorias.catToastSaveErrorDesc', { action: editingId ? t('controlesAuditorias.catActionUpdate') : t('controlesAuditorias.catActionCreate'), message: error.message }),
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
        title: t('controlesAuditorias.catToastDeletedTitle'),
        description: t('controlesAuditorias.catToastDeletedDesc'),
      });
      setDeleteConfirm({ open: false, id: '' });
    },
    onError: () => {
      toast({
        title: t('controlesAuditorias.catToastErrorTitle'),
        description: t('controlesAuditorias.catToastDeleteErrorDesc'),
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
        title: t('controlesAuditorias.catToastErrorTitle'),
        description: t('controlesAuditorias.catValidationNomeRequired'),
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
        icon={IconTag}
        title={t('controlesAuditorias.catDialogTitle')}
        description={t('controlesAuditorias.catDialogDescription')}
        size="lg"
        hideFooter
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">{t('controlesAuditorias.catFieldNome')}</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder={t('controlesAuditorias.catFieldNomePlaceholder')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">{t('controlesAuditorias.catFieldDescricao')}</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder={t('controlesAuditorias.catFieldDescricaoPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('controlesAuditorias.catFieldCor')}</Label>
                <div className="flex gap-2 mt-2">
                  {cores.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      // Botão só-cor: sem nome acessível o leitor de ecrã anunciava
                      // oito "botão" idênticos. `aria-pressed` diz qual está activa.
                      aria-label={t('controlesAuditorias.catCorEscolher', { cor })}
                      aria-pressed={formData.cor === cor}
                      className={`w-8 h-8 rounded-full border-2 ${formData.cor === cor ? 'border-foreground' : 'border-border'}`}
                      style={{ backgroundColor: cor }}
                      onClick={() => setFormData(prev => ({ ...prev, cor }))}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saveCategoriaMutation.isPending}>
                  {saveCategoriaMutation.isPending ? t('controlesAuditorias.catBtnSaving') : (editingId ? t('controlesAuditorias.catBtnUpdate') : t('controlesAuditorias.catBtnCreate'))}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {t('controlesAuditorias.catBtnCancel')}
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Lista de categorias */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('controlesAuditorias.catExistingTitle')}</h3>
            
            {categorias.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <IconAdd className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">{t('controlesAuditorias.catEmpty')}</p>
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
                            <IconEdit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(categoria.id, categoria.nome)}
                          >
                            <IconDelete className="w-4 h-4" />
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
        title={t('controlesAuditorias.catDeleteDialogTitle')}
        description={t('controlesAuditorias.catDeleteDialogDescription', { nome: deleteConfirm.nome || '' })}
        confirmText={t('controlesAuditorias.catDeleteConfirm')}
        cancelText={t('controlesAuditorias.catDeleteCancel')}
        variant="destructive"
        onConfirm={confirmDelete}
        loading={deleteCategoriaMutation.isPending}
      />
    </>
  );
}
