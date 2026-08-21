-- Três funções SQL continuavam a calcular e a escrever o nível de risco.
--
-- A migration `20260821100000` moveu o cálculo para `trg_risco_calcular` e
-- converteu probabilidade e impacto para `smallint`. O código da aplicação foi
-- todo revisto, mas estas vivem no próprio banco e passaram ao lado:
--
--   importar_riscos_biblioteca          RPC do ecrã "Biblioteca de riscos"
--   popular_riscos_demo                 conta de demonstração
--   popular_dados_demonstracao_direto   idem
--
-- As três inseriam probabilidade e impacto como TEXTO ('provavel',
-- 'catastrofico', ou `numero::text`) em colunas que agora são `smallint`:
--
--   ERROR: column "probabilidade_inicial" is of type smallint
--          but expression is of type text
--
-- Importar da biblioteca deixou de funcionar, e uma conta nova de
-- demonstração ficaria sem riscos nenhuns. O teste que guarda esta invariante
-- lê `src/` — e isto é PL/pgSQL, fora do seu alcance.
--
-- `importar_riscos_biblioteca` trazia ainda a sua própria cópia da aritmética
-- (procurar a matriz por `ORDER BY created_at LIMIT 1`, calcular o score,
-- encontrar a faixa) e um fallback com limiares 20/12/6 — que nem sequer são
-- os do produto. Some tudo: probabilidade e impacto entram em número e o
-- trigger faz o resto.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Importar da biblioteca de riscos
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.importar_riscos_biblioteca(
  codigos text[],
  mapear_controlos boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_user_empresa_id();
  v_user uuid := auth.uid();
  v_criados int := 0;
  v_dup int := 0;
  v_lig int := 0;
  v_nao_encontrados int := 0;
  v_item record;
  v_risco_id uuid;
  v_categoria uuid;
  v_cod text;
  v_req record;
  v_achou boolean;
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Utilizador sem empresa associada';
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

    -- Só as entradas do cálculo. `matriz_id`, `nivel_risco_inicial`,
    -- `score_inicial` e `severidade_inicial` são do trigger.
    INSERT INTO public.riscos (
      empresa_id, categoria_id, nome, descricao,
      probabilidade_inicial, impacto_inicial,
      status, status_aprovacao, causas, consequencias,
      biblioteca_codigo, created_by
    ) VALUES (
      v_empresa, v_categoria, v_item.titulo, v_item.descricao,
      v_item.probabilidade_sugerida::smallint, v_item.impacto_sugerido::smallint,
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
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 2 e 3. Riscos de demonstração
-- ══════════════════════════════════════════════════════════════════════════
--
-- Reescreve-se apenas o INSERT de riscos dentro de cada função, preservando o
-- resto: `popular_dados_demonstracao_direto` povoa oito módulos e é longa.
-- Os valores textuais passam à posição equivalente numa escala de 5 — os
-- mesmos números que `risco_escala_numero` já lhes atribuía.

DO $$
DECLARE
  alvo record;
  v_src text;
  v_novo text;
  v_args text;
  v_ret text;
BEGIN
  FOR alvo IN
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) AS ret,
           p.prosrc AS src
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('popular_riscos_demo', 'popular_dados_demonstracao_direto')
  LOOP
    v_src := alvo.src;
    v_novo := replace(
      v_src,
      'INSERT INTO public.riscos (empresa_id, nome, descricao, categoria_id, matriz_id, probabilidade_inicial, impacto_inicial, nivel_risco_inicial, status, responsavel, data_identificacao, created_by)',
      'INSERT INTO public.riscos (empresa_id, nome, descricao, categoria_id, probabilidade_inicial, impacto_inicial, status, responsavel, data_identificacao, created_by)'
    );

    v_novo := replace(v_novo, 'v_matriz_id, ''provavel'', ''catastrofico'', ''critico''', '4, 5');
    v_novo := replace(v_novo, 'v_matriz_id, ''possivel'', ''maior'', ''alto''', '3, 4');
    v_novo := replace(v_novo, 'v_matriz_id, ''provavel'', ''maior'', ''alto''', '4, 4');
    v_novo := replace(v_novo, 'v_matriz_id, ''possivel'', ''moderado'', ''medio''', '3, 3');
    v_novo := replace(v_novo, 'v_matriz_id, ''improvavel'', ''maior'', ''medio''', '2, 4');
    v_novo := replace(v_novo, 'v_matriz_id, ''quase_certo'', ''catastrofico'', ''critico''', '5, 5');
    v_novo := replace(v_novo, 'v_matriz_id, ''improvavel'', ''catastrofico'', ''alto''', '2, 5');
    v_novo := replace(v_novo, 'v_matriz_id, ''possivel'', ''catastrofico'', ''critico''', '3, 5');

    /*
      De caminho, o insert de `sistemas_privilegiados` desta mesma função
      usava `nome` e `descricao`, colunas que não existem (é `nome_sistema`,
      e descrição não há). A função apanha a excepção e devolve
      `{"success": false}`, portanto a conta de demonstração ficava vazia e
      ninguém via um erro — só um painel sem dados nenhuns.
    */
    v_novo := replace(v_novo,
      'INSERT INTO public.sistemas_privilegiados (nome, descricao, tipo_sistema, criticidade, empresa_id)',
      'INSERT INTO public.sistemas_privilegiados (nome_sistema, tipo_sistema, criticidade, empresa_id)');
    v_novo := replace(v_novo,
      '''Active Directory'', ''Controlador de domínio'', ''Autenticação'', ''critico'', p_empresa_id',
      '''Active Directory'', ''Autenticação'', ''critico'', p_empresa_id');

    -- Rede de segurança: se alguma combinação escapou, a função fica na mesma
    -- e o aviso aparece — melhor do que gravar uma reescrita meio feita.
    IF v_novo LIKE '%v_matriz_id, ''%' THEN
      RAISE EXCEPTION 'combinação de probabilidade/impacto não mapeada em %', alvo.proname;
    END IF;

    IF v_novo <> v_src THEN
      EXECUTE format(
        'CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s
           LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS %L',
        alvo.proname, alvo.args, alvo.ret, v_novo);
      RAISE NOTICE 'reescrita: %', alvo.proname;
    ELSE
      RAISE NOTICE 'sem alteração (verificar à mão): %', alvo.proname;
    END IF;
  END LOOP;
END $$;
