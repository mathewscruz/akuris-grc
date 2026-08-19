import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useUsuariosEmpresa } from "@/hooks/useAuditoriaData";
import { formatDateForInput, parseDateForDB } from "@/lib/date-utils";
import { DateField } from "@/components/ui/date-field";
import { ControleSelect } from "./ControleSelect";
import { RequisitoSelect } from "./RequisitoSelect";
import { AreaSistemaSelect } from "./AreaSistemaSelect";
import { useIntegrationNotify } from "@/hooks/useIntegrationNotify";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logger } from "@/lib/logger";
import { IconChecklist } from '@/components/icons';

const makeFormSchema = (t: (key: string) => string) => z.object({
  codigo: z.string().min(1, t("govDialogs.itemAuditoriaFormDialog.zodCodigoRequired")),
  titulo: z.string().min(1, t("govDialogs.itemAuditoriaFormDialog.zodTituloRequired")),
  descricao: z.string().optional(),
  responsavel_id: z.string().optional(),
  prazo: z.string().optional(),
  prioridade: z.string().default("media"),
  status: z.string().default("pendente"),
  observacoes: z.string().optional(),
  controle_vinculado_id: z.string().optional(),
  requisito_vinculado_id: z.string().optional(),
  framework_vinculado_id: z.string().optional(),
  area_sistema_id: z.string().optional(),
});

type FormData = z.infer<ReturnType<typeof makeFormSchema>>;

interface ItemAuditoriaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditoriaId: string;
  auditoriaNome: string;
  item?: any;
  onSuccess: () => void;
}

export function ItemAuditoriaFormDialog({
  open,
  onOpenChange,
  auditoriaId,
  auditoriaNome,
  item,
  onSuccess,
}: ItemAuditoriaFormDialogProps) {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: usuarios } = useUsuariosEmpresa();
  const { notify } = useIntegrationNotify();
  const formSchema = useMemo(() => makeFormSchema(t), [t]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo: "",
      titulo: "",
      descricao: "",
      responsavel_id: "",
      prazo: "",
      prioridade: "media",
      status: "pendente",
      observacoes: "",
      controle_vinculado_id: "",
      requisito_vinculado_id: "",
      framework_vinculado_id: "",
      area_sistema_id: "",
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        codigo: item.codigo || "",
        titulo: item.titulo || "",
        descricao: item.descricao || "",
        responsavel_id: item.responsavel_id || "",
        prazo: item.prazo ? formatDateForInput(item.prazo) : "",
        prioridade: item.prioridade || "media",
        status: item.status || "pendente",
        observacoes: item.observacoes || "",
        controle_vinculado_id: item.controle_vinculado_id || "",
        requisito_vinculado_id: item.requisito_vinculado_id || "",
        framework_vinculado_id: item.framework_vinculado_id || "",
        area_sistema_id: item.area_sistema_id || "",
      });
    } else {
      form.reset({
        codigo: "",
        titulo: "",
        descricao: "",
        responsavel_id: "",
        prazo: "",
        prioridade: "media",
        status: "pendente",
        observacoes: "",
        controle_vinculado_id: "",
        requisito_vinculado_id: "",
        framework_vinculado_id: "",
        area_sistema_id: "",
      });
    }
  }, [item, open]);

  const [gateData, setGateData] = useState<FormData | null>(null);
  const [justificativa, setJustificativa] = useState("");

  const handleControleChange = (value: string, controle?: any) => {
    form.setValue("controle_vinculado_id", value);
    // Auto-preencher campos se controle selecionado e campos estão vazios
    if (controle && !form.getValues("titulo")) {
      form.setValue("titulo", controle.nome);
    }
    if (controle && !form.getValues("descricao") && controle.descricao) {
      form.setValue("descricao", controle.descricao);
    }
  };

  /** O item passa a ser uma referência ao requisito: código e título vêm do framework. */
  const handleRequisitoChange = (value: string, requisito?: any) => {
    form.setValue("requisito_vinculado_id", value);
    form.setValue("framework_vinculado_id", requisito?.framework_id || "");
    if (requisito) {
      if (!form.getValues("codigo") && requisito.codigo) form.setValue("codigo", requisito.codigo);
      if (!form.getValues("titulo")) form.setValue("titulo", requisito.titulo);
    }
  };

  /**
   * T4 · Gate — um item só fica Concluído com evidência anexada ou com uma
   * justificação escrita para a ausência de prova. A justificação fica gravada.
   */
  const onSubmit = async (data: FormData) => {
    if (data.status === "concluido") {
      const jaJustificado = !!item?.justificativa_sem_evidencia;
      let temEvidencia = false;
      if (item?.id) {
        const { count } = await supabase
          .from("auditoria_itens_evidencias")
          .select("id", { count: "exact", head: true })
          .eq("item_id", item.id);
        temEvidencia = (count || 0) > 0;
      }
      if (!temEvidencia && !jaJustificado) {
        setGateData(data);
        setJustificativa("");
        return;
      }
    }
    await executarSubmit(data);
  };

  const executarSubmit = async (data: FormData, justificativaGate?: string) => {
    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const payload = {
        auditoria_id: auditoriaId,
        codigo: data.codigo,
        titulo: data.titulo,
        descricao: data.descricao || null,
        responsavel_id: data.responsavel_id || null,
        prazo: data.prazo ? parseDateForDB(data.prazo) : null,
        prioridade: data.prioridade,
        status: data.status,
        observacoes: data.observacoes || null,
        controle_vinculado_id: data.controle_vinculado_id || null,
        requisito_vinculado_id: data.requisito_vinculado_id || null,
        framework_vinculado_id: data.framework_vinculado_id || null,
        area_sistema_id: data.area_sistema_id || null,
        justificativa_sem_evidencia:
          justificativaGate?.trim() || item?.justificativa_sem_evidencia || null,
        created_by: item ? undefined : userId,
      };

      const previousResponsavel = item?.responsavel_id;
      const newResponsavel = data.responsavel_id;
      const responsavelChanged = !item || (previousResponsavel !== newResponsavel && newResponsavel);

      if (item) {
        const { error } = await supabase
          .from("auditoria_itens")
          .update(payload)
          .eq("id", item.id);

        if (error) throw error;
        toast.success(t("govDialogs.itemAuditoriaFormDialog.toastUpdated"));
      } else {
        const { error } = await supabase.from("auditoria_itens").insert(payload);

        if (error) throw error;
        toast.success(t("govDialogs.itemAuditoriaFormDialog.toastCreated"));
      }

      // Enviar notificação se responsável foi definido/alterado
      if (responsavelChanged && newResponsavel) {
        try {
          await supabase.functions.invoke("send-auditoria-item-notification", {
            body: {
              item_id: item?.id || "new",
              auditoria_id: auditoriaId,
              responsavel_id: newResponsavel,
              item_codigo: data.codigo,
              item_titulo: data.titulo,
              auditoria_nome: auditoriaNome,
              prazo: data.prazo || null,
            },
          });
        } catch (notifError) {
          logger.error("Erro ao enviar notificação", { error: (notifError as Error)?.message, module: 'auditorias' });
        }
      }

      // Notify integrations
      await notify('auditoria_item_atribuido', {
        titulo: `Item de auditoria: ${data.titulo}`,
        descricao: `Auditoria: ${auditoriaNome}`,
        link: `/governanca/auditorias`,
        gravidade: data.prioridade === 'alta' ? 'alta' : 'media',
        dados: {
          item_codigo: data.codigo,
          item_titulo: data.titulo,
          auditoria_nome: auditoriaNome,
          prioridade: data.prioridade,
          status: data.status
        }
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      logger.error("Erro ao salvar item de auditoria", { error: error?.message, module: 'auditorias' });
      toast.error(error.message || t("govDialogs.itemAuditoriaFormDialog.toastSaveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={item?.id ? t("govDialogs.itemAuditoriaFormDialog.titleEdit") : t("govDialogs.itemAuditoriaFormDialog.titleNew")}
        icon={IconChecklist}
        size="lg"
        onSubmit={form.handleSubmit(onSubmit)}
        isSubmitting={isSubmitting}
        submitLabel={item ? t("govDialogs.itemAuditoriaFormDialog.submitUpdate") : t("govDialogs.itemAuditoriaFormDialog.submitCreate")}
      >
<Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Vinculação a Controle Existente */}
            <FormField
              control={form.control}
              name="controle_vinculado_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("govDialogs.itemAuditoriaFormDialog.fieldVincularControle")}</FormLabel>
                  <FormControl>
                    <ControleSelect
                      value={field.value}
                      onValueChange={handleControleChange}
                      placeholder={t("govDialogs.itemAuditoriaFormDialog.vincularControlePlaceholder")}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("govDialogs.itemAuditoriaFormDialog.vincularControleDescription")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Referência a requisito de framework */}
            <FormField
              control={form.control}
              name="requisito_vinculado_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("vinculoReq.itemRefRequisito")}</FormLabel>
                  <FormControl>
                    <RequisitoSelect value={field.value} onValueChange={handleRequisitoChange} />
                  </FormControl>
                  <FormDescription>{t("vinculoReq.itemRefRequisitoDesc")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("govDialogs.itemAuditoriaFormDialog.fieldCodigo")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('campos.comum.exCodigoControle')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("govDialogs.itemAuditoriaFormDialog.fieldPrioridade")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("controlesAuditorias.iafdPrioridadePlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="alta">{t("controlesAuditorias.iafdPrioridadeAlta")}</SelectItem>
                        <SelectItem value="media">{t("controlesAuditorias.iafdPrioridadeMedia")}</SelectItem>
                        <SelectItem value="baixa">{t("controlesAuditorias.iafdPrioridadeBaixa")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("controlesAuditorias.iafdFieldTitulo")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("controlesAuditorias.iafdFieldTituloPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("controlesAuditorias.iafdFieldDescricao")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("controlesAuditorias.iafdFieldDescricaoPlaceholder")}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="responsavel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("controlesAuditorias.iafdFieldResponsavel")}</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "_none" ? "" : v)} value={field.value || "_none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("controlesAuditorias.iafdResponsavelPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">{t("controlesAuditorias.iafdResponsavelNenhum")}</SelectItem>
                        {usuarios?.map((u) => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.nome}
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
                name="prazo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("controlesAuditorias.iafdFieldPrazo")}</FormLabel>
                    <FormControl>
                      <DateField value={field.value || null} onChange={(v) => field.onChange(v || "")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Área/Sistema Auditado */}
            <FormField
              control={form.control}
              name="area_sistema_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("controlesAuditorias.iafdFieldAreaSistema")}</FormLabel>
                  <FormControl>
                    <AreaSistemaSelect
                      auditoriaId={auditoriaId}
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("controlesAuditorias.iafdFieldStatus")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("controlesAuditorias.iafdStatusPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pendente">{t("controlesAuditorias.iafdStatusPendente")}</SelectItem>
                      <SelectItem value="em_andamento">{t("controlesAuditorias.iafdStatusEmAndamento")}</SelectItem>
                      <SelectItem value="concluido">{t("controlesAuditorias.iafdStatusConcluido")}</SelectItem>
                      <SelectItem value="nao_aplicavel">{t("controlesAuditorias.iafdStatusNaoAplicavel")}</SelectItem>
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
                  <FormLabel>{t("controlesAuditorias.iafdFieldObservacoes")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t("controlesAuditorias.iafdObservacoesPlaceholder")} rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </form>
        </Form>

        <AlertDialog open={!!gateData} onOpenChange={(o) => !o && setGateData(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('t4.gates.itemSemEvidenciaTitulo')}</AlertDialogTitle>
              <AlertDialogDescription>{t('t4.gates.itemSemEvidenciaDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <FormLabel>{t('t4.gates.itemJustificacao')}</FormLabel>
              <Textarea
                rows={3}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder={t('t4.gates.itemJustificacaoPlaceholder')}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('t4.gates.cancelar')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={!justificativa.trim()}
                onClick={async (e) => {
                  e.preventDefault();
                  if (!justificativa.trim() || !gateData) {
                    toast.error(t('t4.gates.itemJustificacaoObrigatoria'));
                    return;
                  }
                  const dados = gateData;
                  setGateData(null);
                  await executarSubmit(dados, justificativa);
                  toast.info(t('t4.gates.itemJustificacaoRegistada'));
                }}
              >
                {t('t4.gates.confirmar')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogShell>
  );
}
