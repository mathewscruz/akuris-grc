import React, { useMemo } from 'react';
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
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconCalendar, IconKey } from '@/components/icons';
import { datePattern, parseDataLocal } from '@/lib/date-utils';
interface ContaDialogProps {
  open: boolean;
  onClose: () => void;
  conta?: any;
  sistemas: any[];
}

export default function ContaDialog({ open, onClose, conta, sistemas }: ContaDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const { empresaId, loading: loadingEmpresa } = useEmpresaId();
  const queryClient = useQueryClient();

  const contaSchema = useMemo(() => z.object({
    usuario_beneficiario: z.string().min(1, t('acessosDd.contas.contaDialog.zodNomeObrigatorio')),
    email_beneficiario: z.string().email(t('acessosDd.contas.contaDialog.zodEmailInvalido')).optional().or(z.literal('')),
    sistema_id: z.string().min(1, t('acessosDd.contas.contaDialog.zodSistemaObrigatorio')),
    tipo_acesso: z.string().min(1, t('acessosDd.contas.contaDialog.zodTipoObrigatorio')),
    nivel_privilegio: z.string().min(1, t('acessosDd.contas.contaDialog.zodNivelObrigatorio')),
    data_concessao: z.date({
      required_error: t('acessosDd.contas.contaDialog.zodDataConcessaoObrigatoria'),
    }),
    data_expiracao: z.date({
      required_error: t('acessosDd.contas.contaDialog.zodDataExpiracaoObrigatoria'),
    }),
    justificativa_negocio: z.string().min(10, t('acessosDd.contas.contaDialog.zodJustificativaMinima')),
    renovavel: z.boolean().default(true),
    observacoes: z.string().optional(),
  }), [t]);

  type ContaFormData = z.infer<typeof contaSchema>;

  const form = useForm<ContaFormData>({
    resolver: zodResolver(contaSchema),
    defaultValues: {
      usuario_beneficiario: conta?.usuario_beneficiario || '',
      email_beneficiario: conta?.email_beneficiario || '',
      sistema_id: conta?.sistema_id || '',
      tipo_acesso: conta?.tipo_acesso || 'administrativo',
      nivel_privilegio: conta?.nivel_privilegio || 'alto',
      data_concessao: conta?.data_concessao ? parseDataLocal(conta.data_concessao) : new Date(),
      data_expiracao: conta?.data_expiracao ? parseDataLocal(conta.data_expiracao) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 dias
      justificativa_negocio: conta?.justificativa_negocio || '',
      renovavel: conta?.renovavel ?? true,
      observacoes: conta?.observacoes || '',
    },
  });

  // Repopula o formulário ao abrir para editar (defaultValues só valem na 1ª montagem)
  React.useEffect(() => {
    if (!open) return;
    form.reset({
      usuario_beneficiario: conta?.usuario_beneficiario || '',
      email_beneficiario: conta?.email_beneficiario || '',
      sistema_id: conta?.sistema_id || '',
      tipo_acesso: conta?.tipo_acesso || 'administrativo',
      nivel_privilegio: conta?.nivel_privilegio || 'alto',
      data_concessao: conta?.data_concessao ? parseDataLocal(conta.data_concessao) : new Date(),
      data_expiracao: conta?.data_expiracao ? parseDataLocal(conta.data_expiracao) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      justificativa_negocio: conta?.justificativa_negocio || '',
      renovavel: conta?.renovavel ?? true,
      observacoes: conta?.observacoes || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conta]);

  const onSubmit = async (data: ContaFormData) => {
    try {
      if (!empresaId) {
        throw new Error(t('contasPrivilegiadasComp.contaDialog.toastEmpresaNaoEncontrada'));
      }

      // Validar se o sistema pertence à empresa
      const { data: sistema, error: sistemaError } = await supabase
        .from('sistemas_privilegiados')
        .select('empresa_id')
        .eq('id', data.sistema_id)
        .single();

      if (sistemaError || !sistema) {
        throw new Error(t('contasPrivilegiadasComp.contaDialog.toastSistemaNaoEncontrado'));
      }

      if (sistema.empresa_id !== empresaId) {
        throw new Error(t('contasPrivilegiadasComp.contaDialog.toastSistemaNaoPertence'));
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
          title: t('contasPrivilegiadasComp.contaDialog.toastSuccessTitle'),
          description: t('contasPrivilegiadasComp.contaDialog.toastUpdated'),
        });
      } else {
        const { error } = await supabase
          .from('contas_privilegiadas' as any)
          .insert(payload);

        if (error) throw error;

        toast({
          title: t('contasPrivilegiadasComp.contaDialog.toastSuccessTitle'),
          description: t('contasPrivilegiadasComp.contaDialog.toastCreated'),
        });
      }

      // Invalidar cache para forçar atualização
      await queryClient.invalidateQueries({ queryKey: ['contas-privilegiadas'] });

      onClose();
    } catch (error: any) {
      toast({
        title: t('contasPrivilegiadasComp.contaDialog.toastErrorTitle'),
        description: error.message || t('contasPrivilegiadasComp.contaDialog.toastErrorSave'),
        variant: 'destructive',
      });
    }
  };

  return (
    <DialogShell
        open={open}
        onOpenChange={onClose}
        title={conta?.id ? t('contasPrivilegiadasComp.contaDialog.titleEdit') : t('contasPrivilegiadasComp.contaDialog.titleNew')}
        icon={IconKey}
        size="lg"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={conta ? t('contasPrivilegiadasComp.contaDialog.submitUpdate') : t('contasPrivilegiadasComp.contaDialog.submitCreate')}
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
                    <FormLabel>{t('contasPrivilegiadasComp.contaDialog.fieldNomeUsuario')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('contasPrivilegiadasComp.contaDialog.fieldNomeUsuarioPlaceholder')} {...field} />
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
                    <FormLabel>{t('contasPrivilegiadasComp.contaDialog.fieldEmailUsuario')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t('contasPrivilegiadasComp.contaDialog.fieldEmailUsuarioPlaceholder')} {...field} />
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
                  <FormLabel>{t('contasPrivilegiadasComp.contaDialog.fieldSistema')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('contasPrivilegiadasComp.contaDialog.fieldSistemaPlaceholder')} />
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
                    <FormLabel>{t('contasPrivilegiadasComp.contaDialog.fieldTipoAcesso')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('contasPrivilegiadasComp.contaDialog.fieldTipoAcessoPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="administrativo">{t('contasPrivilegiadasComp.contaDialog.tipoAdministrativo')}</SelectItem>
                        <SelectItem value="operacional">{t('contasPrivilegiadasComp.contaDialog.tipoOperacional')}</SelectItem>
                        <SelectItem value="consulta_privilegiada">{t('contasPrivilegiadasComp.contaDialog.tipoConsultaPrivilegiada')}</SelectItem>
                        <SelectItem value="backup">{t('contasPrivilegiadasComp.contaDialog.tipoBackup')}</SelectItem>
                        <SelectItem value="desenvolvimento">{t('contasPrivilegiadasComp.contaDialog.tipoDesenvolvimento')}</SelectItem>
                        <SelectItem value="auditoria">{t('contasPrivilegiadasComp.contaDialog.tipoAuditoria')}</SelectItem>
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
                    <FormLabel>{t('contasPrivilegiadasComp.contaDialog.fieldNivelPrivilegio')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('contasPrivilegiadasComp.contaDialog.fieldNivelPrivilegioPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="critico">{t('contasPrivilegiadasComp.contaDialog.nivelCritico')}</SelectItem>
                        <SelectItem value="alto">{t('contasPrivilegiadasComp.contaDialog.nivelAlto')}</SelectItem>
                        <SelectItem value="medio">{t('contasPrivilegiadasComp.contaDialog.nivelMedio')}</SelectItem>
                        <SelectItem value="baixo">{t('contasPrivilegiadasComp.contaDialog.nivelBaixo')}</SelectItem>
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
                    <FormLabel>{t('contasPrivilegiadasComp.contaDialog.fieldDataConcessao')}</FormLabel>
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
                              format(field.value, datePattern())
                            ) : (
                              <span>{t('contasPrivilegiadasComp.contaDialog.fieldDataPlaceholder')}</span>
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
                    <FormLabel>{t('contasPrivilegiadasComp.contaDialog.fieldDataExpiracao')}</FormLabel>
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
                              format(field.value, datePattern())
                            ) : (
                              <span>{t('contasPrivilegiadasComp.contaDialog.fieldDataPlaceholder')}</span>
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
                  <FormLabel>{t('contasPrivilegiadasComp.contaDialog.fieldJustificativa')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('contasPrivilegiadasComp.contaDialog.fieldJustificativaPlaceholder')}
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
                  <FormLabel>{t('contasPrivilegiadasComp.contaDialog.fieldObservacoes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('contasPrivilegiadasComp.contaDialog.fieldObservacoesPlaceholder')}
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
                    <FormLabel className="text-base">{t('contasPrivilegiadasComp.contaDialog.fieldRenovavel')}</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      {t('contasPrivilegiadasComp.contaDialog.fieldRenovavelHint')}
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
