import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { DialogShell } from "@/components/ui/dialog-shell";
import { BadgeCheck } from "lucide-react";
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

interface LicencaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenca?: any;
}

export function LicencaDialog({ open, onOpenChange, licenca }: LicencaDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const empresaId = useEmpresaId();

  const form = useForm({
    defaultValues: {
      nome: "",
      tipo_licenca: "software",
      fornecedor: "",
      numero_licenca: "",
      quantidade_licencas: 1,
      data_aquisicao: "",
      data_inicio: "",
      data_vencimento: "",
      valor_aquisicao: "",
      valor_renovacao: "",
      periodicidade: "anual",
      renovacao_automatica: false,
      responsavel: "",
      departamento: "",
      criticidade: "media",
      status: "ativa",
      observacoes: "",
    },
  });

  useEffect(() => {
    if (licenca) {
      form.reset({
        nome: licenca.nome || "",
        tipo_licenca: licenca.tipo_licenca || "software",
        fornecedor: licenca.fornecedor || "",
        numero_licenca: licenca.numero_licenca || "",
        quantidade_licencas: licenca.quantidade_licencas || 1,
        data_aquisicao: licenca.data_aquisicao || "",
        data_inicio: licenca.data_inicio || "",
        data_vencimento: licenca.data_vencimento || "",
        valor_aquisicao: licenca.valor_aquisicao || "",
        valor_renovacao: licenca.valor_renovacao || "",
        periodicidade: licenca.periodicidade || "anual",
        renovacao_automatica: licenca.renovacao_automatica || false,
        responsavel: licenca.responsavel || "",
        departamento: licenca.departamento || "",
        criticidade: licenca.criticidade || "media",
        status: licenca.status || "ativa",
        observacoes: licenca.observacoes || "",
      });
    } else {
      form.reset();
    }
  }, [licenca, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const data = {
        ...values,
        empresa_id: empresaId,
        valor_aquisicao: values.valor_aquisicao ? parseFloat(values.valor_aquisicao) : null,
        valor_renovacao: values.valor_renovacao ? parseFloat(values.valor_renovacao) : null,
      };

      if (licenca?.id) {
        const { error } = await supabase
          .from('ativos_licencas')
          .update(data)
          .eq('id', licenca.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ativos_licencas')
          .insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ativos-licencas'] });
      queryClient.invalidateQueries({ queryKey: ['licencas-stats'] });
      toast({
        title: "Sucesso",
        description: `Licença ${licenca ? 'atualizada' : 'cadastrada'} com sucesso`,
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
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
      icon={BadgeCheck}
      title={licenca ? 'Editar Licença' : 'Nova Licença'}
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
                    <FormLabel>Nome da Licença *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Microsoft 365 Business" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo_licenca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="software">Software</SelectItem>
                        <SelectItem value="servico">Serviço</SelectItem>
                        <SelectItem value="certificacao">Certificação</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fornecedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numero_licenca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número da Licença</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantidade_licencas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade *</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Início *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_vencimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Vencimento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="periodicidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Periodicidade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="semestral">Semestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                        <SelectItem value="bienal">Bienal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor_aquisicao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Aquisição (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor_renovacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Renovação (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="criticidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Criticidade *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
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
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                    <SelectItem value="a_vencer">A Vencer</SelectItem>
                    <SelectItem value="em_renovacao">Em Renovação</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsavel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <FormControl>
                      <UserSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Selecionar responsável..."
                      />
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
                      <Input {...field} />
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
                    <FormLabel>Observações</FormLabel>
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
