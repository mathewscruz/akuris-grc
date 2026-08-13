import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { DialogShell } from "@/components/ui/dialog-shell";
import { KeyRound } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserSelect } from "@/components/riscos/UserSelect";
import { useLanguage } from "@/contexts/LanguageContext";

interface ChaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chave?: any;
}

export function ChaveDialog({ open, onOpenChange, chave }: ChaveDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaId();

  const form = useForm({
    defaultValues: {
      nome: "",
      tipo_chave: "api_key",
      ambiente: "producao",
      localizacao: "",
      sistema_aplicacao: "",
      responsavel: "",
      data_criacao: "",
      data_ultima_rotacao: "",
      data_proxima_rotacao: "",
      periodicidade_rotacao: "trimestral",
      rotacao_automatica: false,
      criticidade: "media",
      status: "ativa",
      algoritmo: "",
      observacoes: "",
    },
  });

  useEffect(() => {
    if (chave) {
      form.reset(chave);
    } else {
      form.reset();
    }
  }, [chave, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const data = {
        ...values,
        empresa_id: empresaId,
        // Datas/UUID opcionais vazios precisam ir como null (colunas date/uuid rejeitam "")
        data_criacao: values.data_criacao || null,
        data_ultima_rotacao: values.data_ultima_rotacao || null,
        data_proxima_rotacao: values.data_proxima_rotacao || null,
        responsavel: values.responsavel || null,
      };

      if (chave?.id) {
        const { error } = await supabase
          .from('ativos_chaves_criptograficas')
          .update(data)
          .eq('id', chave.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ativos_chaves_criptograficas')
          .insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ativos-chaves'] });
      queryClient.invalidateQueries({ queryKey: ['chaves-stats'] });
      toast({
        title: t('contratosAtivos.common.success'),
        description: t('contratosAtivos.chaveDialog.toastSuccessDescription', { action: chave ? t('contratosAtivos.chaveDialog.actionUpdated') : t('contratosAtivos.chaveDialog.actionCreated') }),
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: t('contratosAtivos.common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: any) => {
    saveMutation.mutate(values);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={KeyRound}
      title={chave ? t('contratosAtivos.chaveDialog.titleEdit') : t('contratosAtivos.chaveDialog.title')}
      size="lg"
      onSubmit={form.handleSubmit(onSubmit)}
      isSubmitting={saveMutation.isPending}
      isDirty={form.formState.isDirty}
    >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelName')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('contratosAtivos.chaveDialog.namePlaceholder')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo_chave"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelType')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="api_key">{t('contratosAtivos.chaveDialog.typeApiKey')}</SelectItem>
                        <SelectItem value="certificado_ssl">{t('contratosAtivos.chaveDialog.typeCertificadoSsl')}</SelectItem>
                        <SelectItem value="ssh_key">{t('contratosAtivos.chaveDialog.typeSshKey')}</SelectItem>
                        <SelectItem value="token_acesso">{t('contratosAtivos.chaveDialog.typeTokenAcesso')}</SelectItem>
                        <SelectItem value="secret_key">{t('contratosAtivos.chaveDialog.typeSecretKey')}</SelectItem>
                        <SelectItem value="outro">{t('contratosAtivos.chaveDialog.typeOutro')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ambiente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelEnvironment')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="producao">{t('contratosAtivos.chaveDialog.envProducao')}</SelectItem>
                        <SelectItem value="homologacao">{t('contratosAtivos.chaveDialog.envHomologacao')}</SelectItem>
                        <SelectItem value="desenvolvimento">{t('contratosAtivos.chaveDialog.envDesenvolvimento')}</SelectItem>
                        <SelectItem value="qa">{t('contratosAtivos.chaveDialog.envQa')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="localizacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelLocation')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('contratosAtivos.chaveDialog.locationPlaceholder')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sistema_aplicacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelSystem')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsavel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelResponsible')}</FormLabel>
                    <FormControl>
                      <UserSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder={t('contratosAtivos.chaveDialog.responsiblePlaceholder')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_criacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelCreationDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_ultima_rotacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelLastRotation')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_proxima_rotacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelNextRotation')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="periodicidade_rotacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelPeriodicity')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mensal">{t('contratosAtivos.chaveDialog.periodMensal')}</SelectItem>
                        <SelectItem value="trimestral">{t('contratosAtivos.chaveDialog.periodTrimestral')}</SelectItem>
                        <SelectItem value="semestral">{t('contratosAtivos.chaveDialog.periodSemestral')}</SelectItem>
                        <SelectItem value="anual">{t('contratosAtivos.chaveDialog.periodAnual')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="criticidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelCriticality')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="baixa">{t('contratosAtivos.chaveDialog.critBaixa')}</SelectItem>
                        <SelectItem value="media">{t('contratosAtivos.chaveDialog.critMedia')}</SelectItem>
                        <SelectItem value="alta">{t('contratosAtivos.chaveDialog.critAlta')}</SelectItem>
                        <SelectItem value="critica">{t('contratosAtivos.chaveDialog.critCritica')}</SelectItem>
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
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelStatus')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ativa">{t('contratosAtivos.chaveDialog.statusAtiva')}</SelectItem>
                        <SelectItem value="expirada">{t('contratosAtivos.chaveDialog.statusExpirada')}</SelectItem>
                        <SelectItem value="revogada">{t('contratosAtivos.chaveDialog.statusRevogada')}</SelectItem>
                        <SelectItem value="em_rotacao">{t('contratosAtivos.chaveDialog.statusEmRotacao')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="algoritmo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelAlgorithm')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('contratosAtivos.chaveDialog.algorithmPlaceholder')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('contratosAtivos.chaveDialog.labelObservations')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

          </form>
        </Form>
    </DialogShell>
  );
}
