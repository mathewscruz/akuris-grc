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
import { CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';

const tratamentoSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  tipo_acao: z.string().min(1, 'Tipo de ação é obrigatório'),
  responsavel_id: z.string().optional(),
  data_prazo: z.date().optional(),
  observacoes: z.string().optional(),
});

type TratamentoFormData = z.infer<typeof tratamentoSchema>;

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
        data_prazo: tratamento.data_prazo ? new Date(tratamento.data_prazo) : undefined,
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
        responsavel_id: data.responsavel_id,
        data_prazo: data.data_prazo?.toISOString().split('T')[0],
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
        toast({ title: 'Tratamento atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('incidentes_tratamentos')
          .insert([tratamentoData]);

        if (error) throw error;
        toast({ title: 'Tratamento registrado com sucesso!' });
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

  return (
    <>
      {!isControlled && (
        <span onClick={() => setOpen(true)} className="inline-flex">
          {trigger || (
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nova Ação
            </Button>
          )}
        </span>
      )}
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        icon={Plus}
        title={tratamento ? 'Editar Ação de Tratamento' : 'Nova Ação de Tratamento'}
        description={tratamento ? 'Atualize a ação de tratamento.' : 'Registre uma nova ação para tratar o incidente.'}
        size="md"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={tratamento ? 'Atualizar' : 'Registrar'}
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
                  <FormLabel>Título da Ação *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Trocar senhas comprometidas" {...field} />
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
                    <FormLabel>Tipo de Ação *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="corretiva">Corretiva</SelectItem>
                        <SelectItem value="preventiva">Preventiva</SelectItem>
                        <SelectItem value="investigativa">Investigativa</SelectItem>
                        <SelectItem value="contenção">Contenção</SelectItem>
                        <SelectItem value="comunicacao">Comunicação</SelectItem>
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
                    <FormLabel>Responsável</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o responsável" />
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
                  <FormLabel>Data Prazo</FormLabel>
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
                  <FormLabel>Descrição da Ação *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva detalhadamente a ação a ser executada..."
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
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações adicionais..."
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