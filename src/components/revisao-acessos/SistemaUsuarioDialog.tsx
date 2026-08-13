import { UserCog } from "lucide-react";
import { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useToast } from "@/hooks/use-toast";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { parseDateForDB, formatDateForInput } from "@/lib/date-utils";
import { useLanguage } from "@/contexts/LanguageContext";

const usuarioSchema = z.object({
  sistema_id: z.string().min(1, "Sistema é obrigatório"),
  nome_usuario: z.string().min(1, "Nome do usuário é obrigatório"),
  email_usuario: z.string().email("Email inválido").optional().or(z.literal("")),
  departamento: z.string().optional(),
  cargo: z.string().optional(),
  tipo_acesso: z.string().optional(),
  nivel_privilegio: z.string().optional(),
  data_concessao: z.string().optional(),
  data_expiracao: z.string().optional(),
  justificativa: z.string().optional(),
  observacoes: z.string().optional(),
  ativo: z.boolean().default(true),
});

type UsuarioFormData = z.infer<typeof usuarioSchema>;

interface Sistema {
  id: string;
  nome_sistema: string;
}

interface SistemaUsuarioDialogProps {
  open: boolean;
  onClose: () => void;
  usuario?: any;
  onSuccess: () => void;
  sistemaIdPadrao?: string;
}

export function SistemaUsuarioDialog({
  open,
  onClose,
  usuario,
  onSuccess,
  sistemaIdPadrao,
}: SistemaUsuarioDialogProps) {
  const { empresaId } = useEmpresaId();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: sistemas } = useOptimizedQuery<Sistema[]>(
    async () => {
      const { data, error } = await supabase
        .from("sistemas_privilegiados")
        .select("id, nome_sistema")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome_sistema");
      return { data: data || [], error };
    },
    [empresaId],
    { cacheKey: `sistemas-privilegiados-${empresaId}` }
  );

  const form = useForm<UsuarioFormData>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: {
      sistema_id: "",
      nome_usuario: "",
      email_usuario: "",
      departamento: "",
      cargo: "",
      tipo_acesso: "leitura",
      nivel_privilegio: "usuario",
      data_concessao: "",
      data_expiracao: "",
      justificativa: "",
      observacoes: "",
      ativo: true,
    },
  });

  useEffect(() => {
    if (usuario) {
      form.reset({
        sistema_id: usuario.sistema_id || "",
        nome_usuario: usuario.nome_usuario || "",
        email_usuario: usuario.email_usuario || "",
        departamento: usuario.departamento || "",
        cargo: usuario.cargo || "",
        tipo_acesso: usuario.tipo_acesso || "leitura",
        nivel_privilegio: usuario.nivel_privilegio || "usuario",
        data_concessao: formatDateForInput(usuario.data_concessao) || "",
        data_expiracao: formatDateForInput(usuario.data_expiracao) || "",
        justificativa: usuario.justificativa || "",
        observacoes: usuario.observacoes || "",
        ativo: usuario.ativo ?? true,
      });
    } else {
      form.reset({
        sistema_id: sistemaIdPadrao || "",
        nome_usuario: "",
        email_usuario: "",
        departamento: "",
        cargo: "",
        tipo_acesso: "leitura",
        nivel_privilegio: "usuario",
        data_concessao: "",
        data_expiracao: "",
        justificativa: "",
        observacoes: "",
        ativo: true,
      });
    }
  }, [usuario, sistemaIdPadrao, form]);

  const onSubmit = async (data: UsuarioFormData) => {
    if (!empresaId) return;
    setIsSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const payload = {
        empresa_id: empresaId,
        sistema_id: data.sistema_id,
        nome_usuario: data.nome_usuario,
        email_usuario: data.email_usuario || null,
        departamento: data.departamento || null,
        cargo: data.cargo || null,
        tipo_acesso: data.tipo_acesso || "leitura",
        nivel_privilegio: data.nivel_privilegio || "usuario",
        data_concessao: parseDateForDB(data.data_concessao),
        data_expiracao: parseDateForDB(data.data_expiracao),
        justificativa: data.justificativa || null,
        observacoes: data.observacoes || null,
        ativo: data.ativo,
        updated_at: new Date().toISOString(),
      };

      if (usuario) {
        const { error } = await supabase
          .from("sistemas_usuarios")
          .update(payload)
          .eq("id", usuario.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Usuário atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from("sistemas_usuarios")
          .insert({
            ...payload,
            created_by: userData?.user?.id,
          });
        if (error) throw error;
        toast({ title: "Sucesso", description: "Usuário cadastrado com sucesso" });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogShell
        open={open}
        onOpenChange={onClose}
        title={`${usuario?.id ? "Editar" : "Novo"} Usuário do Sistema`}
        icon={UserCog}
        size="lg"
        onSubmit={form.handleSubmit(onSubmit)}
      >
<Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sistema_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sistema *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o sistema" />
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

              <FormField
                control={form.control}
                name="nome_usuario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Usuário *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email_usuario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="departamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: TI, Financeiro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Analista, Gerente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo_acesso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Acesso</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="leitura">Leitura</SelectItem>
                        <SelectItem value="escrita">Escrita</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="completo">Acesso Completo</SelectItem>
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
                    <FormLabel>Nível de Privilégio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="usuario">Usuário</SelectItem>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="administrador">Administrador</SelectItem>
                        <SelectItem value="root">Root/Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_concessao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Concessão</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_expiracao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Expiração</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 pt-6">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Usuário Ativo</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="justificativa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("revisaoAcessosComp.usuarioDialog.fieldJustificativa")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("revisaoAcessosComp.usuarioDialog.fieldJustificativaPlaceholder")}
                      rows={2}
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
                  <FormLabel>{t("revisaoAcessosComp.usuarioDialog.fieldObservacoes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("revisaoAcessosComp.usuarioDialog.fieldObservacoesPlaceholder")}
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
  );
}
