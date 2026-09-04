/* A biblioteca inicia trabalho; não declara uma avaliação concluída. */
CREATE OR REPLACE FUNCTION public.importar_riscos_biblioteca(
  codigos text[],
  mapear_controlos boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_user uuid := auth.uid();
  v_criados integer := 0;
  v_dup integer := 0;
  v_lig integer := 0;
  v_nao_encontrados integer := 0;
  v_item record;
  v_risco_id uuid;
  v_categoria uuid;
  v_cod text;
  v_req record;
  v_achou boolean;
BEGIN
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'EMPRESA_NAO_ENCONTRADA'; END IF;
  IF NOT public.usuario_tem_permissao_modulo('riscos', 'create') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  FOR v_item IN
    SELECT * FROM public.riscos_biblioteca WHERE codigo = ANY(codigos)
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.riscos
       WHERE empresa_id = v_empresa AND biblioteca_codigo = v_item.codigo
    ) THEN
      v_dup := v_dup + 1;
      CONTINUE;
    END IF;

    v_categoria := public.resolver_categoria_biblioteca(v_empresa, v_item.categoria);
    INSERT INTO public.riscos (
      empresa_id, categoria_id, nome, descricao,
      probabilidade_inicial, impacto_inicial,
      status, status_aprovacao, causas, consequencias,
      biblioteca_codigo, created_by
    ) VALUES (
      v_empresa, v_categoria, v_item.titulo, v_item.descricao,
      v_item.probabilidade_sugerida::smallint, v_item.impacto_sugerido::smallint,
      'rascunho', 'rascunho',
      NULLIF(array_to_string(v_item.causas, E'\n'), ''),
      NULLIF(array_to_string(v_item.consequencias, E'\n'), ''),
      v_item.codigo, v_user
    ) RETURNING id INTO v_risco_id;
    v_criados := v_criados + 1;

    IF mapear_controlos THEN
      FOREACH v_cod IN ARRAY v_item.controlos_recomendados LOOP
        v_achou := false;
        FOR v_req IN
          SELECT DISTINCT r.id, r.framework_id
            FROM public.gap_analysis_requirements r
           WHERE upper(replace(r.codigo, ' ', '')) = upper(replace(v_cod, ' ', ''))
             AND r.framework_id IN (
               SELECT framework_id FROM public.gap_analysis_assessments
                WHERE empresa_id = v_empresa
             )
        LOOP
          v_achou := true;
          INSERT INTO public.riscos_requisitos (
            empresa_id, risco_id, requirement_id, framework_id,
            tipo_vinculacao, created_by
          ) VALUES (
            v_empresa, v_risco_id, v_req.id, v_req.framework_id,
            'relacionado', v_user
          ) ON CONFLICT DO NOTHING;
          v_lig := v_lig + 1;
        END LOOP;
        IF NOT v_achou THEN v_nao_encontrados := v_nao_encontrados + 1; END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'criados', v_criados,
    'ignorados_duplicados', v_dup,
    'ligacoes_criadas', v_lig,
    'controlos_nao_encontrados', v_nao_encontrados
  );
END;
$$;
