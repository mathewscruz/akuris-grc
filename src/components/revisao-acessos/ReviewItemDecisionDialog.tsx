import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DialogShell } from "@/components/ui/dialog-shell";
import { ShieldCheck } from "lucide-react";
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
import { Info } from "lucide-react";

const decisionSchema = z.object({
  decisao: z.enum(["aprovar", "revogar", "modificar"]),
  justificativa_revisor: z.string().min(10, "Justificativa deve ter no mínimo 10 caracteres"),
  nova_data_expiracao: z.string().optional(),
  observacoes_revisor: z.string().optional(),
});

type DecisionFormData = z.infer<typeof decisionSchema>;

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
      if (!user) throw new Error("Usuário não autenticado");

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
      icon={ShieldCheck}
      title={`Revisão de Acesso — ${item?.usuario_beneficiario ?? ''}`}
      size="md"
      onSubmit={form.handleSubmit(onSubmit)}
      submitLabel="Salvar Decisão"
      isDirty={form.formState.isDirty}
    >
        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1 text-sm">
                <p><strong>Email:</strong> {item?.email_beneficiario || "-"}</p>
                <p><strong>Tipo de Acesso:</strong> {formatStatus(item?.tipo_acesso || '')}</p>
                <p><strong>Nível:</strong> <StatusBadge size="sm" tone="neutral">{formatStatus(item?.nivel_privilegio || '')}</StatusBadge></p>
                <p><strong>Data Concessão:</strong> {item?.data_concessao ? formatDateForInput(item.data_concessao) : "-"}</p>
                <p><strong>Data Expiração:</strong> {item?.data_expiracao ? formatDateForInput(item.data_expiracao) : "-"}</p>
                {item?.justificativa_original && (
                  <p><strong>Justificativa Original:</strong> {item.justificativa_original}</p>
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
                    <FormLabel>Decisão *</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="aprovar" id="aprovar" />
                          <label htmlFor="aprovar" className="cursor-pointer">
                            ✅ Aprovar (Manter Acesso)
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="revogar" id="revogar" />
                          <label htmlFor="revogar" className="cursor-pointer">
                            ❌ Revogar (Remover Acesso)
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="modificar" id="modificar" />
                          <label htmlFor="modificar" className="cursor-pointer">
                            ✏️ Modificar (Alterar Data)
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
                      <FormLabel>Nova Data de Expiração *</FormLabel>
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
                    <FormLabel>Justificativa da Decisão *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        placeholder={
                          decisao === "aprovar"
                            ? "Ex: Acesso necessário para função atual..."
                            : decisao === "revogar"
                            ? "Ex: Colaborador mudou de área, não necessita mais..."
                            : "Ex: Renovação de acesso por mais 90 dias..."
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
                    <FormLabel>Observações Adicionais</FormLabel>
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
