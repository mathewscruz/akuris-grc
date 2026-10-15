CREATE TABLE public.trust_center (
  empresa_id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT false,
  titulo text,
  descricao text,
  contato_email text,
  framework_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.trust_center TO authenticated;
GRANT ALL ON public.trust_center TO service_role;
ALTER TABLE public.trust_center ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tc_select_empresa" ON public.trust_center FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "tc_insert_admin" ON public.trust_center FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.is_admin());
CREATE POLICY "tc_update_admin" ON public.trust_center FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.is_admin())
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.is_admin());

CREATE OR REPLACE FUNCTION public.get_trust_center_publico(_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE tc public.trust_center; r jsonb;
BEGIN
  SELECT * INTO tc FROM public.trust_center WHERE slug = lower(_slug) AND ativo;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'empresa', (SELECT nome FROM public.empresas WHERE id = tc.empresa_id),
    'titulo', tc.titulo, 'descricao', tc.descricao, 'contato_email', tc.contato_email,
    'atualizado_em', tc.updated_at,
    'frameworks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nome', f.nome, 'nome_en', f.nome_en, 'conformidade',
        (SELECT CASE WHEN count(*) FILTER (WHERE e.conformity_status IS DISTINCT FROM 'nao_aplicavel') = 0 THEN 0
          ELSE round(100.0 * (count(*) FILTER (WHERE e.conformity_status='conforme') + 0.5*count(*) FILTER (WHERE e.conformity_status='parcial'))
            / count(*) FILTER (WHERE e.conformity_status IS DISTINCT FROM 'nao_aplicavel')) END
         FROM public.gap_analysis_evaluations e
         WHERE e.empresa_id = tc.empresa_id AND e.framework_id = f.id)) ORDER BY f.nome)
      FROM public.gap_analysis_frameworks f WHERE f.id = ANY(tc.framework_ids)), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.get_trust_center_publico(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_trust_center_publico(text) TO anon, authenticated;