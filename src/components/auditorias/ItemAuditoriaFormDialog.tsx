import { useState, useEffect } from "react";
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
import { ListChecks } from "lucide-react";
import { formatDateForInput, parseDateForDB } from "@/lib/date-utils";
import { ControleSelect } from "./ControleSelect";
import { AreaSistemaSelect } from "./AreaSistemaSelect";
import { useIntegrationNotify } from "@/hooks/useIntegrationNotify";
import { logger } from "@/lib/logger";

const formSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório"),
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  responsavel_id: z.string().optional(),
  prazo: z.string().optional(),
  prioridade: z.string().default("media"),
  status: z.string().default("pendente"),
  observacoes: z.string().optional(),
  controle_vinculado_id: z.string().optional(),
  area_sistema_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: usuarios } = useUsuariosEmpresa();
  const { notify } = useIntegrationNotify();

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
        area_sistema_id: "",
      });
    }
  }, [item, open]);

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

  const onSubmit = async (data: FormData) => {
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
        area_sistema_id: data.area_sistema_id || null,
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
        toast.success("Item atualizado com sucesso");
      } else {
        const { error } = await supabase.from("auditoria_itens").insert(payload);

        if (error) throw error;
        toast.success("Item adicionado com sucesso");
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
        link: `/governanca?tab=auditorias`,
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
      toast.error(error.message || "Erro ao salvar item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={`${item?.id ? "Editar" : "Novo"} Item de Auditoria`}
        icon={ListChecks}
        size="lg"
        onSubmit={form.handleSubmit(onSubmit)}
        isSubmitting={isSubmitting}
        submitLabel={item ? "Salvar Alterações" : "Adicionar Item"}
      >
<Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Vinculação a Controle Existente */}
            <FormField
              control={form.control}
              name="controle_vinculado_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vincular a Controle Existente (opcional)</FormLabel>
                  <FormControl>
                    <ControleSelect
                      value={field.value}
                      onValueChange={handleControleChange}
                      placeholder="Selecionar controle..."
                    />
                  </FormControl>
                  <FormDescription>
                    Ao vincular, o título e descrição serão preenchidos automaticamente
                  </FormDescription>
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
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: CT-001" {...field} />
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
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
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
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input placeholder="Título do item de verificação" {...field} />
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
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o que precisa ser evidenciado..."
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
                    <FormLabel>Responsável</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "_none" ? "" : v)} value={field.value || "_none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">Nenhum</SelectItem>
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
                    <FormLabel>Prazo</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                  <FormLabel>Área/Sistema Auditado (opcional)</FormLabel>
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
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="nao_aplicavel">Não Aplicável</SelectItem>
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
                    <Textarea placeholder="Observações adicionais..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </form>
        </Form>
      </DialogShell>
  );
}
