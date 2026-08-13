import React, { useState, useRef, useMemo } from 'react';
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
import { useLanguage } from '@/contexts/LanguageContext';

type SistemaFormData = {
  nome_sistema: string;
  tipo_sistema: string;
  criticidade: string;
  responsavel_sistema?: string;
  url_sistema?: string;
  categoria?: string;
  observacoes?: string;
  ativo: boolean;
};

interface SistemaDialogProps {
  open: boolean;
  onClose: () => void;
  sistema?: any;
}

export default function SistemaDialog({ open, onClose, sistema }: SistemaDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { empresaId, loading: loadingEmpresa } = useEmpresaId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(sistema?.imagem_url || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const sistemaSchema = useMemo(() => z.object({
    nome_sistema: z.string().min(1, t('acessosDd.contas.sistemaDialog.zodNomeObrigatorio')),
    tipo_sistema: z.string().min(1, t('acessosDd.contas.sistemaDialog.zodTipoObrigatorio')),
    criticidade: z.string().min(1, t('acessosDd.contas.sistemaDialog.zodCriticidadeObrigatoria')),
    responsavel_sistema: z.string().optional(),
    url_sistema: z.string().url(t('acessosDd.contas.sistemaDialog.zodUrlInvalida')).optional().or(z.literal('')),
    categoria: z.string().optional(),
    observacoes: z.string().optional(),
    ativo: z.boolean().default(true),
  }), [t]);

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
        title: t('contasPrivilegiadasComp.sistemaDialog.toastArquivoInvalidoTitle'),
        description: t('contasPrivilegiadasComp.sistemaDialog.toastArquivoInvalidoDesc'),
        variant: 'destructive',
      });
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: t('contasPrivilegiadasComp.sistemaDialog.toastArquivoGrandeTitle'),
        description: t('contasPrivilegiadasComp.sistemaDialog.toastArquivoGrandeDesc'),
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
        title: t('contasPrivilegiadasComp.sistemaDialog.toastErrorUpload'),
        description: error.message || t('contasPrivilegiadasComp.sistemaDialog.toastErrorUploadDesc'),
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
        throw new Error(t('contasPrivilegiadasComp.sistemaDialog.toastEmpresaNaoEncontrada'));
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
          title: t('contasPrivilegiadasComp.sistemaDialog.toastSuccessTitle'),
          description: t('contasPrivilegiadasComp.sistemaDialog.toastCreated'),
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
          title: t('contasPrivilegiadasComp.sistemaDialog.toastSuccessTitle'),
          description: t('contasPrivilegiadasComp.sistemaDialog.toastUpdated'),
        });
      }

      onClose();
    } catch (error: any) {
      toast({
        title: t('contasPrivilegiadasComp.sistemaDialog.toastErrorTitle'),
        description: error.message || t('contasPrivilegiadasComp.sistemaDialog.toastErrorSave'),
        variant: 'destructive',
      });
    }
  };

  return (
    <DialogShell
        open={open}
        onOpenChange={onClose}
        title={sistema?.id ? t('contasPrivilegiadasComp.sistemaDialog.titleEdit') : t('contasPrivilegiadasComp.sistemaDialog.titleNew')}
        icon={Server}
        size="lg"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={sistema ? t('contasPrivilegiadasComp.sistemaDialog.submitUpdate') : t('contasPrivilegiadasComp.sistemaDialog.submitCreate')}
        isSubmitting={uploadingImage}
        isDirty={form.formState.isDirty}
      >
<Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Upload de Imagem */}
            <FormItem>
              <FormLabel>{t('contasPrivilegiadasComp.sistemaDialog.fieldImagem')}</FormLabel>
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
                    {imagePreview ? t('contasPrivilegiadasComp.sistemaDialog.buttonAlterarImagem') : t('contasPrivilegiadasComp.sistemaDialog.buttonUploadImagem')}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t('contasPrivilegiadasComp.sistemaDialog.imagemHint')}
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
                    <FormLabel>{t('contasPrivilegiadasComp.sistemaDialog.fieldNomeSistema')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('contasPrivilegiadasComp.sistemaDialog.fieldNomeSistemaPlaceholder')} {...field} />
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
                    <FormLabel>{t('contasPrivilegiadasComp.sistemaDialog.fieldTipoSistema')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('contasPrivilegiadasComp.sistemaDialog.fieldTipoSistemaPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="aplicacao">{t('contasPrivilegiadasComp.sistemaDialog.tipoAplicacao')}</SelectItem>
                        <SelectItem value="banco_dados">{t('contasPrivilegiadasComp.sistemaDialog.tipoBancoDados')}</SelectItem>
                        <SelectItem value="sistema_operacional">{t('contasPrivilegiadasComp.sistemaDialog.tipoSistemaOperacional')}</SelectItem>
                        <SelectItem value="rede">{t('contasPrivilegiadasComp.sistemaDialog.tipoRede')}</SelectItem>
                        <SelectItem value="nuvem">{t('contasPrivilegiadasComp.sistemaDialog.tipoNuvem')}</SelectItem>
                        <SelectItem value="erp">{t('contasPrivilegiadasComp.sistemaDialog.tipoErp')}</SelectItem>
                        <SelectItem value="crm">{t('contasPrivilegiadasComp.sistemaDialog.tipoCrm')}</SelectItem>
                        <SelectItem value="bi">{t('contasPrivilegiadasComp.sistemaDialog.tipoBi')}</SelectItem>
                        <SelectItem value="seguranca">{t('contasPrivilegiadasComp.sistemaDialog.tipoSeguranca')}</SelectItem>
                        <SelectItem value="backup">{t('contasPrivilegiadasComp.sistemaDialog.tipoBackup')}</SelectItem>
                        <SelectItem value="monitoramento">{t('contasPrivilegiadasComp.sistemaDialog.tipoMonitoramento')}</SelectItem>
                        <SelectItem value="outro">{t('contasPrivilegiadasComp.sistemaDialog.tipoOutro')}</SelectItem>
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
                    <FormLabel>{t('contasPrivilegiadasComp.sistemaDialog.fieldCriticidade')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('contasPrivilegiadasComp.sistemaDialog.fieldCriticidadePlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="critica">{t('contasPrivilegiadasComp.sistemaDialog.criticidadeCritica')}</SelectItem>
                        <SelectItem value="alta">{t('contasPrivilegiadasComp.sistemaDialog.criticidadeAlta')}</SelectItem>
                        <SelectItem value="media">{t('contasPrivilegiadasComp.sistemaDialog.criticidadeMedia')}</SelectItem>
                        <SelectItem value="baixa">{t('contasPrivilegiadasComp.sistemaDialog.criticidadeBaixa')}</SelectItem>
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
                    <FormLabel>{t('contasPrivilegiadasComp.sistemaDialog.fieldCategoria')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('contasPrivilegiadasComp.sistemaDialog.fieldCategoriaPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="core_business">{t('contasPrivilegiadasComp.sistemaDialog.categoriaCoreBusiness')}</SelectItem>
                        <SelectItem value="suporte">{t('contasPrivilegiadasComp.sistemaDialog.categoriaSuporte')}</SelectItem>
                        <SelectItem value="infraestrutura">{t('contasPrivilegiadasComp.sistemaDialog.categoriaInfraestrutura')}</SelectItem>
                        <SelectItem value="seguranca">{t('contasPrivilegiadasComp.sistemaDialog.categoriaSeguranca')}</SelectItem>
                        <SelectItem value="desenvolvimento">{t('contasPrivilegiadasComp.sistemaDialog.categoriaDesenvolvimento')}</SelectItem>
                        <SelectItem value="financeiro">{t('contasPrivilegiadasComp.sistemaDialog.categoriaFinanceiro')}</SelectItem>
                        <SelectItem value="rh">{t('contasPrivilegiadasComp.sistemaDialog.categoriaRh')}</SelectItem>
                        <SelectItem value="compliance">{t('contasPrivilegiadasComp.sistemaDialog.categoriaCompliance')}</SelectItem>
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
                    <FormLabel>{t('contasPrivilegiadasComp.sistemaDialog.fieldResponsavel')}</FormLabel>
                    <FormControl>
                      <UserSelect
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        placeholder={t('contasPrivilegiadasComp.sistemaDialog.fieldResponsavelPlaceholder')}
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
                    <FormLabel>{t('contasPrivilegiadasComp.sistemaDialog.fieldUrl')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="url" 
                        placeholder={t('contasPrivilegiadasComp.sistemaDialog.fieldUrlPlaceholder')} 
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
                  <FormLabel>{t('contasPrivilegiadasComp.sistemaDialog.fieldObservacoes')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t('contasPrivilegiadasComp.sistemaDialog.fieldObservacoesPlaceholder')}
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
                    <FormLabel className="text-base">{t('contasPrivilegiadasComp.sistemaDialog.fieldAtivo')}</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      {t('contasPrivilegiadasComp.sistemaDialog.fieldAtivoHint')}
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
