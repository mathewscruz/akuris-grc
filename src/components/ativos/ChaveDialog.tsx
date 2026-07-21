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

interface ChaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chave?: any;
}

export function ChaveDialog({ open, onOpenChange, chave }: ChaveDialogProps) {
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
        title: "Sucesso",
        description: `Chave ${chave ? 'atualizada' : 'cadastrada'} com sucesso`,
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
      icon={KeyRound}
      title={chave ? 'Editar Chave' : 'Nova Chave Criptográfica'}
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
                    <FormLabel>Nome da Chave *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: API Key AWS Produção" />
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
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="api_key">API Key</SelectItem>
                        <SelectItem value="certificado_ssl">Certificado SSL</SelectItem>
                        <SelectItem value="ssh_key">SSH Key</SelectItem>
                        <SelectItem value="token_acesso">Token de Acesso</SelectItem>
                        <SelectItem value="secret_key">Secret Key</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
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
                    <FormLabel>Ambiente *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="producao">Produção</SelectItem>
                        <SelectItem value="homologacao">Homologação</SelectItem>
                        <SelectItem value="desenvolvimento">Desenvolvimento</SelectItem>
                        <SelectItem value="qa">QA</SelectItem>
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
                    <FormLabel>Localização *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: AWS Secrets Manager" />
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
                    <FormLabel>Sistema/Aplicação</FormLabel>
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
                name="data_criacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Criação *</FormLabel>
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
                    <FormLabel>Última Rotação</FormLabel>
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
                    <FormLabel>Próxima Rotação *</FormLabel>
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
                        <SelectItem value="expirada">Expirada</SelectItem>
                        <SelectItem value="revogada">Revogada</SelectItem>
                        <SelectItem value="em_rotacao">Em Rotação</SelectItem>
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
                    <FormLabel>Algoritmo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: RSA-2048, AES-256" />
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
