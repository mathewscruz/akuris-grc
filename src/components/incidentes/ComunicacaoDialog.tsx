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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const comunicacaoSchema = z.object({
  tipo_comunicacao: z.string().min(1, 'Tipo de comunicação é obrigatório'),
  destinatario: z.string().min(1, 'Destinatário é obrigatório'),
  meio_comunicacao: z.string().min(1, 'Meio de comunicação é obrigatório'),
  data_comunicacao: z.date().optional(),
  observacoes: z.string().optional(),
  template_usado: z.string().optional(),
});

type ComunicacaoFormData = z.infer<typeof comunicacaoSchema>;

interface ComunicacaoDialogProps {
  incidenteId: string;
  comunicacao?: any;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function ComunicacaoDialog({ incidenteId, comunicacao, onSuccess, trigger, externalOpen, onExternalOpenChange }: ComunicacaoDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onExternalOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ComunicacaoFormData>({
    resolver: zodResolver(comunicacaoSchema),
    defaultValues: {
      tipo_comunicacao: '',
      destinatario: '',
      meio_comunicacao: 'email',
      observacoes: '',
      template_usado: '',
    },
  });

  useEffect(() => {
    if (comunicacao) {
      form.reset({
        tipo_comunicacao: comunicacao.tipo_comunicacao || '',
        destinatario: comunicacao.destinatario || '',
        meio_comunicacao: comunicacao.meio_comunicacao || 'email',
        data_comunicacao: comunicacao.data_comunicacao ? new Date(comunicacao.data_comunicacao) : new Date(),
        observacoes: comunicacao.observacoes || '',
        template_usado: comunicacao.template_usado || '',
      });
    } else {
      form.reset({
        tipo_comunicacao: '',
        destinatario: '',
        meio_comunicacao: 'email',
        data_comunicacao: new Date(),
        observacoes: '',
        template_usado: '',
      });
    }
  }, [comunicacao, form]);

  const onSubmit = async (data: ComunicacaoFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const comunicacaoData = {
        tipo_comunicacao: data.tipo_comunicacao!,
        destinatario: data.destinatario!,
        meio_comunicacao: data.meio_comunicacao!,
        data_comunicacao: data.data_comunicacao?.toISOString(),
        observacoes: data.observacoes,
        template_usado: data.template_usado,
        incidente_id: incidenteId,
        created_by: userData.user?.id,
      };

      if (comunicacao) {
        const { error } = await supabase
          .from('incidentes_comunicacoes')
          .update(comunicacaoData)
          .eq('id', comunicacao.id);

        if (error) throw error;
        toast({ title: 'Comunicação atualizada com sucesso!' });
      } else {
        const { error } = await supabase
          .from('incidentes_comunicacoes')
          .insert([comunicacaoData]);

        if (error) throw error;
        toast({ title: 'Comunicação registrada com sucesso!' });
      }

      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const templatesComunicacao = [
    'Notificação ANPD - Vazamento de Dados',
    'Comunicação Interna - Incidente de Segurança',
    'Comunicação Cliente - Interrupção de Serviço',
    'Relatório Autoridades - Incidente Crítico',
    'Comunicação Fornecedor - Problema de Segurança',
  ];

  return (
    <>
      {!isControlled && (
        <span onClick={() => setOpen(true)} className="inline-flex">
          {trigger || (
            <Button size="sm" variant="outline">
              <MessageSquare className="mr-2 h-4 w-4" />
              Nova Comunicação
            </Button>
          )}
        </span>
      )}
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        icon={MessageSquare}
        title={comunicacao ? 'Editar Comunicação' : 'Nova Comunicação'}
        description={comunicacao ? 'Atualize os dados da comunicação.' : 'Registre uma comunicação relacionada ao incidente.'}
        size="md"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={comunicacao ? 'Atualizar' : 'Registrar'}
        isSubmitting={loading}
        isDirty={form.formState.isDirty}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_comunicacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Comunicação *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="anpd">Notificação ANPD</SelectItem>
                        <SelectItem value="interna">Comunicação Interna</SelectItem>
                        <SelectItem value="cliente">Comunicação Cliente</SelectItem>
                        <SelectItem value="fornecedor">Comunicação Fornecedor</SelectItem>
                        <SelectItem value="autoridade">Autoridade Competente</SelectItem>
                        <SelectItem value="imprensa">Imprensa</SelectItem>
                        <SelectItem value="outras">Outras</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="meio_comunicacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meio de Comunicação *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o meio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="oficio">Ofício</SelectItem>
                        <SelectItem value="sistema">Sistema</SelectItem>
                        <SelectItem value="presencial">Presencial</SelectItem>
                        <SelectItem value="portal">Portal Web</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="destinatario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destinatário *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome/organização do destinatário" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="data_comunicacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data da Comunicação</FormLabel>
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
                            format(field.value, 'PPP', { locale: ptBR })
                          ) : (
                            <span>Selecione uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date()}
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
              name="template_usado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Utilizado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um template (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {templatesComunicacao.map((template) => (
                        <SelectItem key={template} value={template}>
                          {template}
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
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalhes da comunicação, resposta recebida, etc..."
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