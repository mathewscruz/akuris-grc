import { supabase } from '@/integrations/supabase/client';

/**
 * Acesso público (anónimo) aos dados mínimos da empresa para o canal de denúncia.
 * Usa RPCs SECURITY DEFINER porque a tabela `empresas` está protegida por RLS
 * e não pode ser lida por visitantes não autenticados.
 */
export interface EmpresaPublica {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  canal_ativo: boolean;
}

export async function fetchEmpresaPublicaPorSlug(slug: string): Promise<EmpresaPublica | null> {
  const { data, error } = await supabase.rpc('get_empresa_publica_por_slug' as never, {
    p_slug: slug.toLowerCase().trim(),
  } as never);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : (data ?? null);
  return (row as EmpresaPublica) ?? null;
}

export async function fetchEmpresaPublicaPorToken(token: string): Promise<EmpresaPublica | null> {
  const { data, error } = await supabase.rpc('get_empresa_publica_por_token' as never, {
    p_token: token.trim(),
  } as never);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : (data ?? null);
  return (row as EmpresaPublica) ?? null;
}
