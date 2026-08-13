import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { tGlobal } from "@/lib/i18n-global";

export const useReviewData = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: ['review-stats'] });
    queryClient.invalidateQueries({ queryKey: ['reviews'] });
    queryClient.invalidateQueries({ queryKey: ['review-items'] });
  };

  const createReview = async (data: any) => {
    try {
      const { data: review, error } = await supabase
        .from("access_reviews")
        .insert({
          ...data,
          empresa_id: empresaId,
        })
        .select()
        .single();

      if (error) throw error;

      // Buscar usuários do sistema (nova tabela sistemas_usuarios)
      const { data: usuarios, error: usuariosError } = await supabase
        .from("sistemas_usuarios")
        .select("*")
        .eq("sistema_id", data.sistema_id)
        .eq("ativo", true);

      if (usuariosError) throw usuariosError;

      if (usuarios && usuarios.length > 0) {
        const items = usuarios.map((usuario) => ({
          review_id: review.id,
          conta_id: usuario.id,
          usuario_beneficiario: usuario.nome_usuario,
          email_beneficiario: usuario.email_usuario,
          tipo_acesso: usuario.tipo_acesso,
          nivel_privilegio: usuario.nivel_privilegio,
          data_concessao: usuario.data_concessao,
          data_expiracao: usuario.data_expiracao,
          justificativa_original: usuario.justificativa,
        }));

        const { error: itemsError } = await supabase
          .from("access_review_items")
          .insert(items);

        if (itemsError) throw itemsError;

        // Atualizar total de contas
        await supabase
          .from("access_reviews")
          .update({ total_contas: usuarios.length })
          .eq("id", review.id);
      }

      invalidateCache();
      toast({
        title: tGlobal('sweepDenuncias.revisao.toastSucesso'),
        description: tGlobal('sweepDenuncias.revisao.toastRevisaoCriada'),
      });

      return review;
    } catch (error: any) {
      toast({
        title: tGlobal('sweepDenuncias.revisao.toastErroCriar'),
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateReview = async (id: string, data: any) => {
    try {
      const { error } = await supabase
        .from("access_reviews")
        .update(data)
        .eq("id", id);

      if (error) throw error;

      invalidateCache();
      toast({
        title: tGlobal('sweepDenuncias.revisao.toastSucesso'),
        description: tGlobal('sweepDenuncias.revisao.toastRevisaoAtualizada'),
      });
    } catch (error: any) {
      toast({
        title: tGlobal('sweepDenuncias.revisao.toastErroAtualizar'),
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteReview = async (id: string) => {
    try {
      const { error } = await supabase
        .from("access_reviews")
        .delete()
        .eq("id", id);

      if (error) throw error;

      invalidateCache();
      toast({
        title: tGlobal('sweepDenuncias.revisao.toastSucesso'),
        description: tGlobal('sweepDenuncias.revisao.toastRevisaoExcluida'),
      });
    } catch (error: any) {
      toast({
        title: tGlobal('sweepDenuncias.revisao.toastErroExcluir'),
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateReviewItem = async (itemId: string, data: any) => {
    try {
      const { error } = await supabase
        .from("access_review_items")
        .update({
          ...data,
          data_revisao: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) throw error;

      invalidateCache();
    } catch (error: any) {
      toast({
        title: tGlobal('sweepDenuncias.revisao.toastErroAtualizarItem'),
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const finalizeReview = async (reviewId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("finalize-review", {
        body: { reviewId },
      });

      if (error) throw error;

      invalidateCache();
      toast({
        title: tGlobal('sweepDenuncias.revisao.toastSucesso'),
        description: tGlobal('sweepDenuncias.revisao.toastRevisaoFinalizada'),
      });

      return data;
    } catch (error: any) {
      toast({
        title: tGlobal('sweepDenuncias.revisao.toastErroFinalizar'),
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    createReview,
    updateReview,
    deleteReview,
    updateReviewItem,
    finalizeReview,
  };
};
