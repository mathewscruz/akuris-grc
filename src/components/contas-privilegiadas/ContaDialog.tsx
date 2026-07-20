import React from 'react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, KeyRound } from "lucide-react";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useQueryClient } from '@tanstack/react-query';

const contaSchema = z.object({
  usuario_beneficiario: z.string().min(1, 'Nome do usuário é obrigatório'),
  email_beneficiario: z.string().email('Email inválido').optional().or(z.literal('')),
  sistema_id: z.string().min(1, 'Sistema é obrigatório'),
  tipo_acesso: z.string().min(1, 'Tipo de acesso é obrigatório'),
  nivel_privilegio: z.string().min(1, 'Nível de privilégio é obrigatório'),
  data_concessao: z.date({
    required_error: 'Data de concessão é obrigatória',
  }),
  data_expiracao: z.date({
    required_error: 'Data de expiração é obrigatória',
  }),
  justificativa_negocio: z.string().min(10, 'Justificativa deve ter pelo menos 10 caracteres'),
  renovavel: z.boolean().default(true),
  observacoes: z.string().optional(),
});

type ContaFormData = z.infer<typeof contaSchema>;

interface ContaDialogProps {
  open: boolean;
  onClose: () => void;
  conta?: any;
  sistemas: any[];
}

export default function ContaDialog({ open, onClose, conta, sistemas }: ContaDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { empresaId, loading: loadingEmpresa } = useEmpresaId();
  const queryClient = useQueryClient();
  
  const form = useForm<ContaFormData>({
    resolver: zodResolver(contaSchema),
    defaultValues: {
      usuario_beneficiario: conta?.usuario_beneficiario || '',
      email_beneficiario: conta?.email_beneficiario || '',
      sistema_id: conta?.sistema_id || '',
      tipo_acesso: conta?.tipo_acesso || 'administrativo',
      nivel_privilegio: conta?.nivel_privilegio || 'alto',
      data_concessao: conta?.data_concessao ? new Date(conta.data_concessao) : new Date(),
      data_expiracao: conta?.data_expiracao ? new Date(conta.data_expiracao) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 dias
      justificativa_negocio: conta?.justificativa_negocio || '',
      renovavel: conta?.renovavel ?? true,
      observacoes: conta?.observacoes || '',
    },
  });

  const onSubmit = async (data: ContaFormData) => {
    try {
      if (!empresaId) {
        throw new Error('Empresa não encontrada');
      }

      // Validar se o sistema pertence à empresa
      const { data: sistema, error: sistemaError } = await supabase
        .from('sistemas_privilegiados')
        .select('empresa_id')
        .eq('id', data.sistema_id)
        .single();

      if (sistemaError || !sistema) {
        throw new Error('Sistema não encontrado');
      }

      if (sistema.empresa_id !== empresaId) {
        throw new Error('Sistema não pertence à sua empresa');
      }

      const payload = {
        ...data,
        empresa_id: empresaId,
        email_beneficiario: data.email_beneficiario || null,
        observacoes: data.observacoes || null,
        created_by: user?.id,
      };

      if (conta?.id) {
        const { error } = await supabase
          .from('contas_privilegiadas' as any)
          .update(payload)
          .eq('id', conta.id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Conta privilegiada atualizada com sucesso',
        });
      } else {
        const { error } = await supabase
          .from('contas_privilegiadas' as any)
          .insert(payload);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Conta privilegiada criada com sucesso',
        });
      }

      // Invalidar cache para forçar atualização
      await queryClient.invalidateQueries({ queryKey: ['contas-privilegiadas'] });
      
      onClose();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar conta privilegiada',
        variant: 'destructive',
      });
    }
  };

  return (
    <DialogShell
        open={open}
        onOpenChange={onClose}
        title={`${conta?.id ? "Editar" : "Nova"} Conta Privilegiada`}
        icon={KeyRound}
        size="lg"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={conta ? 'Atualizar' : 'Criar Conta'}
        isDirty={form.formState.isDirty}
      >
<Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <FormField
                control={form.control}
                name="usuario_beneficiario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Usuário *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo do usuário" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email_beneficiario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email do Usuário</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="sistema_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sistema *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o sistema" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sistemas.map((sistema) => (
                        <SelectItem key={sistema.id} value={sistema.id}>
                          {sistema.nome_sistema} ({sistema.tipo_sistema})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-5">
              <FormField
                control={form.control}
                name="tipo_acesso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Acesso *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="administrativo">Administrativo</SelectItem>
                        <SelectItem value="operacional">Operacional</SelectItem>
                        <SelectItem value="consulta_privilegiada">Consulta Privilegiada</SelectItem>
                        <SelectItem value="backup">Backup/Restore</SelectItem>
                        <SelectItem value="desenvolvimento">Desenvolvimento</SelectItem>
                        <SelectItem value="auditoria">Auditoria</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nivel_privilegio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível de Privilégio *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o nível" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="critico">Crítico</SelectItem>
                        <SelectItem value="alto">Alto</SelectItem>
                        <SelectItem value="medio">Médio</SelectItem>
                        <SelectItem value="baixo">Baixo</SelectItem>
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
                name="data_concessao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Concessão *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy")
                            ) : (
                              <span>Selecione a data</span>
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
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_expiracao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Expiração *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy")
                            ) : (
                              <span>Selecione a data</span>
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
                          disabled={(date) =>
                            date < new Date()
                          }
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="justificativa_negocio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justificativa de Negócio *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva a justificativa para a concessão deste acesso privilegiado..."
                      className="min-h-[100px]"
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
                      placeholder="Informações adicionais (opcional)..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="renovavel"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Acesso Renovável</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Este acesso pode ser renovado automaticamente
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