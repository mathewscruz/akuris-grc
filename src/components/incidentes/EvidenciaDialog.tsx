import { useState, useEffect } from 'react';
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
import { Upload, FileText, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const evidenciaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional(),
  tipo_evidencia: z.string().min(1, 'Tipo de evidência é obrigatório'),
});

type EvidenciaFormData = z.infer<typeof evidenciaSchema>;

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

    const { data } = supabase.storage
      .from('incidentes-evidencias')
      .getPublicUrl(filePath);

    return data.publicUrl;
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
        toast({ title: 'Evidência atualizada com sucesso!' });
      } else {
        const { error } = await supabase
          .from('incidentes_evidencias')
          .insert([evidenciaData]);

        if (error) throw error;
        toast({ title: 'Evidência registrada com sucesso!' });
      }

      setOpen(false);
      form.reset();
      setSelectedFile(null);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Erro',
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
              <FileText className="mr-2 h-4 w-4" />
              Nova Evidência
            </Button>
          )}
        </span>
      )}
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        icon={FileText}
        title={evidencia ? 'Editar Evidência' : 'Nova Evidência'}
        description={evidencia ? 'Atualize os dados da evidência.' : 'Registre uma evidência relacionada ao incidente.'}
        size="md"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={evidencia ? 'Atualizar' : 'Registrar'}
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
                  <FormLabel>Nome da Evidência *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome identificador da evidência" {...field} />
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
                  <FormLabel>Tipo de Evidência *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="documento">Documento</SelectItem>
                      <SelectItem value="screenshot">Screenshot</SelectItem>
                      <SelectItem value="log">Log de Sistema</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                      <SelectItem value="foto">Fotografia</SelectItem>
                      <SelectItem value="backup">Backup</SelectItem>
                      <SelectItem value="forense">Evidência Forense</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Arquivo</FormLabel>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {selectedFile ? 'Alterar Arquivo' : 'Selecionar Arquivo'}
                </Button>
                {selectedFile && (
                  <span className="text-sm text-muted-foreground">
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                )}
                {evidencia?.arquivo_nome && !selectedFile && (
                  <span className="text-sm text-muted-foreground">
                    Arquivo atual: {evidencia.arquivo_nome}
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
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o conteúdo e relevância da evidência..."
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