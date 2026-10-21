CREATE TABLE public.gap_analysis_framework_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  framework_id uuid NOT NULL REFERENCES public.gap_analysis_frameworks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  atribuido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, framework_id)
);
GRANT SELECT ON public.gap_analysis_framework_owners TO authenticated;
GRANT ALL ON public.gap_analysis_framework_owners TO service_role;
ALTER TABLE public.gap_analysis_framework_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver responsáveis de framework da própria empresa" ON public.gap_analysis_framework_owners
  FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
-- Escrita só pela função abaixo (valida permissão e empresa).

CREATE OR REPLACE FUNCTION public.atribuir_responsavel_framework(p_framework_id uuid, p_user_id uuid, p_aplicar_requisitos boolean DEFAULT true)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_empresa uuid := public.get_user_empresa_id(); v_nome text; v_qtd integer := 0;
BEGIN
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Sem empresa'; END IF;
  IF NOT (public.is_admin_or_super_admin() OR public.usuario_tem_permissao_modulo('gap-analysis','update')) THEN
    RAISE EXCEPTION 'Sem permissão para atribuir responsáveis' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND empresa_id = v_empresa AND ativo) THEN
    RAISE EXCEPTION 'Usuário fora da sua empresa' USING ERRCODE = '42501';
  END IF;
  SELECT nome INTO v_nome FROM gap_analysis_frameworks WHERE id = p_framework_id;
  IF v_nome IS NULL THEN RAISE EXCEPTION 'Framework não encontrado'; END IF;

  INSERT INTO gap_analysis_framework_owners (empresa_id, framework_id, user_id, atribuido_por)
  VALUES (v_empresa, p_framework_id, p_user_id, auth.uid())
  ON CONFLICT (empresa_id, framework_id) DO UPDATE SET user_id = EXCLUDED.user_id, atribuido_por = EXCLUDED.atribuido_por, updated_at = now();

  IF p_aplicar_requisitos THEN
    -- Nunca sobrescreve responsáveis já definidos.
    UPDATE gap_analysis_evaluations SET responsavel_avaliacao = p_user_id
     WHERE empresa_id = v_empresa AND framework_id = p_framework_id AND responsavel_avaliacao IS NULL;
    GET DIAGNOSTICS v_qtd = ROW_COUNT;
    INSERT INTO gap_analysis_evaluations (requirement_id, framework_id, empresa_id, responsavel_avaliacao, created_by)
    SELECT r.id, p_framework_id, v_empresa, p_user_id, auth.uid()
      FROM gap_analysis_requirements r
     WHERE r.framework_id = p_framework_id
       AND (r.empresa_id IS NULL OR r.empresa_id = v_empresa)
       AND NOT EXISTS (SELECT 1 FROM gap_analysis_evaluations e WHERE e.empresa_id = v_empresa AND e.requirement_id = r.id);
    v_qtd := v_qtd + (SELECT count(*) FROM gap_analysis_evaluations WHERE false);
  END IF;

  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.criar_notificacao(p_user_id, 'Você é responsável por um framework',
      'Você foi designado responsável pelo framework ' || v_nome, 'info',
      '/gap-analysis/framework/' || p_framework_id, jsonb_build_object('framework_id', p_framework_id));
  END IF;
  RETURN v_qtd;
END $$;
REVOKE ALL ON FUNCTION public.atribuir_responsavel_framework(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atribuir_responsavel_framework(uuid, uuid, boolean) TO authenticated;