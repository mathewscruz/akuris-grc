
import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconAdd, IconEdit, IconDelete, IconTag } from '@/components/icons';
import { exigirEscrita } from '@/lib/supabase-write';

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
  const { t } = useLanguage();
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
      toast.error(t('riscosDialogs.categorias.erroCarregar', { mensagem: error.message }));
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
        toast.success(t('riscosDialogs.categorias.categoriaAtualizada'));
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
        toast.success(t('riscosDialogs.categorias.categoriaCriada'));
      }

      setFormData({ nome: '', descricao: '', cor: '#3B82F6' });
      setEditingCategoria(null);
      setShowForm(false);
      fetchCategorias();
      onSuccess();
    } catch (error: any) {
      toast.error(t('riscosDialogs.categorias.erroSalvar', { mensagem: error.message }));
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
      toast.success(t('riscosDialogs.categorias.categoriaExcluida'));
      setDeleteDialogOpen(false);
      setCategoriaToDelete(null);
      fetchCategorias();
      onSuccess();
    } catch (error: any) {
      toast.error(t('riscosDialogs.categorias.erroExcluir', { mensagem: error.message }));
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
      { nome: t('riscosDialogs.categorias.catOperacional'), descricao: t('riscosDialogs.categorias.catOperacionalDesc'), cor: '#EF4444' },
      { nome: t('riscosDialogs.categorias.catFinanceiro'), descricao: t('riscosDialogs.categorias.catFinanceiroDesc'), cor: '#10B981' },
      { nome: t('riscosDialogs.categorias.catEstrategico'), descricao: t('riscosDialogs.categorias.catEstrategicoDesc'), cor: '#3B82F6' },
      { nome: t('riscosDialogs.categorias.catRegulatorio'), descricao: t('riscosDialogs.categorias.catRegulatorioDesc'), cor: '#F59E0B' },
      { nome: t('riscosDialogs.categorias.catTecnologico'), descricao: t('riscosDialogs.categorias.catTecnologicoDesc'), cor: '#8B5CF6' },
      { nome: t('riscosDialogs.categorias.catReputacional'), descricao: t('riscosDialogs.categorias.catReputacionalDesc'), cor: '#EC4899' }
    ];

    try {
      setLoading(true);
      for (const categoria of defaultCategories) {
        await exigirEscrita(supabase
          .from('riscos_categorias')
          .insert({
            empresa_id: profile?.empresa_id,
            ...categoria
          }));
      }
      toast.success(t('riscosDialogs.categorias.categoriasPadraoCriadas'));
      fetchCategorias();
      onSuccess();
    } catch (error: any) {
      toast.error(t('riscosDialogs.categorias.erroCriarPadrao', { mensagem: error.message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        icon={IconTag}
        title={t('riscosDialogs.categorias.title')}
        description={t('riscosDialogs.categorias.description')}
        size="lg"
        hideFooter
      >
          <div className="space-y-6">
            {!showForm && (
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button onClick={handleNewCategoria} size="sm">
                    <IconAdd className="mr-2 h-4 w-4" />
                    {t('riscosDialogs.categorias.novaCategoria')}
                  </Button>
                  {categorias.length === 0 && (
                    <Button variant="outline" onClick={createDefaultCategories} size="sm" disabled={loading}>
                      {t('riscosDialogs.categorias.criarCategoriasPadrao')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {showForm && (
              <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">{t('riscosDialogs.categorias.nomeCategoria')}</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cor">{t('riscosDialogs.categorias.cor')}</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="descricao">{t('riscosDialogs.categorias.descricaoOpcional')}</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading}>
                    {editingCategoria ? t('riscosDialogs.categorias.atualizar') : t('riscosDialogs.categorias.criar')}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelForm}>
                    {t('riscosDialogs.categorias.cancelar')}
                  </Button>
                </div>
              </form>
            )}

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('riscosDialogs.categorias.nome')}</TableHead>
                    <TableHead>{t('riscosDialogs.categorias.cor')}</TableHead>
                    <TableHead>{t('riscosDialogs.categorias.descricao')}</TableHead>
                    <TableHead>{t('riscosDialogs.categorias.acoes')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        {t('riscosDialogs.categorias.carregandoCategorias')}
                      </TableCell>
                    </TableRow>
                  ) : categorias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        {t('riscosDialogs.categorias.nenhumaCategoria')}
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
                              <IconEdit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(categoria)}
                            >
                              <IconDelete className="h-4 w-4" />
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
        title={t('riscosDialogs.categorias.excluirCategoriaTitle')}
        description={t('riscosDialogs.categorias.excluirCategoriaDescricao', { nome: categoriaToDelete?.nome || '' })}
        variant="destructive"
        confirmText={t('riscosDialogs.categorias.excluir')}
        onConfirm={handleDelete}
      />
    </>
  );
}
