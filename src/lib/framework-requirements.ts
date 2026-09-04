import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchAllPaginated } from '@/lib/supabase-paginate';

export type FrameworkRequirement = Database['public']['Tables']['gap_analysis_requirements']['Row'];

/**
 * Catálogo imutável durante a sessão, compartilhado por todos os painéis do
 * detalhe de um framework. Sem esta camada, cabeçalho, score, fila e tabela
 * pediam as mesmas centenas de linhas ao PostgREST ao mesmo tempo.
 */
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; request: Promise<FrameworkRequirement[]> }>();

export function fetchFrameworkRequirements(frameworkId: string): Promise<FrameworkRequirement[]> {
  const cached = cache.get(frameworkId);
  if (cached && cached.expiresAt > Date.now()) return cached.request;

  const request = fetchAllPaginated<FrameworkRequirement>(() =>
    supabase
      .from('gap_analysis_requirements')
      .select('*')
      .eq('framework_id', frameworkId)
      .order('ordem', { ascending: true }),
  )
    .then(({ data, error }) => {
      if (error) throw error;
      return data || [];
    })
    .catch((error) => {
      cache.delete(frameworkId);
      throw error;
    });

  cache.set(frameworkId, { expiresAt: Date.now() + CACHE_TTL_MS, request });
  return request;
}

export function clearFrameworkRequirementsCache(frameworkId?: string) {
  if (frameworkId) cache.delete(frameworkId);
  else cache.clear();
}
