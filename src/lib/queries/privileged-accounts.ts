import { supabase } from '@/integrations/supabase/client';
import { readAllPages, readAllPagesByIds } from '@/lib/read-all-pages';
import { accountReviewContext } from '@/lib/privileged-review';
import { splitResponsavel } from '@/lib/uuid';

export async function loadPrivilegedAccounts(empresaId: string, signal?: AbortSignal) {
  const { data: accounts } = await readAllPages((from, to) => {
    const query = supabase.from('contas_privilegiadas')
      .select('*, sistemas_privilegiados(nome_sistema, tipo_sistema, criticidade, responsavel_sistema)')
      .eq('empresa_id', empresaId).order('created_at', { ascending: false }).order('id').range(from, to);
    return signal ? query.abortSignal(signal) : query;
  }, signal);
  const [{ data: campaigns }, { data: decisions }, { data: people }] = await Promise.all([
    readAllPagesByIds(accounts.map(a => a.sistema_id), (ids, from, to) => {
      const query = supabase.from('access_reviews').select('id, sistema_id, nome_revisao, status, data_limite, created_at')
        .eq('empresa_id', empresaId).in('sistema_id', ids).order('id').range(from, to);
      return signal ? query.abortSignal(signal) : query;
    }, signal),
    readAllPagesByIds(accounts.map(a => a.id), (ids, from, to) => {
      const query = supabase.from('access_review_items').select('conta_id, review_id, data_revisao, decisao')
        .in('conta_id', ids).order('id').range(from, to);
      return signal ? query.abortSignal(signal) : query;
    }, signal),
    readAllPagesByIds(accounts.flatMap(a => {
      const id = splitResponsavel(a.sistemas_privilegiados?.responsavel_sistema).userId;
      return id ? [id] : [];
    }), (ids, from, to) => {
      const query = supabase.from('profiles').select('user_id, nome').eq('empresa_id', empresaId)
        .in('user_id', ids).order('user_id').range(from, to);
      return signal ? query.abortSignal(signal) : query;
    }, signal),
  ]);
  const names = new Map(people.map(p => [p.user_id, p.nome]));
  return accounts.map(a => {
    const owner = splitResponsavel(a.sistemas_privilegiados?.responsavel_sistema);
    const context = accountReviewContext(a, campaigns, decisions);
    return { ...a, system_owner_name: (owner.userId ? names.get(owner.userId) : owner.label) ?? null,
      review_id: context.campaign?.id ?? null, review_name: context.campaign?.nome_revisao ?? null,
      review_deadline: context.campaign?.data_limite ?? null,
      last_review_at: context.lastDecision?.data_revisao ?? null };
  });
}
