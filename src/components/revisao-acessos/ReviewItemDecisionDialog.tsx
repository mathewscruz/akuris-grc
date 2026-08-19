import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DialogShell } from "@/components/ui/dialog-shell";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useReviewData } from "@/hooks/useReviewData";
import { supabase } from "@/integrations/supabase/client";
import { formatDateForInput, parseDateForDB } from "@/lib/date-utils";
import { formatStatus } from "@/lib/text-utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconShieldCheck, IconInfo } from '@/components/icons';

const buildDecisionSchema = (t: (key: string) => string) => z.object({
  decisao: z.enum(["aprovar", "revogar", "modificar"]),
  justificativa_revisor: z.string().min(10, t("acessosDd.revisao.itemDecisionDialog.zodJustificativaMinima")),
  nova_data_expiracao: z.string().optional(),
  observacoes_revisor: z.string().optional(),
});

type DecisionFormData = z.infer<ReturnType<typeof buildDecisionSchema>>;

interface ReviewItemDecisionDialogProps {
  open: boolean;
  onClose: () => void;
  item: any;
  onSuccess: () => void;
}

export function ReviewItemDecisionDialog({
  open,
  onClose,
  item,
  onSuccess,
}: ReviewItemDecisionDialogProps) {
  const { updateReviewItem } = useReviewData();
  const { t } = useLanguage();
  const decisionSchema = buildDecisionSchema(t);

  const form = useForm<DecisionFormData>({
    resolver: zodResolver(decisionSchema),
    defaultValues: {
      decisao: "aprovar",
      justificativa_revisor: "",
      nova_data_expiracao: "",
      observacoes_revisor: "",
    },
  });

  const decisao = form.watch("decisao");

  useEffect(() => {
    if (item) {
      form.reset({
        decisao: item.decisao !== "pendente" ? item.decisao : "aprovar",
        justificativa_revisor: item.justificativa_revisor || "",
        nova_data_expiracao: item.nova_data_expiracao || item.data_expiracao || "",
        observacoes_revisor: item.observacoes_revisor || "",
      });
    }
  }, [item, form]);

  const onSubmit = async (data: DecisionFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("revisaoAcessosComp.itemDecisionDialog.toastErrorNaoAutenticado"));

      const payload = {
        decisao: data.decisao,
        justificativa_revisor: data.justificativa_revisor,
        observacoes_revisor: data.observacoes_revisor,
        revisado_por: user.id,
        ...(data.decisao === "modificar" && data.nova_data_expiracao
          ? { nova_data_expiracao: parseDateForDB(data.nova_data_expiracao) }
          : {}),
      };

      await updateReviewItem(item.id, payload);
      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar decisão:", error);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      icon={IconShieldCheck}
      title={t("revisaoAcessosComp.itemDecisionDialog.title").replace("{nome}", item?.usuario_beneficiario ?? '')}
      size="md"
      onSubmit={form.handleSubmit(onSubmit)}
      submitLabel={t("revisaoAcessosComp.itemDecisionDialog.submitLabel")}
      isDirty={form.formState.isDirty}
    >
        <div className="space-y-4">
          <Alert>
            <IconInfo className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1 text-sm">
                <p><strong>{t("revisaoAcessosComp.itemDecisionDialog.email")}</strong> {item?.email_beneficiario || "-"}</p>
                <p><strong>{t("revisaoAcessosComp.itemDecisionDialog.tipoAcesso")}</strong> {formatStatus(item?.tipo_acesso || '')}</p>
                <p><strong>{t("revisaoAcessosComp.itemDecisionDialog.nivel")}</strong> <StatusBadge tone="neutral">{formatStatus(item?.nivel_privilegio || '')}</StatusBadge></p>
                <p><strong>{t("revisaoAcessosComp.itemDecisionDialog.dataConcessao")}</strong> {item?.data_concessao ? formatDateForInput(item.data_concessao) : "-"}</p>
                <p><strong>{t("revisaoAcessosComp.itemDecisionDialog.dataExpiracao")}</strong> {item?.data_expiracao ? formatDateForInput(item.data_expiracao) : "-"}</p>
                {item?.justificativa_original && (
                  <p><strong>{t("revisaoAcessosComp.itemDecisionDialog.justificativaOriginal")}</strong> {item.justificativa_original}</p>
                )}
              </div>
            </AlertDescription>
          </Alert>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="decisao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("revisaoAcessosComp.itemDecisionDialog.fieldDecisao")}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="aprovar" id="aprovar" />
                          <label htmlFor="aprovar" className="cursor-pointer">
                            {t("revisaoAcessosComp.itemDecisionDialog.decisaoAprovar")}
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="revogar" id="revogar" />
                          <label htmlFor="revogar" className="cursor-pointer">
                            {t("revisaoAcessosComp.itemDecisionDialog.decisaoRevogar")}
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="modificar" id="modificar" />
                          <label htmlFor="modificar" className="cursor-pointer">
                            {t("revisaoAcessosComp.itemDecisionDialog.decisaoModificar")}
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {decisao === "modificar" && (
                <FormField
                  control={form.control}
                  name="nova_data_expiracao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("revisaoAcessosComp.itemDecisionDialog.fieldNovaData")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="justificativa_revisor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("revisaoAcessosComp.itemDecisionDialog.fieldJustificativa")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        placeholder={
                          decisao === "aprovar"
                            ? t("revisaoAcessosComp.itemDecisionDialog.justificativaPlaceholderAprovar")
                            : decisao === "revogar"
                            ? t("revisaoAcessosComp.itemDecisionDialog.justificativaPlaceholderRevogar")
                            : t("revisaoAcessosComp.itemDecisionDialog.justificativaPlaceholderModificar")
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacoes_revisor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("revisaoAcessosComp.itemDecisionDialog.fieldObservacoes")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </form>
          </Form>
        </div>
    </DialogShell>
  );
}
