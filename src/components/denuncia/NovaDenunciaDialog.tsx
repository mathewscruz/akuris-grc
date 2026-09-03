import { useState, useEffect } from 'react';
import { IconAdd } from '@/components/icons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
;
import { Button } from '@/components/ui/button';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateField } from '@/components/ui/date-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';

interface NovaDenunciaDialogProps {
  onDenunciaCriada?: () => void;
}

interface Categoria {
  id: string;
  nome: string;
}

function buildSchema(t: (key: string) => string) {
  return z.object({
    categoria_id: z.string().min(1, t('publicPortal.denunciaForm.validation.category')),
    titulo: z.string().min(5, t('publicPortal.denunciaForm.validation.title')),
    descricao: z.string().min(20, t('publicPortal.denunciaForm.validation.description')),
    gravidade: z.enum(['baixo', 'medio', 'alto', 'critico']),
    status: z.enum(['nova', 'em_analise', 'em_investigacao', 'resolvida', 'arquivada']),
    local_ocorrencia: z.string().optional(),
    data_ocorrencia: z.string().optional(),
    anonima: z.boolean().default(false),
    nome_denunciante: z.string().optional(),
    email_denunciante: z.string().email(t('publicPortal.denunciaForm.validation.email')).optional().or(z.literal('')),
    telefone_denunciante: z.string().optional(),
    testemunhas: z.string().optional(),
    evidencias_descricao: z.string().optional(),
  });
}

type NovaDenunciaFormData = z.infer<ReturnType<typeof buildSchema>>;

export function NovaDenunciaDialog({ onDenunciaCriada }: NovaDenunciaDialogProps) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const [open, setOpen] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NovaDenunciaFormData>({
    resolver: zodResolver(buildSchema(t)),
    defaultValues: {
      categoria_id: '',
      titulo: '',
      descricao: '',
      gravidade: 'medio',
      status: 'nova',
      local_ocorrencia: '',
      data_ocorrencia: '',
      anonima: false,
      nome_denunciante: '',
      email_denunciante: '',
      telefone_denunciante: '',
      testemunhas: '',
      evidencias_descricao: '',
    },
  });

  const watchAnonima = form.watch('anonima');

  useEffect(() => {
    if (open && empresaId) {
      carregarCategorias();
    }
  }, [open, empresaId]);

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const carregarCategorias = async () => {
    if (!empresaId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('denuncias_categorias')
        .select('id, nome')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setCategorias(data || []);
    } catch (error) {
      logger.error('Erro ao carregar categorias', { module: 'NovaDenunciaDialog', error: String(error) });
      toast.error(t('denunciasAdmin.categorias.errorLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (values: NovaDenunciaFormData) => {
    if (!empresaId) {
      toast.error(t('common.error'));
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('criar_denuncia_manual', {
        p_empresa_id: empresaId,
        p_titulo: values.titulo,
        p_descricao: values.descricao,
        p_categoria_id: values.categoria_id || null,
        p_gravidade: values.gravidade,
        p_status: values.status,
        p_nome_denunciante: values.anonima ? null : values.nome_denunciante || null,
        p_email_denunciante: values.anonima ? null : values.email_denunciante || null,
        p_anonima: values.anonima,
        p_local_ocorrencia: values.local_ocorrencia || null,
        p_data_ocorrencia: values.data_ocorrencia || null,
        p_denunciante_telefone: values.telefone_denunciante || null,
        p_testemunhas: values.testemunhas || null,
        p_evidencias_descricao: values.evidencias_descricao || null,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      if (result?.protocolo) {
        toast.success(
          t('denunciasAdmin.novaDenuncia.toastSuccess', { protocolo: result.protocolo })
        );
      } else {
        toast.success(t('denunciasAdmin.novaDenuncia.toastSuccessGeneric'));
      }

      setOpen(false);
      onDenunciaCriada?.();
    } catch (error) {
      logger.error('Erro ao criar denúncia manual', { module: 'NovaDenunciaDialog', error: String(error) });
      toast.error(t('denunciasAdmin.novaDenuncia.toastError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions = [
    { value: 'nova', label: t('denunciasAdmin.dialog.statusNova') },
    { value: 'em_analise', label: t('denunciasAdmin.dialog.statusEmAnalise') },
    { value: 'em_investigacao', label: t('denunciasAdmin.dialog.statusEmInvestigacao') },
    { value: 'resolvida', label: t('denunciasAdmin.dialog.statusResolvida') },
    { value: 'arquivada', label: t('denunciasAdmin.dialog.statusArquivada') },
  ];

  const gravidadeOptions = [
    { value: 'baixo', label: t('denunciasAdmin.dialog.gravidadeBaixa') },
    { value: 'medio', label: t('denunciasAdmin.dialog.gravidadeMedia') },
    { value: 'alto', label: t('denunciasAdmin.dialog.gravidadeAlta') },
    { value: 'critico', label: t('denunciasAdmin.dialog.gravidadeCritica') },
  ];

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconAdd className="mr-2 h-4 w-4" />
        {t('denunciasAdmin.novaDenuncia.button')}
      </Button>

      <DialogShell
        open={open}
        onOpenChange={setOpen}
        title={t('denunciasAdmin.novaDenuncia.title')}
        description={t('denunciasAdmin.novaDenuncia.description')}
        size="lg"
        onSubmit={form.handleSubmit(handleSubmit)}
        submitLabel={t('denunciasAdmin.novaDenuncia.save')}
        cancelLabel={t('common.cancel')}
        isSubmitting={isSubmitting}
        submitDisabled={isLoading || !form.formState.isValid}
        isDirty={form.formState.isDirty}
      >
        <Form {...form}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoria_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('publicPortal.denunciaForm.category')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('publicPortal.denunciaForm.categoryPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('publicPortal.denunciaForm.title')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('publicPortal.denunciaForm.titlePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('publicPortal.denunciaForm.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('publicPortal.denunciaForm.descriptionPlaceholder')}
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gravidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('denunciasAdmin.dialog.labelGravidade')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {gravidadeOptions.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('denunciasAdmin.dialog.labelStatus')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="local_ocorrencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('publicPortal.denunciaForm.place')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('publicPortal.denunciaForm.placePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_ocorrencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('publicPortal.denunciaForm.date')}</FormLabel>
                    <FormControl>
                      <DateField
                        value={field.value || null}
                        onChange={(value) => field.onChange(value || '')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t border-border/50 pt-4">
              <FormField
                control={form.control}
                name="anonima"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('denunciasAdmin.novaDenuncia.anonymousLabel')}
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {t('denunciasAdmin.novaDenuncia.anonymousHint')}
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {!watchAnonima && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome_denunciante"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('publicPortal.denunciaForm.namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email_denunciante"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.email')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefone_denunciante"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.phone')}</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="testemunhas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('publicPortal.denunciaForm.witnesses')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('publicPortal.denunciaForm.witnessesPlaceholder')}
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="evidencias_descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('publicPortal.denunciaForm.evidence')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('publicPortal.denunciaForm.evidencePlaceholder')}
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Form>
      </DialogShell>
    </>
  );
}
