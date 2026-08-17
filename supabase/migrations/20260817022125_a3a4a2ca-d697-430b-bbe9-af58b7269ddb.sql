CREATE OR REPLACE FUNCTION public.get_empresa_publica_por_token(p_token text)
RETURNS TABLE(id uuid, nome text, slug text, logo_url text, canal_ativo boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
  SELECT e.id, e.nome, e.slug, e.logo_url, COALESCE(c.ativo, false)
  FROM public.denuncias_configuracoes c
  JOIN public.empresas e ON e.id = c.empresa_id AND e.ativo = true
  WHERE c.token_publico = btrim(p_token)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_empresa_publica_por_token(text) TO anon, authenticated;