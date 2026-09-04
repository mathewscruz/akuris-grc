/*
  Gestão de riscos — integridade do ciclo de vida.

  Esta migração faz quatro mudanças deliberadas:
  1. riscos deixam de ser apagados e passam a ser arquivados;
  2. matrizes publicadas são versionadas e o livro de avaliações guarda a versão;
  3. tratamento e plano de ação passam a nascer/ser atualizados na mesma transação;
  4. as permissões do módulo passam a valer também no banco, não apenas na tela.
*/

-- ───────────────────── ciclo de vida e arquivo ─────────────────────
ALTER TABLE public.riscos
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento text,
  ADD COLUMN IF NOT EXISTS avaliacao_finalizada_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_observacao_avaliacao text,
  ADD COLUMN IF NOT EXISTS comentarios_aceite text;

CREATE INDEX IF NOT EXISTS riscos_empresa_ativos_idx
  ON public.riscos (empresa_id, created_at DESC)
  WHERE arquivado_em IS NULL;

-- “Aceito” é uma decisão formal, não uma etapa do fluxo operacional.
UPDATE public.riscos
   SET status = CASE WHEN aceito IS TRUE THEN 'monitorado' ELSE 'analisado' END
 WHERE status = 'aceito';

-- Corrige os estados legados que afirmavam existir tratamento sem evidência.
WITH resumo AS (
  SELECT r.id,
         count(t.id) FILTER (
           WHERE lower(translate(t.status, 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')) NOT IN ('cancelado', 'cancelada')
         ) AS requeridos,
         count(t.id) FILTER (
           WHERE lower(translate(t.status, 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')) IN ('concluido', 'concluida', 'finalizado', 'finalizada')
         ) AS concluidos
    FROM public.riscos r
    LEFT JOIN public.riscos_tratamentos t ON t.risco_id = r.id
   WHERE r.status IN ('tratado', 'em_tratamento')
   GROUP BY r.id
)
UPDATE public.riscos r
   SET status = CASE
     WHEN resumo.requeridos = 0 THEN 'analisado'
     WHEN resumo.requeridos = resumo.concluidos THEN 'tratado'
     ELSE 'em_tratamento'
   END
  FROM resumo
 WHERE resumo.id = r.id;

ALTER TABLE public.riscos DROP CONSTRAINT IF EXISTS riscos_status_check;
ALTER TABLE public.riscos ADD CONSTRAINT riscos_status_check CHECK (
  status IN ('rascunho', 'identificado', 'analisado', 'em_tratamento',
             'tratado', 'monitorado', 'em_revisao', 'arquivado')
);

CREATE OR REPLACE FUNCTION public.arquivar_risco(
  p_risco_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
    FROM public.riscos
   WHERE id = p_risco_id
     AND empresa_id = public.get_user_empresa_id()
     AND arquivado_em IS NULL
   FOR UPDATE;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'RISCO_NAO_ENCONTRADO';
  END IF;
  IF NOT public.usuario_tem_permissao_modulo('riscos', 'delete') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  UPDATE public.riscos
     SET arquivado_em = now(),
         arquivado_por = auth.uid(),
         motivo_arquivamento = nullif(btrim(p_motivo), ''),
         status = 'arquivado'
   WHERE id = p_risco_id;
END;
$$;

REVOKE ALL ON FUNCTION public.arquivar_risco(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arquivar_risco(uuid, text) TO authenticated;

-- O antigo AFTER DELETE tentava inserir no histórico um risk_id que acabara
-- de ser eliminado, contrariando a própria FK. Arquivo preserva a linha e a
-- trilha; exclusão física deixa de ser um fluxo da aplicação.
DROP TRIGGER IF EXISTS trg_risco_livro_del ON public.riscos;

-- ───────────────────── versão da matriz ─────────────────────
ALTER TABLE public.riscos_matrizes
  ADD COLUMN IF NOT EXISTS versao integer,
  ADD COLUMN IF NOT EXISTS substitui_matriz_id uuid REFERENCES public.riscos_matrizes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS publicada_em timestamptz;

WITH numeradas AS (
  SELECT id,
         row_number() OVER (PARTITION BY empresa_id ORDER BY created_at, id)::integer AS n
    FROM public.riscos_matrizes
)
UPDATE public.riscos_matrizes m
   SET versao = n.n,
       publicada_em = COALESCE(m.publicada_em, m.created_at)
  FROM numeradas n
 WHERE n.id = m.id
   AND (m.versao IS NULL OR m.publicada_em IS NULL);

ALTER TABLE public.riscos_matrizes ALTER COLUMN versao SET NOT NULL;
ALTER TABLE public.riscos_matrizes ALTER COLUMN versao SET DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS riscos_matrizes_empresa_versao_uidx
  ON public.riscos_matrizes (empresa_id, versao);

ALTER TABLE public.riscos_historico_avaliacoes
  ADD COLUMN IF NOT EXISTS matriz_id uuid REFERENCES public.riscos_matrizes(id) ON DELETE SET NULL;

UPDATE public.riscos_historico_avaliacoes h
   SET matriz_id = r.matriz_id
  FROM public.riscos r
 WHERE r.id = h.risco_id
   AND h.matriz_id IS NULL;

CREATE INDEX IF NOT EXISTS riscos_historico_matriz_idx
  ON public.riscos_historico_avaliacoes (matriz_id);

CREATE OR REPLACE FUNCTION public.risco_avaliar_na_matriz(
  p_matriz_id uuid,
  p_probabilidade smallint,
  p_impacto smallint
)
RETURNS TABLE (score smallint, nivel text, severidade text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_config record;
  v_score integer;
  v_nivel text;
BEGIN
  IF p_probabilidade IS NULL OR p_impacto IS NULL OR p_matriz_id IS NULL THEN
    RETURN QUERY SELECT NULL::smallint, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT c.niveis_risco, COALESCE(NULLIF(c.metodo_calculo, ''), 'multiplicacao') AS metodo
    INTO v_config
    FROM public.riscos_matriz_configuracao c
   WHERE c.matriz_id = p_matriz_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::smallint, NULL::text, NULL::text;
    RETURN;
  END IF;

  v_score := CASE WHEN v_config.metodo = 'soma'
                  THEN p_probabilidade + p_impacto
                  ELSE p_probabilidade * p_impacto END;

  SELECT n->>'nivel' INTO v_nivel
    FROM jsonb_array_elements(v_config.niveis_risco) n
   WHERE v_score BETWEEN (n->>'min')::integer AND (n->>'max')::integer
   ORDER BY (n->>'min')::integer
   LIMIT 1;

  RETURN QUERY SELECT
    v_score::smallint,
    v_nivel,
    public.risco_severidade_da_faixa(v_config.niveis_risco, v_nivel);
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_risco_historico_calcular()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v record;
BEGIN
  IF NEW.matriz_id IS NULL THEN
    SELECT matriz_id INTO NEW.matriz_id
      FROM public.risco_matriz_vigente(NEW.empresa_id);
  END IF;
  SELECT * INTO v
    FROM public.risco_avaliar_na_matriz(NEW.matriz_id, NEW.probabilidade, NEW.impacto);
  NEW.score       := COALESCE(v.score, NEW.score);
  NEW.nivel_risco := COALESCE(v.nivel, NEW.nivel_risco);
  NEW.severidade  := COALESCE(v.severidade, NEW.severidade);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_risco_registar_no_livro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_autor uuid := auth.uid();
  v_por_omissao boolean;
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.probabilidade_inicial IS DISTINCT FROM OLD.probabilidade_inicial
     OR NEW.impacto_inicial IS DISTINCT FROM OLD.impacto_inicial THEN
    INSERT INTO public.riscos_historico_avaliacoes (
      risco_id, empresa_id, matriz_id, probabilidade, impacto,
      nivel_risco, tipo, avaliado_por, observacoes
    ) VALUES (
      NEW.id, NEW.empresa_id, NEW.matriz_id,
      COALESCE(NEW.probabilidade_inicial, 1), COALESCE(NEW.impacto_inicial, 1),
      COALESCE(NEW.nivel_risco_inicial, 'Não avaliado'), 'inicial', v_autor,
      nullif(btrim(NEW.ultima_observacao_avaliacao), '')
    );
  END IF;

  v_por_omissao :=
    NEW.probabilidade_residual = NEW.probabilidade_inicial
    AND NEW.impacto_residual = NEW.impacto_inicial
    AND (TG_OP = 'INSERT' OR OLD.probabilidade_residual IS NULL OR OLD.impacto_residual IS NULL);

  IF NEW.probabilidade_residual IS NOT NULL
     AND NEW.impacto_residual IS NOT NULL
     AND NOT COALESCE(v_por_omissao, false)
     AND (TG_OP = 'INSERT'
       OR NEW.probabilidade_residual IS DISTINCT FROM OLD.probabilidade_residual
       OR NEW.impacto_residual IS DISTINCT FROM OLD.impacto_residual) THEN
    INSERT INTO public.riscos_historico_avaliacoes (
      risco_id, empresa_id, matriz_id, probabilidade, impacto,
      nivel_risco, tipo, avaliado_por, observacoes
    ) VALUES (
      NEW.id, NEW.empresa_id, NEW.matriz_id,
      NEW.probabilidade_residual, NEW.impacto_residual,
      COALESCE(NEW.nivel_risco_residual, NEW.nivel_risco_inicial, 'Não avaliado'),
      'residual', v_autor, nullif(btrim(NEW.ultima_observacao_avaliacao), '')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_risco_livro_ins ON public.riscos;
DROP TRIGGER IF EXISTS trg_risco_livro_upd ON public.riscos;
CREATE TRIGGER trg_risco_livro_ins
  AFTER INSERT ON public.riscos
  FOR EACH ROW EXECUTE FUNCTION public.tg_risco_registar_no_livro();
CREATE TRIGGER trg_risco_livro_upd
  AFTER UPDATE OF probabilidade_inicial, impacto_inicial,
                  probabilidade_residual, impacto_residual
  ON public.riscos
  FOR EACH ROW EXECUTE FUNCTION public.tg_risco_registar_no_livro();

CREATE OR REPLACE FUNCTION public.riscos_recalcular_empresa(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_linhas integer;
  v_matriz_id uuid;
BEGIN
  PERFORM public.exige_empresa_da_sessao(p_empresa_id);
  SELECT matriz_id INTO v_matriz_id FROM public.risco_matriz_vigente(p_empresa_id);
  IF v_matriz_id IS NULL THEN RETURN 0; END IF;

  UPDATE public.riscos r
     SET matriz_id = v_matriz_id,
         score_inicial = a.score_inicial,
         nivel_risco_inicial = a.nivel_inicial,
         severidade_inicial = a.severidade_inicial,
         score_residual = a.score_residual,
         nivel_risco_residual = a.nivel_residual,
         severidade_residual = a.severidade_residual
    FROM (
      SELECT x.id,
             ini.score AS score_inicial,
             ini.nivel AS nivel_inicial,
             ini.severidade AS severidade_inicial,
             res.score AS score_residual,
             res.nivel AS nivel_residual,
             res.severidade AS severidade_residual
        FROM public.riscos x
        CROSS JOIN LATERAL public.risco_avaliar_na_matriz(
          v_matriz_id, x.probabilidade_inicial, x.impacto_inicial
        ) ini
        CROSS JOIN LATERAL public.risco_avaliar_na_matriz(
          v_matriz_id, x.probabilidade_residual, x.impacto_residual
        ) res
       WHERE x.empresa_id = p_empresa_id AND x.arquivado_em IS NULL
    ) a
   WHERE r.empresa_id = p_empresa_id
     AND r.arquivado_em IS NULL
     AND (r.matriz_id IS DISTINCT FROM v_matriz_id
       OR r.score_inicial IS DISTINCT FROM a.score_inicial
       OR r.nivel_risco_inicial IS DISTINCT FROM a.nivel_inicial
       OR r.severidade_inicial IS DISTINCT FROM a.severidade_inicial
       OR r.score_residual IS DISTINCT FROM a.score_residual
       OR r.nivel_risco_residual IS DISTINCT FROM a.nivel_residual
       OR r.severidade_residual IS DISTINCT FROM a.severidade_residual)
     AND r.id = a.id;
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  RETURN v_linhas;
END;
$$;

COMMENT ON FUNCTION public.riscos_recalcular_empresa(uuid) IS
  'Reclassifica somente o estado atual pela matriz vigente. O livro de avaliações é imutável e preserva a matriz de cada avaliação.';

-- O endpoint mantém a assinatura pública, mas editar uma matriz publicada cria
-- uma nova versão. A versão anterior continua ligada às avaliações antigas.
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
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_empresa_id uuid := public.get_user_empresa_id();
  v_nova_matriz_id uuid;
  v_metodo text := COALESCE(NULLIF(p_metodo_calculo, ''), 'multiplicacao');
  v_p_max integer;
  v_i_max integer;
  v_scores integer[];
  v_min integer;
  v_max integer;
  v_inalcancaveis text;
  v_apetite smallint;
  v_versao integer;
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'EMPRESA_NAO_ENCONTRADA'; END IF;
  IF NOT public.is_admin_or_super_admin() THEN RAISE EXCEPTION 'APENAS_ADMIN_CONFIGURA_MATRIZ'; END IF;
  IF COALESCE(btrim(p_nome), '') = '' THEN RAISE EXCEPTION 'NOME_OBRIGATORIO'; END IF;
  IF p_matriz_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.riscos_matrizes WHERE id = p_matriz_id AND empresa_id = v_empresa_id
  ) THEN RAISE EXCEPTION 'MATRIZ_NAO_ENCONTRADA'; END IF;

  SELECT count(*) INTO v_p_max FROM jsonb_array_elements(p_escala_probabilidade);
  SELECT count(*) INTO v_i_max FROM jsonb_array_elements(p_escala_impacto);
  IF v_p_max < 2 OR v_i_max < 2 THEN RAISE EXCEPTION 'ESCALA_MINIMA'; END IF;

  SELECT array_agg(DISTINCT CASE WHEN v_metodo = 'soma' THEN p.n + i.n ELSE p.n * i.n END)
    INTO v_scores
    FROM generate_series(1, v_p_max) p(n)
    CROSS JOIN generate_series(1, v_i_max) i(n);
  SELECT min(s), max(s) INTO v_min, v_max FROM unnest(v_scores) s;

  IF EXISTS (
    SELECT 1 FROM unnest(v_scores) s
     WHERE NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_niveis_risco) n
        WHERE s BETWEEN (n->>'min')::integer AND (n->>'max')::integer
     )
  ) THEN RAISE EXCEPTION 'FAIXAS_NAO_COBREM_ESCALA: % a %', v_min, v_max; END IF;

  SELECT string_agg(n->>'nivel', ', ' ORDER BY (n->>'min')::integer)
    INTO v_inalcancaveis
    FROM jsonb_array_elements(p_niveis_risco) n
   WHERE NOT EXISTS (
     SELECT 1 FROM unnest(v_scores) s
      WHERE s BETWEEN (n->>'min')::integer AND (n->>'max')::integer
   );
  IF v_inalcancaveis IS NOT NULL THEN
    RAISE EXCEPTION 'FAIXA_INALCANCAVEL: % (resultados possíveis: % a %)', v_inalcancaveis, v_min, v_max;
  END IF;

  v_apetite := COALESCE(
    p_apetite_score,
    (SELECT (n->>'max')::smallint FROM jsonb_array_elements(p_niveis_risco) n
      WHERE COALESCE((n->>'apetite')::boolean, false) ORDER BY (n->>'min')::integer LIMIT 1),
    (SELECT (n->>'max')::smallint FROM jsonb_array_elements(p_niveis_risco) n
      ORDER BY (n->>'min')::integer OFFSET 1 LIMIT 1)
  );

  SELECT COALESCE(max(versao), 0) + 1 INTO v_versao
    FROM public.riscos_matrizes WHERE empresa_id = v_empresa_id;

  INSERT INTO public.riscos_matrizes (
    nome, descricao, empresa_id, ativa, versao, substitui_matriz_id, publicada_em
  ) VALUES (
    p_nome, p_descricao, v_empresa_id, false, v_versao, p_matriz_id, now()
  ) RETURNING id INTO v_nova_matriz_id;

  INSERT INTO public.riscos_matriz_configuracao (
    matriz_id, escala_probabilidade, escala_impacto, niveis_risco,
    metodo_calculo, apetite_score
  ) VALUES (
    v_nova_matriz_id, p_escala_probabilidade, p_escala_impacto,
    p_niveis_risco, v_metodo, v_apetite
  );

  UPDATE public.riscos_matrizes SET ativa = false
   WHERE empresa_id = v_empresa_id AND ativa;
  UPDATE public.riscos_matrizes SET ativa = true WHERE id = v_nova_matriz_id;

  PERFORM public.riscos_recalcular_empresa(v_empresa_id);
  RETURN v_nova_matriz_id;
END;
$$;

-- ───────────────── tratamento + plano, numa só transação ─────────────────
ALTER TABLE public.planos_acao
  ADD COLUMN IF NOT EXISTS tratamento_risco_id uuid
    REFERENCES public.riscos_tratamentos(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS planos_acao_tratamento_risco_uidx
  ON public.planos_acao (tratamento_risco_id)
  WHERE tratamento_risco_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.salvar_tratamento_risco(
  p_risco_id uuid,
  p_tratamento_id uuid,
  p_tipo_tratamento text,
  p_descricao text,
  p_responsavel uuid,
  p_custo numeric,
  p_prazo date,
  p_data_inicio date,
  p_status text,
  p_eficacia text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_empresa_id uuid;
  v_nome_risco text;
  v_severidade text;
  v_tratamento_id uuid;
  v_prioridade text;
  v_status_plano text;
BEGIN
  IF COALESCE(btrim(p_tipo_tratamento), '') = '' OR COALESCE(btrim(p_descricao), '') = '' THEN
    RAISE EXCEPTION 'TIPO_E_DESCRICAO_OBRIGATORIOS';
  END IF;
  IF p_tipo_tratamento <> 'aceitar' AND (p_responsavel IS NULL OR p_prazo IS NULL) THEN
    RAISE EXCEPTION 'RESPONSAVEL_E_PRAZO_OBRIGATORIOS';
  END IF;
  IF NOT public.usuario_tem_permissao_modulo('riscos', CASE WHEN p_tratamento_id IS NULL THEN 'create' ELSE 'update' END) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  SELECT empresa_id, nome, severidade_efetiva
    INTO v_empresa_id, v_nome_risco, v_severidade
    FROM public.riscos
   WHERE id = p_risco_id
     AND empresa_id = public.get_user_empresa_id()
     AND arquivado_em IS NULL
   FOR UPDATE;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'RISCO_NAO_ENCONTRADO'; END IF;

  IF p_tratamento_id IS NULL THEN
    INSERT INTO public.riscos_tratamentos (
      risco_id, tipo_tratamento, descricao, responsavel, custo, prazo,
      data_inicio, status, eficacia
    ) VALUES (
      p_risco_id, p_tipo_tratamento, p_descricao, p_responsavel::text,
      p_custo, p_prazo, p_data_inicio, p_status, p_eficacia
    ) RETURNING id INTO v_tratamento_id;
  ELSE
    UPDATE public.riscos_tratamentos
       SET tipo_tratamento = p_tipo_tratamento,
           descricao = p_descricao,
           responsavel = p_responsavel::text,
           custo = p_custo,
           prazo = p_prazo,
           data_inicio = p_data_inicio,
           status = p_status,
           eficacia = p_eficacia
     WHERE id = p_tratamento_id AND risco_id = p_risco_id
     RETURNING id INTO v_tratamento_id;
    IF v_tratamento_id IS NULL THEN RAISE EXCEPTION 'TRATAMENTO_NAO_ENCONTRADO'; END IF;
  END IF;

  v_prioridade := CASE WHEN v_severidade IN ('critico', 'alto') THEN 'alta'
                       WHEN v_severidade = 'medio' THEN 'media' ELSE 'baixa' END;
  v_status_plano := CASE lower(translate(COALESCE(p_status, 'pendente'), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'))
    WHEN 'em andamento' THEN 'em_andamento'
    WHEN 'concluido' THEN 'concluido'
    WHEN 'cancelado' THEN 'cancelado'
    ELSE 'pendente' END;

  INSERT INTO public.planos_acao (
    empresa_id, titulo, descricao, modulo_origem, registro_origem_id,
    registro_origem_titulo, responsavel_id, prazo, prioridade, status,
    created_by, tratamento_risco_id
  ) VALUES (
    v_empresa_id, 'Tratar risco: ' || v_nome_risco, p_descricao, 'riscos', p_risco_id,
    v_nome_risco, p_responsavel, p_prazo, v_prioridade, v_status_plano,
    auth.uid(), v_tratamento_id
  ) ON CONFLICT (tratamento_risco_id) WHERE tratamento_risco_id IS NOT NULL
    DO UPDATE SET
      descricao = EXCLUDED.descricao,
      responsavel_id = EXCLUDED.responsavel_id,
      prazo = EXCLUDED.prazo,
      prioridade = EXCLUDED.prioridade,
      status = EXCLUDED.status,
      updated_at = now();

  RETURN v_tratamento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_tratamento_risco(uuid, uuid, text, text, uuid, numeric, date, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_tratamento_risco(uuid, uuid, text, text, uuid, numeric, date, date, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_risco_status_por_tratamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_risco_id uuid := COALESCE(NEW.risco_id, OLD.risco_id);
  v_requeridos integer;
  v_concluidos integer;
BEGIN
  SELECT count(*) FILTER (WHERE lower(translate(status, 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')) NOT IN ('cancelado', 'cancelada')),
         count(*) FILTER (WHERE lower(translate(status, 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')) IN ('concluido', 'concluida', 'finalizado', 'finalizada'))
    INTO v_requeridos, v_concluidos
    FROM public.riscos_tratamentos WHERE risco_id = v_risco_id;

  UPDATE public.riscos
     SET status = CASE
       WHEN v_requeridos > 0 AND v_requeridos = v_concluidos THEN 'tratado'
       WHEN v_requeridos > 0 THEN 'em_tratamento'
       WHEN status IN ('em_tratamento', 'tratado') THEN 'analisado'
       ELSE status END
   WHERE id = v_risco_id AND arquivado_em IS NULL;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_risco_status_por_tratamentos ON public.riscos_tratamentos;
CREATE TRIGGER trg_risco_status_por_tratamentos
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.riscos_tratamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_risco_status_por_tratamentos();

-- ───────────────────── permissão na fonte dos dados ─────────────────────
CREATE OR REPLACE FUNCTION public.usuario_tem_permissao_modulo(
  p_modulo text,
  p_acao text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE p.user_id = auth.uid()
       AND p.ativo
       AND (
         p.role::text = 'super_admin'
         OR EXISTS (
           SELECT 1
             FROM public.user_module_permissions ump
             JOIN public.system_modules sm ON sm.id = ump.module_id
            WHERE ump.user_id = p.user_id
              AND sm.name = p_modulo
              AND COALESCE(ump.can_access, false)
              AND CASE p_acao
                    WHEN 'create' THEN COALESCE(ump.can_create, false)
                    WHEN 'update' THEN COALESCE(ump.can_update, false)
                    WHEN 'delete' THEN COALESCE(ump.can_delete, false)
                    ELSE COALESCE(ump.can_read, false)
                  END
         )
       )
  );
$$;

REVOKE ALL ON FUNCTION public.usuario_tem_permissao_modulo(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuario_tem_permissao_modulo(text, text) TO authenticated;

DO $$
DECLARE
  v_table text;
  v_action text;
  v_cmd text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['riscos','riscos_tratamentos','riscos_ativos','controles_riscos'] LOOP
    FOREACH v_action IN ARRAY ARRAY['read','create','update','delete'] LOOP
      v_cmd := CASE v_action WHEN 'read' THEN 'SELECT' WHEN 'create' THEN 'INSERT'
                            WHEN 'update' THEN 'UPDATE' ELSE 'DELETE' END;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Permissão riscos ' || v_action, v_table);
      IF v_action = 'create' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated WITH CHECK (public.usuario_tem_permissao_modulo(''riscos'', %L))',
                       'Permissão riscos ' || v_action, v_table, v_cmd, v_action);
      ELSIF v_action = 'update' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING (public.usuario_tem_permissao_modulo(''riscos'', %L)) WITH CHECK (public.usuario_tem_permissao_modulo(''riscos'', %L))',
                       'Permissão riscos ' || v_action, v_table, v_cmd, v_action, v_action);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING (public.usuario_tem_permissao_modulo(''riscos'', %L))',
                       'Permissão riscos ' || v_action, v_table, v_cmd, v_action);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Sem política permissiva de DELETE, clientes autenticados não conseguem
-- apagar o registro-base. O caminho suportado é `arquivar_risco`.
DROP POLICY IF EXISTS "Users can delete risks from their empresa" ON public.riscos;

-- Categoria e matriz são configurações administrativas. Todos que podem ler o
-- módulo continuam a vê-las; somente administradores as alteram.
DO $$
DECLARE
  v_table text;
  v_action text;
  v_cmd text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['riscos_categorias','riscos_matrizes','riscos_matriz_configuracao'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Permissão configuração riscos leitura', v_table);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.usuario_tem_permissao_modulo(''riscos'', ''read''))',
                   'Permissão configuração riscos leitura', v_table);
    FOREACH v_action IN ARRAY ARRAY['create','update','delete'] LOOP
      v_cmd := CASE v_action WHEN 'create' THEN 'INSERT' WHEN 'update' THEN 'UPDATE' ELSE 'DELETE' END;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admin configuração riscos ' || v_action, v_table);
      IF v_action = 'create' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated WITH CHECK (public.is_admin_or_super_admin())',
                       'Admin configuração riscos ' || v_action, v_table, v_cmd);
      ELSIF v_action = 'update' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING (public.is_admin_or_super_admin()) WITH CHECK (public.is_admin_or_super_admin())',
                       'Admin configuração riscos ' || v_action, v_table, v_cmd);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING (public.is_admin_or_super_admin())',
                       'Admin configuração riscos ' || v_action, v_table, v_cmd);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Segregação: quem envia uma aprovação/aceite não pode escolher a si mesmo.
CREATE OR REPLACE FUNCTION public.tg_risco_segregar_aprovacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status_aprovacao = 'pendente_aprovacao'
     AND OLD.status_aprovacao IS DISTINCT FROM NEW.status_aprovacao
     AND NEW.aprovador_id = auth.uid() THEN
    RAISE EXCEPTION 'APROVACAO_PELO_PROPRIO_SOLICITANTE';
  END IF;
  IF NEW.status_aceite = 'pendente'
     AND OLD.status_aceite IS DISTINCT FROM NEW.status_aceite
     AND NEW.aprovador_aceite = auth.uid() THEN
    RAISE EXCEPTION 'ACEITE_PELO_PROPRIO_SOLICITANTE';
  END IF;
  IF NEW.status_aceite = 'aprovado' AND OLD.status_aceite IS DISTINCT FROM NEW.status_aceite THEN
    NEW.status := 'monitorado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_risco_segregar_aprovacao ON public.riscos;
CREATE TRIGGER trg_risco_segregar_aprovacao
  BEFORE UPDATE OF status_aprovacao, status_aceite ON public.riscos
  FOR EACH ROW EXECUTE FUNCTION public.tg_risco_segregar_aprovacao();

-- Garante o job mesmo em ambientes onde a migração original rodou antes da
-- extensão pg_cron estar disponível. A função continua fechada ao cliente.
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expirar-aceites-riscos-diario') THEN
    PERFORM cron.schedule(
      'expirar-aceites-riscos-diario',
      '0 4 * * *',
      'SELECT public.expirar_aceites_riscos();'
    );
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.expirar_aceites_riscos() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.expirar_aceites_riscos() TO service_role;
