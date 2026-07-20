import { Eye } from "lucide-react";
import { useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReviewData } from "@/hooks/useReviewData";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { supabase } from "@/integrations/supabase/client";
import { parseDateForDB } from "@/lib/date-utils";

const reviewSchema = z.object({
  nome_revisao: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  descricao: z.string().optional(),
  tipo_revisao: z.enum(["periodica", "ad_hoc", "recertificacao"]),
  sistema_id: z.string().min(1, "Selecione um sistema"),
  responsavel_revisao: z.string().min(1, "Selecione um responsável"),
  data_inicio: z.string(),
  data_limite: z.string(),
  observacoes: z.string().optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  review?: any;
  onSuccess: () => void;
}

export function ReviewDialog({ open, onClose, review, onSuccess }: ReviewDialogProps) {
  const { empresaId } = useEmpresaId();
  const { createReview, updateReview } = useReviewData();

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      nome_revisao: "",
      descricao: "",
      tipo_revisao: "periodica",
      sistema_id: "",
      responsavel_revisao: "",
      data_inicio: new Date().toISOString().split("T")[0],
      data_limite: "",
      observacoes: "",
    },
  });

  const { data: sistemas } = useOptimizedQuery(
    async () => {
      if (!empresaId) return { data: [], error: null };

      const { data, error } = await supabase
        .from("sistemas_privilegiados")
        .select("id, nome_sistema")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome_sistema");

      return { data: data || [], error };
    },
    [empresaId],
    { cacheKey: `sistemas-${empresaId}` }
  );

  const { data: usuarios } = useOptimizedQuery(
    async () => {
      if (!empresaId) return { data: [], error: null };

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .eq("empresa_id", empresaId)
        .order("nome");

      return { data: data || [], error };
    },
    [empresaId],
    { cacheKey: `usuarios-${empresaId}` }
  );

  useEffect(() => {
    if (review) {
      form.reset({
        nome_revisao: review.nome_revisao,
        descricao: review.descricao || "",
        tipo_revisao: review.tipo_revisao,
        sistema_id: review.sistema_id,
        responsavel_revisao: review.responsavel_revisao,
        data_inicio: review.data_inicio,
        data_limite: review.data_limite,
        observacoes: review.observacoes || "",
      });
    } else {
      form.reset({
        nome_revisao: "",
        descricao: "",
        tipo_revisao: "periodica",
        sistema_id: "",
        responsavel_revisao: "",
        data_inicio: new Date().toISOString().split("T")[0],
        data_limite: "",
        observacoes: "",
      });
    }
  }, [review, form]);

  const onSubmit = async (data: ReviewFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const payload = {
        ...data,
        data_inicio: parseDateForDB(data.data_inicio),
        data_limite: parseDateForDB(data.data_limite),
        created_by: user.id,
        status: "em_andamento",
      };

      if (review) {
        await updateReview(review.id, payload);
      } else {
        // Gerar link token
        const { data: tokenData } = await supabase.rpc("gerar_token_revisao");
        await createReview({
          ...payload,
          link_token: tokenData,
        });
      }

      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar revisão:", error);
    }
  };

  return (
    <DialogShell
        open={open}
        onOpenChange={onClose}
        title={`${review?.id ? "Editar" : "Nova"} Revisão de Acessos`}
        icon={Eye}
        size="lg"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={review ? "Atualizar" : "Criar Revisão"}
        isDirty={form.formState.isDirty}
      >
<Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome_revisao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Revisão *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Revisão Trimestral Q4 2025" />
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
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_revisao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Revisão *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="periodica">Periódica</SelectItem>
                        <SelectItem value="ad_hoc">Ad-hoc</SelectItem>
                        <SelectItem value="recertificacao">Recertificação</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sistema_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sistema *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sistemas?.map((sistema) => (
                          <SelectItem key={sistema.id} value={sistema.id}>
                            {sistema.nome_sistema}
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
              name="responsavel_revisao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável pela Revisão *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {usuarios?.map((usuario) => (
                        <SelectItem key={usuario.user_id} value={usuario.user_id}>
                          {usuario.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_limite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Limite *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
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
