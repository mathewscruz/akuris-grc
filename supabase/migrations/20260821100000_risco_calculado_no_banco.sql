-- O risco passa a ser calculado, e não digitado.
--
-- O módulo guardava o RESULTADO do cálculo como texto livre
-- (`nivel_risco_inicial text`, sem CHECK), e as entradas do cálculo também
-- (`probabilidade_inicial text`, com "3" e "possivel" na mesma coluna). Não
-- havia score em lado nenhum. Consequências medidas na base local:
--
--   * 7 dos 84 riscos tinham nível gravado diferente do que a matriz da
--     própria empresa calcula hoje (`possivel × catastrofico` = 15 cai em
--     "Alto (10–16)" e estava gravado "critico");
--   * o cartão da aba Matriz dizia "2 Críticos" e o mapa de calor, ao lado,
--     mostrava um único risco em célula crítica — o mesmo risco tinha duas
--     severidades no mesmo ecrã;
--   * o filtro "Nível = Alto" devolvia zero linhas numa tabela com seis
--     badges "Alto", porque comparava o texto cru com um rótulo fixo;
--   * empresas que renomearam as faixas (Fast2Mine: Baixo/Moderado/Elevado/
--     Extremo) perdiam a cor do badge e o limite de apetite, em silêncio.
--
-- A causa é sempre a mesma: sem um número canónico, cada ecrã inventou a sua
-- própria regra para responder "qual é a severidade disto?". Havia oito.
--
-- Esta migration põe a regra num sítio só — o banco — e faz o nível deixar de
-- ser entrada para passar a ser saída:
--
--   probabilidade + impacto (smallint)  →  score  →  faixa  →  nível + severidade
--
-- `nivel_risco_*` continua a existir (relatórios e PDFs lêem-no) mas ninguém
-- fora do trigger volta a escrevê-lo. Junta-se-lhe `severidade_*`, a chave
-- canónica derivada da POSIÇÃO da faixa — para que contar, filtrar e colorir
-- funcione igual em quem chama "Crítico" e em quem chama "Extremo".

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Matriz vigente: uma por empresa
-- ══════════════════════════════════════════════════════════════════════════
--
-- `riscos_matrizes` era uma lista de N matrizes sem nenhuma marcada como a da
-- empresa. Cada risco apontava para a sua (`matriz_id`), mas todos os ecrãs de
-- agregação liam `.limit(1)` da primeira que aparecesse — ou seja, a carteira
-- inteira era lida com as faixas de uma matriz escolhida por acaso.

ALTER TABLE public.riscos_matrizes
  ADD COLUMN IF NOT EXISTS ativa boolean NOT NULL DEFAULT false;

-- A matriz com configuração é a que o produto já usava de facto; na dúvida, a
-- mais antiga. Idempotente: só actua em empresas que ainda não têm vigente.
UPDATE public.riscos_matrizes m
   SET ativa = true
 WHERE NOT EXISTS (
         SELECT 1 FROM public.riscos_matrizes o
          WHERE o.empresa_id = m.empresa_id AND o.ativa
       )
   AND m.id = (
         SELECT o.id
           FROM public.riscos_matrizes o
           LEFT JOIN public.riscos_matriz_configuracao c ON c.matriz_id = o.id
          WHERE o.empresa_id = m.empresa_id
          ORDER BY (c.id IS NOT NULL) DESC, o.created_at ASC
          LIMIT 1
       );

CREATE UNIQUE INDEX IF NOT EXISTS riscos_matrizes_uma_ativa_por_empresa
  ON public.riscos_matrizes (empresa_id) WHERE ativa;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Apetite deixa de ser uma flag escondida dentro do JSON
-- ══════════════════════════════════════════════════════════════════════════
--
-- O limite de apetite vivia como `"apetite": true` num dos objectos de
-- `niveis_risco`. Quando nenhuma faixa o trazia, o código procurava uma
-- chamada "médio" — e devolvia NULL para quem tivesse renomeado as faixas.
-- Duas empresas da base estavam exactamente nesse estado.

ALTER TABLE public.riscos_matriz_configuracao
  ADD COLUMN IF NOT EXISTS apetite_score smallint;

UPDATE public.riscos_matriz_configuracao c
   SET apetite_score = COALESCE(
     -- 1) faixa explicitamente marcada
     (SELECT (n->>'max')::smallint
        FROM jsonb_array_elements(c.niveis_risco) n
       WHERE (n->>'apetite')::boolean IS TRUE
       ORDER BY (n->>'min')::int LIMIT 1),
     -- 2) faixa cujo rótulo é "médio"/"moderado" (o fallback antigo do código)
     (SELECT (n->>'max')::smallint
        FROM jsonb_array_elements(c.niveis_risco) n
       WHERE lower(translate(n->>'nivel', 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'))
             IN ('medio', 'media', 'moderado', 'moderada')
       ORDER BY (n->>'min')::int LIMIT 1),
     -- 3) segunda faixa a contar de baixo — a intenção original do fallback
     (SELECT (n->>'max')::smallint
        FROM jsonb_array_elements(c.niveis_risco) n
       ORDER BY (n->>'min')::int OFFSET 1 LIMIT 1),
     -- 4) matriz de faixa única
     (SELECT (n->>'max')::smallint
        FROM jsonb_array_elements(c.niveis_risco) n
       ORDER BY (n->>'min')::int LIMIT 1)
   )
 WHERE c.apetite_score IS NULL;

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Probabilidade e impacto passam a ser números
-- ══════════════════════════════════════════════════════════════════════════
--
-- Riscos antigos gravaram texto ("possivel", "catastrofico") e os novos
-- gravam "3"/"5". O mapa abaixo é o mesmo `SCALE_MAP` que o front-end usava
-- para conseguir ler as duas gerações — deixa de ser preciso depois disto.

CREATE OR REPLACE FUNCTION public.risco_escala_numero(p_valor text)
RETURNS smallint
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_valor IS NULL OR btrim(p_valor) = '' THEN NULL
    WHEN btrim(p_valor) ~ '^[0-9]+$' THEN LEAST(GREATEST(btrim(p_valor)::int, 0), 32767)::smallint
    ELSE (
      SELECT v FROM (VALUES
        ('raro', 1), ('muito_raro', 1), ('muito raro', 1),
        ('improvavel', 2),
        ('possivel', 3), ('ocasional', 3),
        ('provavel', 4),
        ('quase_certo', 5), ('quase certo', 5), ('muito_provavel', 5), ('muito provavel', 5),
        ('insignificante', 1),
        ('menor', 2),
        ('moderado', 3), ('medio', 3),
        ('maior', 4),
        ('catastrofico', 5)
      ) AS m(k, v)
      WHERE m.k = lower(translate(btrim(p_valor), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'))
    )
  END::smallint;
$$;

COMMENT ON FUNCTION public.risco_escala_numero(text) IS
  'Normaliza um valor legado de probabilidade/impacto ("possivel", "maior") ou numérico ("3") para a escala 1..N. NULL quando não reconhece.';

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'riscos'
         AND column_name = 'probabilidade_inicial') <> 'smallint' THEN

    ALTER TABLE public.riscos ALTER COLUMN nivel_risco_inicial DROP NOT NULL;

    ALTER TABLE public.riscos
      ALTER COLUMN probabilidade_inicial  TYPE smallint USING public.risco_escala_numero(probabilidade_inicial),
      ALTER COLUMN impacto_inicial        TYPE smallint USING public.risco_escala_numero(impacto_inicial),
      ALTER COLUMN probabilidade_residual TYPE smallint USING public.risco_escala_numero(probabilidade_residual),
      ALTER COLUMN impacto_residual       TYPE smallint USING public.risco_escala_numero(impacto_residual);
  END IF;
END $$;

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'riscos_historico_avaliacoes'
         AND column_name = 'probabilidade') <> 'smallint' THEN
    ALTER TABLE public.riscos_historico_avaliacoes
      ALTER COLUMN probabilidade TYPE smallint USING public.risco_escala_numero(probabilidade),
      ALTER COLUMN impacto       TYPE smallint USING public.risco_escala_numero(impacto);
  END IF;
END $$;

-- Sanidade: a escala é configurável, mas nenhuma escala real passa de 20.
ALTER TABLE public.riscos DROP CONSTRAINT IF EXISTS riscos_escala_valida;
ALTER TABLE public.riscos ADD CONSTRAINT riscos_escala_valida CHECK (
  (probabilidade_inicial  IS NULL OR probabilidade_inicial  BETWEEN 1 AND 20) AND
  (impacto_inicial        IS NULL OR impacto_inicial        BETWEEN 1 AND 20) AND
  (probabilidade_residual IS NULL OR probabilidade_residual BETWEEN 1 AND 20) AND
  (impacto_residual       IS NULL OR impacto_residual       BETWEEN 1 AND 20)
);

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Colunas derivadas: score e severidade canónica
-- ══════════════════════════════════════════════════════════════════════════
--
-- `severidade_*` é a chave canónica ('baixo'|'medio'|'alto'|'critico') tirada
-- da POSIÇÃO da faixa, não do rótulo. É o que contagens, filtros e cores
-- passam a consumir — assim "Extremo" da Fast2Mine conta como crítico sem
-- ninguém ter de conhecer a palavra.

ALTER TABLE public.riscos
  ADD COLUMN IF NOT EXISTS score_inicial      smallint,
  ADD COLUMN IF NOT EXISTS score_residual     smallint,
  ADD COLUMN IF NOT EXISTS severidade_inicial  text,
  ADD COLUMN IF NOT EXISTS severidade_residual text;

ALTER TABLE public.riscos DROP CONSTRAINT IF EXISTS riscos_severidade_canonica;
ALTER TABLE public.riscos ADD CONSTRAINT riscos_severidade_canonica CHECK (
  (severidade_inicial  IS NULL OR severidade_inicial  IN ('baixo','medio','alto','critico')) AND
  (severidade_residual IS NULL OR severidade_residual IN ('baixo','medio','alto','critico'))
);

ALTER TABLE public.riscos_historico_avaliacoes
  ADD COLUMN IF NOT EXISTS score      smallint,
  ADD COLUMN IF NOT EXISTS severidade text;

-- `score_efetivo`/`severidade_efetiva`: residual quando existe, senão inerente.
-- Era uma expressão `residual || inicial` repetida em dezassete sítios, e
-- metade deles esquecia-a. Passa a ser coluna gerada — impossível divergir.
ALTER TABLE public.riscos
  DROP COLUMN IF EXISTS score_efetivo,
  DROP COLUMN IF EXISTS severidade_efetiva;

ALTER TABLE public.riscos
  ADD COLUMN score_efetivo smallint
    GENERATED ALWAYS AS (COALESCE(score_residual, score_inicial)) STORED,
  ADD COLUMN severidade_efetiva text
    GENERATED ALWAYS AS (COALESCE(severidade_residual, severidade_inicial)) STORED;

CREATE INDEX IF NOT EXISTS riscos_severidade_efetiva_idx
  ON public.riscos (empresa_id, severidade_efetiva);
CREATE INDEX IF NOT EXISTS riscos_score_efetivo_idx
  ON public.riscos (empresa_id, score_efetivo);

-- ══════════════════════════════════════════════════════════════════════════
-- 5. A regra do cálculo, num sítio só
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.risco_matriz_vigente(p_empresa_id uuid)
RETURNS TABLE (
  matriz_id uuid,
  niveis_risco jsonb,
  escala_probabilidade jsonb,
  escala_impacto jsonb,
  metodo_calculo text,
  apetite_score smallint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, c.niveis_risco, c.escala_probabilidade, c.escala_impacto,
         COALESCE(NULLIF(c.metodo_calculo, ''), 'multiplicacao'), c.apetite_score
    FROM public.riscos_matrizes m
    JOIN public.riscos_matriz_configuracao c ON c.matriz_id = m.id
   WHERE m.empresa_id = p_empresa_id AND m.ativa
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.risco_matriz_vigente(uuid) IS
  'Matriz de risco vigente da empresa (a única com ativa = true) e a sua configuração.';

-- Severidade canónica pela posição da faixa. Réplica exacta da regra que o
-- front-end já usava em `severidadeDeFaixas` — deliberadamente a MESMA
-- aritmética, para que não nasça aqui uma nona interpretação.
CREATE OR REPLACE FUNCTION public.risco_severidade_da_faixa(
  p_niveis jsonb,
  p_nivel text
)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_total int;
  v_idx int;
  v_pos numeric;
BEGIN
  IF p_niveis IS NULL OR p_nivel IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_total FROM jsonb_array_elements(p_niveis);
  IF v_total = 0 THEN RETURN NULL; END IF;

  SELECT ordinalidade - 1 INTO v_idx
    FROM (
      SELECT n->>'nivel' AS nivel,
             row_number() OVER (ORDER BY (n->>'min')::int) AS ordinalidade
        FROM jsonb_array_elements(p_niveis) n
    ) faixas
   WHERE lower(translate(faixas.nivel, 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'))
       = lower(translate(p_nivel,      'áàâãéêíóôõúüç', 'aaaaeeiooouuc'));

  IF v_idx IS NULL THEN RETURN NULL; END IF;

  v_pos := v_idx::numeric / GREATEST(v_total - 1, 1);
  IF v_pos >= 0.99 THEN RETURN 'critico'; END IF;
  IF v_pos >= 0.66 THEN RETURN 'alto';    END IF;
  IF v_pos >= 0.33 THEN RETURN 'medio';   END IF;
  RETURN 'baixo';
END $$;

-- O cálculo. Devolve as três saídas de uma vez para que nunca sejam obtidas
-- por caminhos diferentes.
CREATE OR REPLACE FUNCTION public.risco_avaliar(
  p_empresa_id uuid,
  p_probabilidade smallint,
  p_impacto smallint
)
RETURNS TABLE (score smallint, nivel text, severidade text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_matriz record;
  v_score int;
  v_nivel text;
BEGIN
  IF p_probabilidade IS NULL OR p_impacto IS NULL THEN
    RETURN QUERY SELECT NULL::smallint, NULL::text, NULL::text; RETURN;
  END IF;

  SELECT * INTO v_matriz FROM public.risco_matriz_vigente(p_empresa_id);
  IF v_matriz.matriz_id IS NULL THEN
    RETURN QUERY SELECT NULL::smallint, NULL::text, NULL::text; RETURN;
  END IF;

  v_score := CASE WHEN v_matriz.metodo_calculo = 'soma'
                  THEN p_probabilidade + p_impacto
                  ELSE p_probabilidade * p_impacto END;

  -- Sem faixa correspondente o nível fica NULL, e não um valor inventado:
  -- é o sinal de que a escala e as faixas da matriz não se cobrem.
  SELECT n->>'nivel' INTO v_nivel
    FROM jsonb_array_elements(v_matriz.niveis_risco) n
   WHERE v_score BETWEEN (n->>'min')::int AND (n->>'max')::int
   ORDER BY (n->>'min')::int
   LIMIT 1;

  RETURN QUERY SELECT
    v_score::smallint,
    v_nivel,
    public.risco_severidade_da_faixa(v_matriz.niveis_risco, v_nivel);
END $$;

COMMENT ON FUNCTION public.risco_avaliar(uuid, smallint, smallint) IS
  'Fonte única do cálculo de risco: probabilidade × impacto (ou soma) → score, nível e severidade canónica, pela matriz vigente da empresa.';

-- ══════════════════════════════════════════════════════════════════════════
-- 6. O trigger que torna o nível impossível de divergir
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.tg_risco_calcular()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ini record;
  v_res record;
BEGIN
  SELECT * INTO v_ini FROM public.risco_avaliar(NEW.empresa_id, NEW.probabilidade_inicial, NEW.impacto_inicial);
  SELECT * INTO v_res FROM public.risco_avaliar(NEW.empresa_id, NEW.probabilidade_residual, NEW.impacto_residual);

  NEW.score_inicial       := v_ini.score;
  NEW.nivel_risco_inicial := v_ini.nivel;
  NEW.severidade_inicial  := v_ini.severidade;

  NEW.score_residual       := v_res.score;
  NEW.nivel_risco_residual := v_res.nivel;
  NEW.severidade_residual  := v_res.severidade;

  -- O risco fica sempre preso à matriz vigente da empresa. Antes era um campo
  -- obrigatório no formulário, com uma única opção para escolher.
  SELECT matriz_id INTO NEW.matriz_id FROM public.risco_matriz_vigente(NEW.empresa_id);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_risco_calcular ON public.riscos;
CREATE TRIGGER trg_risco_calcular
  BEFORE INSERT OR UPDATE OF probabilidade_inicial, impacto_inicial,
                             probabilidade_residual, impacto_residual, empresa_id
  ON public.riscos
  FOR EACH ROW EXECUTE FUNCTION public.tg_risco_calcular();

CREATE OR REPLACE FUNCTION public.tg_risco_historico_calcular()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v record;
BEGIN
  SELECT * INTO v FROM public.risco_avaliar(NEW.empresa_id, NEW.probabilidade, NEW.impacto);
  NEW.score       := v.score;
  NEW.nivel_risco := COALESCE(v.nivel, NEW.nivel_risco);
  NEW.severidade  := v.severidade;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_risco_historico_calcular ON public.riscos_historico_avaliacoes;
CREATE TRIGGER trg_risco_historico_calcular
  BEFORE INSERT ON public.riscos_historico_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_risco_historico_calcular();

-- ══════════════════════════════════════════════════════════════════════════
-- 7. Mudar a matriz reclassifica a carteira
-- ══════════════════════════════════════════════════════════════════════════
--
-- O rodapé do formulário de configuração dizia "Alterações afetam novos
-- cálculos de risco" — uma admissão de que os riscos já registados ficavam
-- com o rótulo antigo para sempre. Passam a ser recalculados.

CREATE OR REPLACE FUNCTION public.riscos_recalcular_empresa(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_linhas integer;
BEGIN
  -- `UPDATE ... FROM LATERAL` não pode referenciar a tabela a actualizar, daí
  -- a subconsulta: o LATERAL avalia sobre uma leitura separada e o UPDATE liga
  -- pelo id.
  UPDATE public.riscos r
     SET score_inicial       = a.score,
         nivel_risco_inicial = a.nivel,
         severidade_inicial  = a.severidade
    FROM (
      SELECT x.id, av.score, av.nivel, av.severidade
        FROM public.riscos x
        CROSS JOIN LATERAL public.risco_avaliar(x.empresa_id, x.probabilidade_inicial, x.impacto_inicial) av
       WHERE x.empresa_id = p_empresa_id
    ) a
   WHERE r.id = a.id
     AND (r.score_inicial IS DISTINCT FROM a.score
       OR r.nivel_risco_inicial IS DISTINCT FROM a.nivel
       OR r.severidade_inicial IS DISTINCT FROM a.severidade);
  GET DIAGNOSTICS v_linhas = ROW_COUNT;

  UPDATE public.riscos r
     SET score_residual       = a.score,
         nivel_risco_residual = a.nivel,
         severidade_residual  = a.severidade
    FROM (
      SELECT x.id, av.score, av.nivel, av.severidade
        FROM public.riscos x
        CROSS JOIN LATERAL public.risco_avaliar(x.empresa_id, x.probabilidade_residual, x.impacto_residual) av
       WHERE x.empresa_id = p_empresa_id
    ) a
   WHERE r.id = a.id
     AND (r.score_residual IS DISTINCT FROM a.score
       OR r.nivel_risco_residual IS DISTINCT FROM a.nivel
       OR r.severidade_residual IS DISTINCT FROM a.severidade);

  UPDATE public.riscos_historico_avaliacoes h
     SET score = a.score, severidade = a.severidade
    FROM (
      SELECT x.id, av.score, av.severidade
        FROM public.riscos_historico_avaliacoes x
        CROSS JOIN LATERAL public.risco_avaliar(x.empresa_id, x.probabilidade, x.impacto) av
       WHERE x.empresa_id = p_empresa_id
    ) a
   WHERE h.id = a.id
     AND (h.score IS DISTINCT FROM a.score OR h.severidade IS DISTINCT FROM a.severidade);

  RETURN v_linhas;
END $$;

COMMENT ON FUNCTION public.riscos_recalcular_empresa(uuid) IS
  'Reclassifica toda a carteira de risco da empresa pela matriz vigente. Chamada pelo trigger de alteração da matriz e disponível como RPC.';

-- Quantos riscos mudam de nível se a matriz passar a ser X — para a
-- pré-visualização mostrada antes de gravar, em vez de um aviso genérico.
CREATE OR REPLACE FUNCTION public.riscos_previsao_reclassificacao(
  p_niveis_risco jsonb,
  p_metodo_calculo text DEFAULT 'multiplicacao'
)
RETURNS TABLE (risco_id uuid, codigo text, nome text, nivel_atual text, nivel_novo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.get_user_empresa_id();
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'EMPRESA_NAO_ENCONTRADA'; END IF;

  RETURN QUERY
  WITH avaliado AS (
    SELECT r.id, r.codigo, r.nome, r.nivel_risco_inicial AS atual,
           CASE WHEN p_metodo_calculo = 'soma'
                THEN r.probabilidade_inicial + r.impacto_inicial
                ELSE r.probabilidade_inicial * r.impacto_inicial END AS score
      FROM public.riscos r
     WHERE r.empresa_id = v_empresa_id
       AND r.probabilidade_inicial IS NOT NULL AND r.impacto_inicial IS NOT NULL
  )
  SELECT a.id, a.codigo, a.nome, a.atual, novo.nivel
    FROM avaliado a
    LEFT JOIN LATERAL (
      SELECT n->>'nivel' AS nivel
        FROM jsonb_array_elements(p_niveis_risco) n
       WHERE a.score BETWEEN (n->>'min')::int AND (n->>'max')::int
       ORDER BY (n->>'min')::int LIMIT 1
    ) novo ON true
   WHERE a.atual IS DISTINCT FROM novo.nivel;
END $$;

CREATE OR REPLACE FUNCTION public.tg_matriz_config_recalcular()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
    FROM public.riscos_matrizes WHERE id = NEW.matriz_id AND ativa;
  IF v_empresa_id IS NOT NULL THEN
    PERFORM public.riscos_recalcular_empresa(v_empresa_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_matriz_config_recalcular ON public.riscos_matriz_configuracao;
CREATE TRIGGER trg_matriz_config_recalcular
  AFTER INSERT OR UPDATE OF niveis_risco, metodo_calculo, escala_probabilidade, escala_impacto
  ON public.riscos_matriz_configuracao
  FOR EACH ROW EXECUTE FUNCTION public.tg_matriz_config_recalcular();

-- Reclassificar não é "alguém mexeu no risco".
--
-- `update_riscos_updated_at` carimba `updated_at` em qualquer UPDATE, e a
-- coluna "Atualizado" da tabela lê-se como actividade humana. Sem esta
-- excepção, recalcular a carteira punha os 84 riscos como editados "hoje".
-- A trilha de auditoria continua a registar a reclassificação — que é
-- precisamente onde essa informação deve estar.
CREATE OR REPLACE FUNCTION public.update_riscos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_derivadas text[] := ARRAY[
    'score_inicial','score_residual','score_efetivo',
    'severidade_inicial','severidade_residual','severidade_efetiva',
    'nivel_risco_inicial','nivel_risco_residual','updated_at'
  ];
  v_mudou_algo_real boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT EXISTS (
      SELECT 1 FROM jsonb_each(to_jsonb(NEW)) n(key, value)
       WHERE n.value IS DISTINCT FROM to_jsonb(OLD)->n.key
         AND NOT (n.key = ANY (v_derivadas))
    ) INTO v_mudou_algo_real;

    IF NOT v_mudou_algo_real THEN
      NEW.updated_at = OLD.updated_at;
      RETURN NEW;
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 8. Backfill
-- ══════════════════════════════════════════════════════════════════════════

SELECT public.riscos_recalcular_empresa(e.id) FROM public.empresas e;

-- ══════════════════════════════════════════════════════════════════════════
-- 9. Gravar a matriz: apetite, activação e faixas que cobrem a escala
-- ══════════════════════════════════════════════════════════════════════════
--
-- A armadilha do método "Soma": mudando para P + I, o resultado máximo de uma
-- escala 5×5 passa a ser 10, mas as faixas continuavam 1–4 / 5–9 / 10–16 /
-- 17–25. "Crítico" tornava-se inatingível e "acima do apetite" ficava preso em
-- zero — sem um único aviso no ecrã. A RPC passa a recusar.

-- A assinatura ganha `p_apetite_score`. Sem largar a antiga, as duas ficam
-- visíveis e a chamada passa a ser ambígua ("could not choose a best
-- candidate") — o PostgREST devolveria 300 em vez de gravar.
DROP FUNCTION IF EXISTS public.criar_matriz_com_configuracao(text, text, jsonb, jsonb, jsonb, text, uuid);

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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_matriz_id uuid;
  v_metodo text;
  v_p_max int;
  v_i_max int;
  v_score_min int;
  v_score_max int;
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

  -- O conjunto REAL de resultados possíveis, e não o intervalo entre o menor e
  -- o maior. Numa 5×5 multiplicativa não existe nenhum score entre 17 e 19:
  -- validar por intervalo deixaria passar faixas que nunca acontecem.
  CREATE TEMP TABLE IF NOT EXISTS _scores_possiveis (s int) ON COMMIT DROP;
  DELETE FROM _scores_possiveis;
  INSERT INTO _scores_possiveis
  SELECT DISTINCT CASE WHEN v_metodo = 'soma' THEN p.n + i.n ELSE p.n * i.n END
    FROM generate_series(1, v_p_max) p(n), generate_series(1, v_i_max) i(n);

  -- (a) todo resultado possível tem de cair numa faixa
  SELECT min(s), max(s) INTO v_score_min, v_score_max FROM _scores_possiveis;
  IF EXISTS (
    SELECT 1 FROM _scores_possiveis s
     WHERE NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_niveis_risco) n
        WHERE s.s BETWEEN (n->>'min')::int AND (n->>'max')::int)
  ) THEN
    RAISE EXCEPTION 'FAIXAS_NAO_COBREM_ESCALA: % a %', v_score_min, v_score_max;
  END IF;

  -- (b) toda faixa declarada tem de ser atingível
  --
  -- Esta é a armadilha do método "Soma": trocar P × I por P + I baixa o
  -- resultado máximo de uma 5×5 de 25 para 10, e as faixas continuavam
  -- 1–4 / 5–9 / 10–16 / 17–25. "Crítico" passava a ser impossível e "acima do
  -- apetite" ficava permanentemente em zero, sem aviso nenhum no ecrã.
  SELECT string_agg(n->>'nivel', ', ' ORDER BY (n->>'min')::int)
    INTO v_inalcancaveis
    FROM jsonb_array_elements(p_niveis_risco) n
   WHERE NOT EXISTS (
     SELECT 1 FROM _scores_possiveis s
      WHERE s.s BETWEEN (n->>'min')::int AND (n->>'max')::int);

  IF v_inalcancaveis IS NOT NULL THEN
    RAISE EXCEPTION 'FAIXA_INALCANCAVEL: % (resultados possíveis: % a %)',
      v_inalcancaveis, v_score_min, v_score_max;
  END IF;

  v_apetite := COALESCE(
    p_apetite_score,
    (SELECT (n->>'max')::smallint FROM jsonb_array_elements(p_niveis_risco) n
      WHERE (n->>'apetite')::boolean IS TRUE ORDER BY (n->>'min')::int LIMIT 1),
    (SELECT (n->>'max')::smallint FROM jsonb_array_elements(p_niveis_risco) n
      ORDER BY (n->>'min')::int OFFSET 1 LIMIT 1)
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

  -- Uma vigente por empresa: gravar uma matriz é adoptá-la.
  UPDATE public.riscos_matrizes SET ativa = false
   WHERE empresa_id = v_empresa_id AND ativa AND id <> v_matriz_id;
  UPDATE public.riscos_matrizes SET ativa = true WHERE id = v_matriz_id;

  INSERT INTO public.riscos_matriz_configuracao (
    matriz_id, escala_probabilidade, escala_impacto, niveis_risco, metodo_calculo, apetite_score
  ) VALUES (
    v_matriz_id, p_escala_probabilidade, p_escala_impacto, p_niveis_risco, v_metodo, v_apetite
  )
  ON CONFLICT (matriz_id) DO UPDATE SET
    escala_probabilidade = EXCLUDED.escala_probabilidade,
    escala_impacto       = EXCLUDED.escala_impacto,
    niveis_risco         = EXCLUDED.niveis_risco,
    metodo_calculo       = EXCLUDED.metodo_calculo,
    apetite_score        = EXCLUDED.apetite_score,
    updated_at           = now();

  PERFORM public.riscos_recalcular_empresa(v_empresa_id);
  RETURN v_matriz_id;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 10. Superfície exposta ao cliente
-- ══════════════════════════════════════════════════════════════════════════
--
-- `risco_avaliar`, `risco_matriz_vigente` e `riscos_recalcular_empresa` são
-- SECURITY DEFINER e recebem `empresa_id` — chamáveis pelo cliente, seriam uma
-- porta para ler e reclassificar a carteira de outro tenant. Ficam internas
-- (triggers e migrations). O que o cliente pode chamar resolve a empresa a
-- partir do próprio perfil, nunca de um argumento.

REVOKE ALL ON FUNCTION public.risco_matriz_vigente(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.risco_avaliar(uuid, smallint, smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.riscos_recalcular_empresa(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.riscos_recalcular()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.get_user_empresa_id();
BEGIN
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'EMPRESA_NAO_ENCONTRADA'; END IF;
  RETURN public.riscos_recalcular_empresa(v_empresa_id);
END $$;

COMMENT ON FUNCTION public.riscos_recalcular() IS
  'Reclassifica a carteira da empresa do utilizador autenticado. Versão segura de riscos_recalcular_empresa — a empresa vem do perfil, não de um argumento.';

GRANT EXECUTE ON FUNCTION public.riscos_recalcular() TO authenticated;
GRANT EXECUTE ON FUNCTION public.riscos_previsao_reclassificacao(jsonb, text) TO authenticated;
