-- A validação usava uma tabela temporária. Ela funcionava em execução, mas
-- impedia a análise estática do banco e criava estado desnecessário na sessão.
-- Um array local representa o mesmo conjunto de resultados possíveis.
CREATE OR REPLACE FUNCTION public.criar_matriz_com_configuracao(
  p_nome text,
  p_descricao text,
  p_escala_probabilidade jsonb,
  p_escala_impacto jsonb,
  p_niveis_risco jsonb,
  p_metodo_calculo text DEFAULT 'multiplicacao',
  p_matriz_id uuid DEFAULT NULL,
  p_apetite_score smallint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_matriz_id uuid;
  v_metodo text;
  v_p_max integer;
  v_i_max integer;
  v_scores_possiveis integer[];
  v_score_min integer;
  v_score_max integer;
  v_inalcancaveis text;
  v_apetite smallint;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'EMPRESA_NAO_ENCONTRADA'; END IF;
  IF coalesce(btrim(p_nome), '') = '' THEN RAISE EXCEPTION 'NOME_OBRIGATORIO'; END IF;

  v_metodo := coalesce(nullif(p_metodo_calculo, ''), 'multiplicacao');

  SELECT count(*) INTO v_p_max FROM jsonb_array_elements(p_escala_probabilidade);
  SELECT count(*) INTO v_i_max FROM jsonb_array_elements(p_escala_impacto);
  IF v_p_max < 2 OR v_i_max < 2 THEN RAISE EXCEPTION 'ESCALA_MINIMA'; END IF;

  SELECT array_agg(DISTINCT CASE WHEN v_metodo = 'soma' THEN p.n + i.n ELSE p.n * i.n END)
    INTO v_scores_possiveis
    FROM generate_series(1, v_p_max) AS p(n)
    CROSS JOIN generate_series(1, v_i_max) AS i(n);

  SELECT min(score), max(score)
    INTO v_score_min, v_score_max
    FROM unnest(v_scores_possiveis) AS score;

  IF EXISTS (
    SELECT 1
      FROM unnest(v_scores_possiveis) AS score
     WHERE NOT EXISTS (
       SELECT 1
         FROM jsonb_array_elements(p_niveis_risco) AS nivel
        WHERE score BETWEEN (nivel->>'min')::integer AND (nivel->>'max')::integer
     )
  ) THEN
    RAISE EXCEPTION 'FAIXAS_NAO_COBREM_ESCALA: % a %', v_score_min, v_score_max;
  END IF;

  SELECT string_agg(nivel->>'nivel', ', ' ORDER BY (nivel->>'min')::integer)
    INTO v_inalcancaveis
    FROM jsonb_array_elements(p_niveis_risco) AS nivel
   WHERE NOT EXISTS (
     SELECT 1
       FROM unnest(v_scores_possiveis) AS score
      WHERE score BETWEEN (nivel->>'min')::integer AND (nivel->>'max')::integer
   );

  IF v_inalcancaveis IS NOT NULL THEN
    RAISE EXCEPTION 'FAIXA_INALCANCAVEL: % (resultados possíveis: % a %)',
      v_inalcancaveis, v_score_min, v_score_max;
  END IF;

  v_apetite := COALESCE(
    p_apetite_score,
    (SELECT (nivel->>'max')::smallint
       FROM jsonb_array_elements(p_niveis_risco) AS nivel
      WHERE (nivel->>'apetite')::boolean IS TRUE
      ORDER BY (nivel->>'min')::integer
      LIMIT 1),
    (SELECT (nivel->>'max')::smallint
       FROM jsonb_array_elements(p_niveis_risco) AS nivel
      ORDER BY (nivel->>'min')::integer
      OFFSET 1 LIMIT 1)
  );

  IF p_matriz_id IS NOT NULL THEN
    UPDATE public.riscos_matrizes
       SET nome = p_nome, descricao = p_descricao, updated_at = now()
     WHERE id = p_matriz_id AND empresa_id = v_empresa_id
     RETURNING id INTO v_matriz_id;
    IF v_matriz_id IS NULL THEN RAISE EXCEPTION 'MATRIZ_NAO_ENCONTRADA'; END IF;
  ELSE
    INSERT INTO public.riscos_matrizes (nome, descricao, empresa_id)
    VALUES (p_nome, p_descricao, v_empresa_id)
    RETURNING id INTO v_matriz_id;
  END IF;

  UPDATE public.riscos_matrizes
     SET ativa = false
   WHERE empresa_id = v_empresa_id AND ativa AND id <> v_matriz_id;
  UPDATE public.riscos_matrizes SET ativa = true WHERE id = v_matriz_id;

  INSERT INTO public.riscos_matriz_configuracao (
    matriz_id, escala_probabilidade, escala_impacto, niveis_risco, metodo_calculo, apetite_score
  ) VALUES (
    v_matriz_id, p_escala_probabilidade, p_escala_impacto, p_niveis_risco, v_metodo, v_apetite
  )
  ON CONFLICT (matriz_id) DO UPDATE SET
    escala_probabilidade = EXCLUDED.escala_probabilidade,
    escala_impacto = EXCLUDED.escala_impacto,
    niveis_risco = EXCLUDED.niveis_risco,
    metodo_calculo = EXCLUDED.metodo_calculo,
    apetite_score = EXCLUDED.apetite_score,
    updated_at = now();

  PERFORM public.riscos_recalcular_empresa(v_empresa_id);
  RETURN v_matriz_id;
END;
$$;
