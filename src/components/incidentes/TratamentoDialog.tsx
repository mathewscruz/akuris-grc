import { useState, useEffect, useMemo } from 'react';
import { IconAdd, IconCalendar } from '@/components/icons';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { dateFnsLocale, formatarDiaParaDB, parseDataLocal } from '@/lib/date-utils';
const makeTratamentoSchema = (t: (key: string) => string) => z.object({
  titulo: z.string().min(1, t('modDialogs.incidentes.tratamento.validation.tituloRequired')),
  descricao: z.string().min(1, t('modDialogs.incidentes.tratamento.validation.descricaoRequired')),
  tipo_acao: z.string().min(1, t('modDialogs.incidentes.tratamento.validation.tipoRequired')),
  responsavel_id: z.string().optional(),
  data_prazo: z.date().optional(),
  observacoes: z.string().optional(),
});

type TratamentoFormData = z.infer<ReturnType<typeof makeTratamentoSchema>>;

interface TratamentoDialogProps {
  incidenteId: string;
  tratamento?: any;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function TratamentoDialog({ incidenteId, tratamento, onSuccess, trigger, externalOpen, onExternalOpenChange }: TratamentoDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled) {
      onExternalOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const { toast } = useToast();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const tratamentoSchema = useMemo(() => makeTratamentoSchema(t), [t]);

  const form = useForm<TratamentoFormData>({
    resolver: zodResolver(tratamentoSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      tipo_acao: 'corretiva',
      responsavel_id: '',
      observacoes: '',
    },
  });

  useEffect(() => {
    if (tratamento) {
      form.reset({
        titulo: tratamento.titulo || '',
        descricao: tratamento.descricao || '',
        tipo_acao: tratamento.tipo_acao || 'corretiva',
        responsavel_id: tratamento.responsavel_id || '',
        data_prazo: tratamento.data_prazo ? parseDataLocal(tratamento.data_prazo) : undefined,
        observacoes: tratamento.observacoes || '',
      });
    }
  }, [tratamento, form]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!profile?.empresa_id) return;
      const { data } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .eq('empresa_id', profile.empresa_id)
        .eq('ativo', true)
        .order('nome');
      if (data) setUsers(data);
    };

    if (open) {
      loadUsers();
    }
  }, [open, profile?.empresa_id]);

  const onSubmit = async (data: TratamentoFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const tratamentoData = {
        titulo: data.titulo!,
        descricao: data.descricao!,
        tipo_acao: data.tipo_acao!,
        // `responsavel_id` é `uuid` e o campo é opcional: sem esta conversão,
        // guardar um tratamento sem responsável falhava com "invalid input
        // syntax for type uuid".
        responsavel_id: data.responsavel_id || null,
        data_prazo: data.data_prazo ? formatarDiaParaDB(data.data_prazo) : undefined,
        observacoes: data.observacoes,
        incidente_id: incidenteId,
        created_by: userData.user?.id,
      };

      if (tratamento) {
        const { error } = await supabase
          .from('incidentes_tratamentos')
          .update(tratamentoData)
          .eq('id', tratamento.id);

        if (error) throw error;
        toast({ title: t('incidentesComp.tratamento.toastUpdated') });
      } else {
        const { error } = await supabase
          .from('incidentes_tratamentos')
          .insert([tratamentoData]);

        if (error) throw error;
        toast({ title: t('incidentesComp.tratamento.toastCreated') });
      }

      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: t('incidentesComp.tratamento.toastErrorTitle'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isControlled && (
        <span onClick={() => setOpen(true)} className="inline-flex">
          {trigger || (
            <Button size="sm">
              <IconAdd className="mr-2 h-4 w-4" />
              {t('incidentesComp.tratamento.newButton')}
            </Button>
          )}
        </span>
      )}
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        icon={IconAdd}
        title={tratamento ? t('incidentesComp.tratamento.titleEdit') : t('incidentesComp.tratamento.titleNew')}
        description={tratamento ? t('incidentesComp.tratamento.descEdit') : t('incidentesComp.tratamento.descNew')}
        size="md"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={tratamento ? t('incidentesComp.tratamento.submitUpdate') : t('incidentesComp.tratamento.submitCreate')}
        isSubmitting={loading}
        isDirty={form.formState.isDirty}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('incidentesComp.tratamento.fieldTitulo')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('incidentesComp.tratamento.fieldTituloPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_acao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('incidentesComp.tratamento.fieldTipoAcao')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('incidentesComp.tratamento.fieldTipoAcaoPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="corretiva">{t('incidentesComp.tratamento.tipoCorretiva')}</SelectItem>
                        <SelectItem value="preventiva">{t('incidentesComp.tratamento.tipoPreventiva')}</SelectItem>
                        <SelectItem value="investigativa">{t('incidentesComp.tratamento.tipoInvestigativa')}</SelectItem>
                        <SelectItem value="contenção">{t('incidentesComp.tratamento.tipoContencao')}</SelectItem>
                        <SelectItem value="comunicacao">{t('incidentesComp.tratamento.tipoComunicacao')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsavel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('incidentesComp.tratamento.fieldResponsavel')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('incidentesComp.tratamento.fieldResponsavelPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.nome} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="data_prazo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('incidentesComp.tratamento.fieldDataPrazo')}</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP', { locale: dateFnsLocale() })
                          ) : (
                            <span>{t('incidentesComp.tratamento.fieldDataPrazoPlaceholder')}</span>
                          )}
                          <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('incidentesComp.tratamento.fieldDescricao')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('incidentesComp.tratamento.fieldDescricaoPlaceholder')}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('incidentesComp.tratamento.fieldObservacoes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('incidentesComp.tratamento.fieldObservacoesPlaceholder')}
                      rows={2}
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