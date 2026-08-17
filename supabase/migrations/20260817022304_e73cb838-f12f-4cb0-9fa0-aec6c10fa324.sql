GRANT EXECUTE ON FUNCTION public.get_denuncia_config_publica(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consult_denuncia_publica(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_denuncia_publica(text, uuid, text, text, boolean, boolean, text, text, text, text, date, text, text, text, text, inet, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_denuncia_attachment(text, text, text, text, text, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_empresa_by_slug(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_denuncias_categorias_publicas(p_empresa_id uuid)
RETURNS TABLE(id uuid, nome text, descricao text, cor text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
  SELECT c.id, c.nome, c.descricao, c.cor
  FROM public.denuncias_categorias c
  WHERE c.empresa_id = p_empresa_id AND c.ativo = true
  ORDER BY c.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_denuncias_categorias_publicas(uuid) TO anon, authenticated;