import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { tGlobal } from '@/lib/i18n-global';
import { exigirLinhas } from '@/lib/supabase-write';
import { accessReviewErrorKey } from '@/lib/access-review-error';

export const useReviewData = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidateCache = () => {
    for (const key of ['review-stats', 'reviews', 'review-items', 'reviews-historico', 'review-origin', 'review-detail', 'contas-privilegiadas', 'sistemas-usuarios', 'notifications']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const fail = (error: unknown, titleKey: string): never => {
    toast({ title: tGlobal(titleKey), description: tGlobal(accessReviewErrorKey(error)), variant: 'destructive' });
    throw error;
  };

  const createReview = async (data: any) => {
    try {
      if (!empresaId) throw new Error('REVIEW_NOT_AVAILABLE');
      const { data: review, error } = await supabase.rpc('create_access_review', { p_empresa_id: empresaId, p_data: data });
      if (error) throw error;
      invalidateCache();
      toast({ title: tGlobal('sweepDenuncias.revisao.toastSucesso'), description: tGlobal('sweepDenuncias.revisao.toastRevisaoCriada') });
      return review;
    } catch (error) { return fail(error, 'sweepDenuncias.revisao.toastErroCriar'); }
  };

  const updateReview = async (id: string, data: any) => {
    try {
      if (!empresaId) throw new Error('REVIEW_NOT_AVAILABLE');
      // Editing metadata must not reopen a closed campaign or replace its scope/creator.
      const { nome_revisao, descricao, tipo_revisao, data_inicio, data_limite, responsavel_revisao, observacoes } = data;
      await exigirLinhas(supabase.from('access_reviews').update({ nome_revisao, descricao, tipo_revisao, data_inicio, data_limite, responsavel_revisao, observacoes })
        .eq('empresa_id', empresaId).eq('id', id).select('id'), 'REVIEW_NOT_AVAILABLE');
      invalidateCache();
      toast({ title: tGlobal('sweepDenuncias.revisao.toastSucesso'), description: tGlobal('sweepDenuncias.revisao.toastRevisaoAtualizada') });
    } catch (error) { return fail(error, 'sweepDenuncias.revisao.toastErroAtualizar'); }
  };

  const deleteReview = async (id: string) => {
    try {
      if (!empresaId) throw new Error('REVIEW_NOT_AVAILABLE');
      await exigirLinhas(supabase.from('access_reviews').delete().eq('empresa_id', empresaId).eq('id', id).select('id'), 'REVIEW_NOT_AVAILABLE');
      invalidateCache();
      toast({ title: tGlobal('sweepDenuncias.revisao.toastSucesso'), description: tGlobal('sweepDenuncias.revisao.toastRevisaoExcluida') });
    } catch (error) { return fail(error, 'sweepDenuncias.revisao.toastErroExcluir'); }
  };

  const updateReviewItem = async (itemId: string, data: any) => {
    try {
      const { decisao, justificativa_revisor, observacoes_revisor, nova_data_expiracao } = data;
      // The database stamps reviewer/date and validates the parent/source under RLS.
      await exigirLinhas(supabase.from('access_review_items').update({ decisao, justificativa_revisor, observacoes_revisor,
        nova_data_expiracao: decisao === 'modificar' ? nova_data_expiracao : null }).eq('id', itemId).select('id'), 'REVIEW_NOT_AVAILABLE');
      invalidateCache();
    } catch (error) { return fail(error, 'sweepDenuncias.revisao.toastErroAtualizarItem'); }
  };

  const finalizeReview = async (reviewId: string) => {
    try {
      const { data, error } = await supabase.rpc('finalize_access_review', { p_review_id: reviewId });
      if (error) throw error;
      invalidateCache();
      toast({ title: tGlobal('sweepDenuncias.revisao.toastSucesso'), description: tGlobal('sweepDenuncias.revisao.toastRevisaoFinalizada') });
      return data;
    } catch (error) { return fail(error, 'sweepDenuncias.revisao.toastErroFinalizar'); }
  };

  return { createReview, updateReview, deleteReview, updateReviewItem, finalizeReview };
};
