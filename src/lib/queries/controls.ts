import { supabase } from '@/integrations/supabase/client';
import { readAllPages, readAllPagesByIds } from '@/lib/read-all-pages';
import { resumirTestesPorControlo } from '@/lib/controle-testes';

/** Read all tenant list pages. This is not a transactional database snapshot. */
export async function loadControls(empresaId: string, signal?: AbortSignal) {
  const { data: controls } = await readAllPages((from, to) => {
    const query = supabase.from('controles').select('*, categoria:controles_categorias(nome, cor)')
      .eq('empresa_id', empresaId).order('created_at', { ascending: false }).order('id').range(from, to);
    return signal ? query.abortSignal(signal) : query;
  }, signal);
  const [{ data: tests }, { data: profiles }] = await Promise.all([
    readAllPagesByIds(controls.map(c => c.id), (ids, from, to) => {
      const query = supabase.from('controles_testes').select('controle_id, resultado, data_teste, proxima_avaliacao')
        .in('controle_id', ids).order('id').range(from, to);
      return signal ? query.abortSignal(signal) : query;
    }, signal),
    readAllPagesByIds(controls.flatMap(c => c.responsavel_id ? [c.responsavel_id] : []), (ids, from, to) => {
      const query = supabase.from('profiles').select('user_id, nome, foto_url')
        .eq('empresa_id', empresaId).in('user_id', ids).order('user_id').range(from, to);
      return signal ? query.abortSignal(signal) : query;
    }, signal),
  ]);
  const summary = resumirTestesPorControlo(tests);
  const people = new Map(profiles.map(p => [p.user_id, p]));
  return controls.map(c => ({ ...c,
    responsavel_nome: people.get(c.responsavel_id ?? '')?.nome ?? null,
    responsavel_foto: people.get(c.responsavel_id ?? '')?.foto_url ?? null,
    testesCount: summary.get(c.id)?.total ?? 0,
    ultimoResultado: summary.get(c.id)?.ultimoResultado ?? null,
  }));
}
