CREATE OR REPLACE FUNCTION public.get_empresa_publica_por_slug(p_slug text)
RETURNS TABLE(id uuid, nome text, slug text, logo_url text, canal_ativo boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
  SELECT e.id, e.nome, e.slug, e.logo_url,
         COALESCE(c.ativo, false) AS canal_ativo
  FROM public.empresas e
  LEFT JOIN public.denuncias_configuracoes c ON c.empresa_id = e.id
  WHERE lower(e.slug) = lower(btrim(p_slug))
    AND e.ativo = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_empresa_publica_por_slug(text) TO anon, authenticated;