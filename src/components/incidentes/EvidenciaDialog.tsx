import { useState, useEffect, useMemo } from 'react';
import { IconAdd, IconUpload, IconFile } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DialogShell } from '@/components/ui/dialog-shell';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
;
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const makeEvidenciaSchema = (t: (key: string) => string) => z.object({
  nome: z.string().min(1, t('modDialogs.incidentes.evidencia.validation.nomeRequired')),
  descricao: z.string().optional(),
  tipo_evidencia: z.string().min(1, t('modDialogs.incidentes.evidencia.validation.tipoRequired')),
});

type EvidenciaFormData = z.infer<ReturnType<typeof makeEvidenciaSchema>>;

interface EvidenciaDialogProps {
  incidenteId: string;
  evidencia?: any;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function EvidenciaDialog({ incidenteId, evidencia, onSuccess, trigger, externalOpen, onExternalOpenChange }: EvidenciaDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onExternalOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
  const evidenciaSchema = useMemo(() => makeEvidenciaSchema(t), [t]);

  const form = useForm<EvidenciaFormData>({
    resolver: zodResolver(evidenciaSchema),
    defaultValues: {
      nome: '',
      descricao: '',
      tipo_evidencia: 'documento',
    },
  });

  useEffect(() => {
    if (evidencia) {
      form.reset({
        nome: evidencia.nome || '',
        descricao: evidencia.descricao || '',
        tipo_evidencia: evidencia.tipo_evidencia || 'documento',
      });
    }
  }, [evidencia, form]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-preencher nome se estiver vazio
      if (!form.getValues('nome')) {
        form.setValue('nome', file.name);
      }
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `incidentes/${incidenteId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('incidentes-evidencias')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    // Bucket privado — armazenamos o PATH; consumidores devem usar
    // openStorageFile('incidentes-evidencias', path) para gerar signed URL.
    return filePath;
  };

  const onSubmit = async (data: EvidenciaFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      let arquivo_url = evidencia?.arquivo_url;
      let arquivo_nome = evidencia?.arquivo_nome;
      let arquivo_tipo = evidencia?.arquivo_tipo;
      let arquivo_tamanho = evidencia?.arquivo_tamanho;

      // Upload do arquivo se um novo foi selecionado
      if (selectedFile) {
        setUploading(true);
        arquivo_url = await uploadFile(selectedFile);
        arquivo_nome = selectedFile.name;
        arquivo_tipo = selectedFile.type;
        arquivo_tamanho = selectedFile.size;
        setUploading(false);
      }

      const evidenciaData = {
        nome: data.nome!,
        descricao: data.descricao,
        tipo_evidencia: data.tipo_evidencia!,
        incidente_id: incidenteId,
        arquivo_url,
        arquivo_nome,
        arquivo_tipo,
        arquivo_tamanho,
        created_by: userData.user?.id,
      };

      if (evidencia) {
        const { error } = await supabase
          .from('incidentes_evidencias')
          .update(evidenciaData)
          .eq('id', evidencia.id);

        if (error) throw error;
        toast({ title: t('incidentesComp.evidencia.toastUpdated') });
      } else {
        const { error } = await supabase
          .from('incidentes_evidencias')
          .insert([evidenciaData]);

        if (error) throw error;
        toast({ title: t('incidentesComp.evidencia.toastCreated') });
      }

      setOpen(false);
      form.reset();
      setSelectedFile(null);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: t('incidentesComp.evidencia.toastErrorTitle'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <>
      {!isControlled && (
        <span onClick={() => setOpen(true)} className="inline-flex">
          {trigger || (
            <Button size="sm" variant="outline">
              <IconFile className="mr-2 h-4 w-4" />
              {t('incidentesComp.evidencia.newButton')}
            </Button>
          )}
        </span>
      )}
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        icon={IconFile}
        title={evidencia ? t('incidentesComp.evidencia.titleEdit') : t('incidentesComp.evidencia.titleNew')}
        description={evidencia ? t('incidentesComp.evidencia.descEdit') : t('incidentesComp.evidencia.descNew')}
        size="md"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={evidencia ? t('incidentesComp.evidencia.submitUpdate') : t('incidentesComp.evidencia.submitCreate')}
        isSubmitting={loading || uploading}
        isDirty={form.formState.isDirty || !!selectedFile}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('incidentesComp.evidencia.fieldNome')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('incidentesComp.evidencia.fieldNomePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo_evidencia"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('incidentesComp.evidencia.fieldTipo')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('incidentesComp.evidencia.fieldTipoPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="documento">{t('incidentesComp.evidencia.tipoDocumento')}</SelectItem>
                      <SelectItem value="screenshot">{t('incidentesComp.evidencia.tipoScreenshot')}</SelectItem>
                      <SelectItem value="log">{t('incidentesComp.evidencia.tipoLog')}</SelectItem>
                      <SelectItem value="video">{t('incidentesComp.evidencia.tipoVideo')}</SelectItem>
                      <SelectItem value="audio">{t('incidentesComp.evidencia.tipoAudio')}</SelectItem>
                      <SelectItem value="foto">{t('incidentesComp.evidencia.tipoFoto')}</SelectItem>
                      <SelectItem value="backup">{t('incidentesComp.evidencia.tipoBackup')}</SelectItem>
                      <SelectItem value="forense">{t('incidentesComp.evidencia.tipoForense')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>{t('incidentesComp.evidencia.fieldArquivo')}</FormLabel>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="flex items-center gap-2"
                >
                  <IconUpload className="h-4 w-4" />
                  {selectedFile ? t('incidentesComp.evidencia.buttonAlterarArquivo') : t('incidentesComp.evidencia.buttonSelecionarArquivo')}
                </Button>
                {selectedFile && (
                  <span className="text-sm text-muted-foreground">
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                )}
                {evidencia?.arquivo_nome && !selectedFile && (
                  <span className="text-sm text-muted-foreground">
                    {t('incidentesComp.evidencia.arquivoAtual', { nome: evidencia.arquivo_nome })}
                  </span>
                )}
              </div>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.txt,.zip,.rar"
              />
            </div>

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('incidentesComp.evidencia.fieldDescricao')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('incidentesComp.evidencia.fieldDescricaoPlaceholder')}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </form>
        </Form>
      </DialogShell>
    </>
  );
}