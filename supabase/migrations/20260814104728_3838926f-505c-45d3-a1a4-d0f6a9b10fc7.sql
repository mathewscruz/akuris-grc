CREATE TABLE IF NOT EXISTS public.riscos_biblioteca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  titulo text NOT NULL,
  descricao text NOT NULL,
  categoria text NOT NULL,
  causas text[] NOT NULL DEFAULT '{}',
  consequencias text[] NOT NULL DEFAULT '{}',
  probabilidade_sugerida int NOT NULL DEFAULT 3,
  impacto_sugerido int NOT NULL DEFAULT 3,
  tipos_ativo text[] NOT NULL DEFAULT '{}',
  controlos_recomendados text[] NOT NULL DEFAULT '{}',
  origem text NOT NULL DEFAULT 'ISO 27001',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.riscos_biblioteca TO authenticated;
GRANT ALL ON public.riscos_biblioteca TO service_role;

ALTER TABLE public.riscos_biblioteca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Biblioteca legivel por autenticados" ON public.riscos_biblioteca;
CREATE POLICY "Biblioteca legivel por autenticados"
  ON public.riscos_biblioteca FOR SELECT TO authenticated USING (true);

ALTER TABLE public.riscos ADD COLUMN IF NOT EXISTS biblioteca_codigo text;
CREATE INDEX IF NOT EXISTS idx_riscos_biblioteca_codigo ON public.riscos (empresa_id, biblioteca_codigo);

CREATE OR REPLACE FUNCTION public.importar_riscos_biblioteca(codigos text[], mapear_controlos boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_user uuid := auth.uid();
  v_matriz uuid;
  v_niveis jsonb;
  v_metodo text := 'multiplicacao';
  v_criados int := 0;
  v_dup int := 0;
  v_lig int := 0;
  v_nao_encontrados int := 0;
  v_item record;
  v_risco_id uuid;
  v_score numeric;
  v_nivel text;
  v_cod text;
  v_req record;
  v_achou boolean;
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Utilizador sem empresa associada';
  END IF;

  SELECT m.id, c.niveis_risco, COALESCE(c.metodo_calculo, 'multiplicacao')
    INTO v_matriz, v_niveis, v_metodo
  FROM public.riscos_matrizes m
  JOIN public.riscos_matriz_configuracao c ON c.matriz_id = m.id
  WHERE m.empresa_id = v_empresa
  ORDER BY m.created_at
  LIMIT 1;

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

    v_score := CASE WHEN v_metodo = 'soma'
      THEN v_item.probabilidade_sugerida + v_item.impacto_sugerido
      ELSE v_item.probabilidade_sugerida * v_item.impacto_sugerido END;

    v_nivel := NULL;
    IF v_niveis IS NOT NULL THEN
      SELECT n->>'nivel' INTO v_nivel
      FROM jsonb_array_elements(v_niveis) n
      WHERE v_score >= (n->>'min')::numeric AND v_score <= (n->>'max')::numeric
      LIMIT 1;
    END IF;
    IF v_nivel IS NULL OR v_nivel = '' THEN
      v_nivel := CASE
        WHEN v_score >= 20 THEN 'critico'
        WHEN v_score >= 12 THEN 'alto'
        WHEN v_score >= 6 THEN 'medio'
        ELSE 'baixo' END;
    END IF;

    INSERT INTO public.riscos (
      empresa_id, matriz_id, nome, descricao,
      probabilidade_inicial, impacto_inicial, nivel_risco_inicial,
      status, status_aprovacao, causas, consequencias,
      biblioteca_codigo, created_by
    ) VALUES (
      v_empresa, v_matriz, v_item.titulo, v_item.descricao,
      v_item.probabilidade_sugerida::text, v_item.impacto_sugerido::text, v_nivel,
      'identificado', 'rascunho',
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
              SELECT framework_id FROM public.gap_analysis_assessments WHERE empresa_id = v_empresa
            )
        LOOP
          v_achou := true;
          INSERT INTO public.riscos_requisitos (empresa_id, risco_id, requirement_id, framework_id, tipo_vinculacao, created_by)
          VALUES (v_empresa, v_risco_id, v_req.id, v_req.framework_id, 'mitiga', v_user)
          ON CONFLICT DO NOTHING;
          v_lig := v_lig + 1;
        END LOOP;
        IF NOT v_achou THEN
          v_nao_encontrados := v_nao_encontrados + 1;
        END IF;
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

REVOKE ALL ON FUNCTION public.importar_riscos_biblioteca(text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_riscos_biblioteca(text[], boolean) TO authenticated;