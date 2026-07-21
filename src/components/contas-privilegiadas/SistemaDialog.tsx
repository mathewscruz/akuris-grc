import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { UserSelect } from '@/components/riscos/UserSelect';
import { Server, Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const sistemaSchema = z.object({
  nome_sistema: z.string().min(1, 'Nome do sistema é obrigatório'),
  tipo_sistema: z.string().min(1, 'Tipo do sistema é obrigatório'),
  criticidade: z.string().min(1, 'Criticidade é obrigatória'),
  responsavel_sistema: z.string().optional(),
  url_sistema: z.string().url('URL inválida').optional().or(z.literal('')),
  categoria: z.string().optional(),
  observacoes: z.string().optional(),
  ativo: z.boolean().default(true),
});

type SistemaFormData = z.infer<typeof sistemaSchema>;

interface SistemaDialogProps {
  open: boolean;
  onClose: () => void;
  sistema?: any;
}

export default function SistemaDialog({ open, onClose, sistema }: SistemaDialogProps) {
  const { toast } = useToast();
  const { empresaId, loading: loadingEmpresa } = useEmpresaId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(sistema?.imagem_url || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const form = useForm<SistemaFormData>({
    resolver: zodResolver(sistemaSchema),
    defaultValues: {
      nome_sistema: sistema?.nome_sistema || '',
      tipo_sistema: sistema?.tipo_sistema || 'aplicacao',
      criticidade: sistema?.criticidade || 'media',
      responsavel_sistema: sistema?.responsavel_sistema || '',
      url_sistema: sistema?.url_sistema || '',
      categoria: sistema?.categoria || '',
      observacoes: sistema?.observacoes || '',
      ativo: sistema?.ativo ?? true,
    },
  });

  // Reset image preview + repopula o formulário quando abre (defaultValues só valem na 1ª montagem)
  React.useEffect(() => {
    if (open) {
      setImagePreview(sistema?.imagem_url || null);
      setImageFile(null);
      form.reset({
        nome_sistema: sistema?.nome_sistema || '',
        tipo_sistema: sistema?.tipo_sistema || 'aplicacao',
        criticidade: sistema?.criticidade || 'media',
        responsavel_sistema: sistema?.responsavel_sistema || '',
        url_sistema: sistema?.url_sistema || '',
        categoria: sistema?.categoria || '',
        observacoes: sistema?.observacoes || '',
        ativo: sistema?.ativo ?? true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sistema]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 2MB',
        variant: 'destructive',
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (sistemaId: string): Promise<string | null> => {
    if (!imageFile) return imagePreview; // Return existing URL if no new file

    setUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${sistemaId}.${fileExt}`;
      const filePath = `${empresaId}/${fileName}`;

      // Delete old image if exists
      if (sistema?.imagem_url) {
        const oldPath = sistema.imagem_url.split('/').slice(-2).join('/');
        await supabase.storage.from('sistema-logos').remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('sistema-logos')
        .upload(filePath, imageFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('sistema-logos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({
        title: 'Erro no upload',
        description: error.message || 'Não foi possível fazer upload da imagem',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const onSubmit = async (data: SistemaFormData) => {
    try {
      if (!empresaId) {
        throw new Error('Empresa não encontrada');
      }

      let sistemaId = sistema?.id;
      let imagemUrl = imagePreview;

      // Se não temos um sistema existente, precisamos criar primeiro para ter o ID
      if (!sistemaId) {
        const { data: newSistema, error: insertError } = await supabase
          .from('sistemas_privilegiados')
          .insert({
            nome_sistema: data.nome_sistema,
            tipo_sistema: data.tipo_sistema,
            criticidade: data.criticidade,
            empresa_id: empresaId,
            responsavel_sistema: data.responsavel_sistema || null,
            url_sistema: data.url_sistema || null,
            categoria: data.categoria || null,
            observacoes: data.observacoes || null,
            ativo: data.ativo,
          } as any)
          .select('id')
          .single();

        if (insertError) throw insertError;
        sistemaId = (newSistema as any).id;

        // Upload da imagem se houver
        if (imageFile) {
          imagemUrl = await uploadImage(sistemaId);
          if (imagemUrl) {
            await supabase
              .from('sistemas_privilegiados')
              .update({ imagem_url: imagemUrl } as any)
              .eq('id', sistemaId);
          }
        }

        toast({
          title: 'Sucesso',
          description: 'Sistema criado com sucesso',
        });
      } else {
        // Upload da imagem se houver nova
        if (imageFile) {
          imagemUrl = await uploadImage(sistemaId);
        }

        const payload = {
          ...data,
          responsavel_sistema: data.responsavel_sistema || null,
          url_sistema: data.url_sistema || null,
          categoria: data.categoria || null,
          observacoes: data.observacoes || null,
          imagem_url: imagemUrl,
        };

        const { error } = await supabase
          .from('sistemas_privilegiados')
          .update(payload as any)
          .eq('id', sistema.id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Sistema atualizado com sucesso',
        });
      }

      onClose();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar sistema',
        variant: 'destructive',
      });
    }
  };

  return (
    <DialogShell
        open={open}
        onOpenChange={onClose}
        title={`${sistema?.id ? "Editar" : "Novo"} Sistema Privilegiado`}
        icon={Server}
        size="lg"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={sistema ? 'Atualizar' : 'Criar Sistema'}
        isSubmitting={uploadingImage}
        isDirty={form.formState.isDirty}
      >
<Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Upload de Imagem */}
            <FormItem>
              <FormLabel>Imagem do Sistema</FormLabel>
              <div className="flex items-start gap-4">
                {/* Preview */}
                <div 
                  className={cn(
                    "relative flex items-center justify-center w-24 h-24 rounded-lg border-2 border-dashed transition-all",
                    imagePreview 
                      ? "border-primary bg-primary/5" 
                      : "border-border bg-muted/50"
                  )}
                >
                  {imagePreview ? (
                    <>
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="w-full h-full object-contain rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <Server className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {imagePreview ? 'Alterar Imagem' : 'Upload de Imagem'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG até 2MB. Recomendado: 200x200px
                  </p>
                </div>
              </div>
            </FormItem>

            <div className="grid grid-cols-2 gap-5">
              <FormField
                control={form.control}
                name="nome_sistema"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Sistema *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Active Directory" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo_sistema"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo do Sistema *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="aplicacao">Aplicação</SelectItem>
                        <SelectItem value="banco_dados">Banco de Dados</SelectItem>
                        <SelectItem value="sistema_operacional">Sistema Operacional</SelectItem>
                        <SelectItem value="rede">Rede/Infraestrutura</SelectItem>
                        <SelectItem value="nuvem">Nuvem</SelectItem>
                        <SelectItem value="erp">ERP</SelectItem>
                        <SelectItem value="crm">CRM</SelectItem>
                        <SelectItem value="bi">Business Intelligence</SelectItem>
                        <SelectItem value="seguranca">Segurança</SelectItem>
                        <SelectItem value="backup">Backup</SelectItem>
                        <SelectItem value="monitoramento">Monitoramento</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <FormField
                control={form.control}
                name="criticidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Criticidade *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a criticidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="critica">Crítica</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="core_business">Core Business</SelectItem>
                        <SelectItem value="suporte">Suporte</SelectItem>
                        <SelectItem value="infraestrutura">Infraestrutura</SelectItem>
                        <SelectItem value="seguranca">Segurança</SelectItem>
                        <SelectItem value="desenvolvimento">Desenvolvimento</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="rh">Recursos Humanos</SelectItem>
                        <SelectItem value="compliance">Compliance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="responsavel_sistema"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável pelo Sistema</FormLabel>
                    <FormControl>
                      <UserSelect
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        placeholder="Selecionar responsável..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url_sistema"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Sistema</FormLabel>
                    <FormControl>
                      <Input 
                        type="url" 
                        placeholder="https://sistema.exemplo.com" 
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Informações adicionais sobre o sistema..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ativo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Sistema Ativo</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      O sistema está em uso e aceita novas contas privilegiadas
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

          </form>
        </Form>
      </DialogShell>
  );
}
