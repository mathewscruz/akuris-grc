CREATE OR REPLACE FUNCTION public.aceitar_risco_sugerido(p_id uuid, p_nome text, p_descricao text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s integracao_riscos_sugeridos; v_emp uuid := get_user_empresa_id(); v_risco uuid;
  v_matriz uuid; cfg riscos_matriz_configuracao; v_p smallint; v_i smallint; v_score int; v_nivel text;
BEGIN
  IF v_emp IS NULL OR NOT has_valid_mfa_session() OR NOT usuario_tem_permissao_modulo('riscos','create') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO s FROM integracao_riscos_sugeridos WHERE id = p_id AND empresa_id = v_emp FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  -- Retry after a successful accept returns the same risk, never a duplicate.
  IF s.risco_id IS NOT NULL THEN RETURN s.risco_id; END IF;
  IF s.estado <> 'aberta' THEN RAISE EXCEPTION 'already_decided'; END IF;
  IF coalesce(trim(p_nome),'') = '' THEN RAISE EXCEPTION 'name_required'; END IF;

  -- Use the company's active matrix; suggested values are kept only when they exist on its scales.
  SELECT m.id INTO v_matriz FROM riscos_matrizes m WHERE m.empresa_id = v_emp AND m.ativa
    ORDER BY m.publicada_em DESC NULLS LAST, m.versao DESC LIMIT 1;
  IF v_matriz IS NOT NULL THEN
    SELECT * INTO cfg FROM riscos_matriz_configuracao WHERE matriz_id = v_matriz;
    IF FOUND THEN
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(cfg.escala_probabilidade) e WHERE (e->>'valor')::int = s.probabilidade)
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(cfg.escala_impacto) e WHERE (e->>'valor')::int = s.impacto) THEN
        v_p := s.probabilidade; v_i := s.impacto;
        v_score := CASE WHEN cfg.metodo_calculo = 'soma' THEN v_p + v_i ELSE v_p * v_i END;
        SELECT n->>'nivel' INTO v_nivel FROM jsonb_array_elements(cfg.niveis_risco) n
          WHERE v_score BETWEEN (n->>'min')::int AND (n->>'max')::int LIMIT 1;
        IF v_nivel IS NULL THEN v_p := NULL; v_i := NULL; END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO riscos (empresa_id, nome, descricao, matriz_id, probabilidade_inicial, impacto_inicial, nivel_risco_inicial, status)
  VALUES (v_emp, left(p_nome, 300), left(p_descricao, 4000), v_matriz, v_p, v_i, v_nivel, 'identificado')
  RETURNING id INTO v_risco;
  UPDATE integracao_riscos_sugeridos SET estado = 'aceita', risco_id = v_risco, decidido_por = auth.uid(), decidido_em = now(), updated_at = now() WHERE id = p_id;
  RETURN v_risco;
END $$;
REVOKE ALL ON FUNCTION public.aceitar_risco_sugerido(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceitar_risco_sugerido(uuid, text, text) TO authenticated;