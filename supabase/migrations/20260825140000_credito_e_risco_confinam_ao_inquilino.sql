-- Créditos de IA e recálculo de risco deixam de aceitar `empresa_id` alheio.
--
-- ## O ataque, provado
--
-- `consume_ai_credit(p_empresa_id, p_user_id, ...)` é `SECURITY DEFINER`,
-- chamável por qualquer autenticado, e escreve em `empresas` e em
-- `creditos_consumo` filtrando só pelo `p_empresa_id` que recebe. Nada verifica
-- que quem chama pertence a essa empresa.
--
-- Provado por impersonação com um utilizador REAL da empresa B: o contador de
-- créditos da empresa A subiu de 65 para 66. Repetido em ciclo, esgota a
-- franquia de IA de outra empresa — negação de serviço a custo do vizinho — e
-- suja o histórico de consumo com registos que a vítima não fez.
--
-- Mesmo padrão em `consume_ai_credit_idempotente`, `estornar_ai_credit` (que
-- devolveria créditos numa empresa alheia) e `riscos_recalcular_empresa`, que
-- faz `UPDATE` nos `riscos` de qualquer empresa passada por parâmetro.
--
-- ## A correcção
--
-- Uma guarda comum, `exige_empresa_da_sessao`, RAISE se o `p_empresa_id` não
-- for o da sessão (super_admin passa). E o `p_user_id` do consumo deixa de ser
-- aceite do parâmetro — é sempre `auth.uid()`. Atribuir consumo a outra pessoa
-- é adulteração, mesmo dentro da própria empresa.
--
-- As assinaturas ficam iguais, e o front-end passa sempre o empresa_id e o
-- user_id do próprio utilizador — por isso nada muda para o uso legítimo.

/*
  Recusa qualquer operação cujo alvo não seja a empresa da sessão.

  RAISE, e não devolver NULL: estas funções ESCREVEM. Uma escrita silenciosa no
  sítio errado é pior do que um erro — o atacante nem sabe que falhou, e a
  vítima nem sabe que foi tentada.
*/
CREATE OR REPLACE FUNCTION public.exige_empresa_da_sessao(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.is_super_admin() THEN
    RETURN;
  END IF;
  IF p_empresa_id IS DISTINCT FROM public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'acesso negado: operação restrita à empresa da sessão'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.exige_empresa_da_sessao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exige_empresa_da_sessao(uuid) TO authenticated;

-- ───────────────────── consume_ai_credit ─────────────────────
CREATE OR REPLACE FUNCTION public.consume_ai_credit(p_empresa_id uuid, p_user_id uuid, p_funcionalidade text, p_descricao text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_franquia integer;
  v_consumidos integer;
BEGIN
  PERFORM public.exige_empresa_da_sessao(p_empresa_id);

  SELECT p.creditos_franquia, e.creditos_consumidos
  INTO v_franquia, v_consumidos
  FROM empresas e
  LEFT JOIN planos p ON e.plano_id = p.id
  WHERE e.id = p_empresa_id;

  IF v_franquia IS NULL OR v_consumidos >= v_franquia THEN
    RETURN false;
  END IF;

  /* Quem consome é quem chama, nunca o `p_user_id` do parâmetro: atribuir o
     consumo a outra pessoa é adulterar o histórico. */
  INSERT INTO creditos_consumo (empresa_id, user_id, funcionalidade, descricao)
  VALUES (p_empresa_id, COALESCE(auth.uid(), p_user_id), p_funcionalidade, p_descricao);

  UPDATE empresas SET creditos_consumidos = creditos_consumidos + 1
  WHERE id = p_empresa_id;

  RETURN true;
END;
$function$;

-- ────────────────── consume_ai_credit_idempotente ──────────────────
CREATE OR REPLACE FUNCTION public.consume_ai_credit_idempotente(p_empresa_id uuid, p_user_id uuid, p_funcionalidade text, p_idempotency_key text, p_descricao text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_franquia integer;
  v_consumidos integer;
  v_existing public.creditos_consumo%ROWTYPE;
  v_user uuid;
BEGIN
  PERFORM public.exige_empresa_da_sessao(p_empresa_id);
  v_user := COALESCE(auth.uid(), p_user_id);

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('charged', false, 'reason', 'MISSING_IDEMPOTENCY_KEY');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_empresa_id::text || ':' || p_idempotency_key));

  SELECT * INTO v_existing
  FROM public.creditos_consumo
  WHERE empresa_id = p_empresa_id AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND AND v_existing.estornado = false THEN
    RETURN jsonb_build_object('charged', true, 'duplicate', true);
  END IF;

  SELECT p.creditos_franquia, e.creditos_consumidos
  INTO v_franquia, v_consumidos
  FROM public.empresas e
  LEFT JOIN public.planos p ON e.plano_id = p.id
  WHERE e.id = p_empresa_id
  FOR UPDATE OF e;

  IF v_franquia IS NULL OR v_consumidos >= v_franquia THEN
    RETURN jsonb_build_object('charged', false, 'reason', 'CREDITS_EXHAUSTED');
  END IF;

  IF FOUND AND v_existing.id IS NOT NULL THEN
    UPDATE public.creditos_consumo
    SET estornado = false, estornado_em = NULL, user_id = v_user,
        funcionalidade = p_funcionalidade, descricao = p_descricao
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.creditos_consumo (empresa_id, user_id, funcionalidade, descricao, idempotency_key)
    VALUES (p_empresa_id, v_user, p_funcionalidade, p_descricao, p_idempotency_key);
  END IF;

  UPDATE public.empresas SET creditos_consumidos = creditos_consumidos + 1
  WHERE id = p_empresa_id;

  RETURN jsonb_build_object('charged', true, 'duplicate', false);
END;
$function$;

-- ───────────────────── estornar_ai_credit ─────────────────────
CREATE OR REPLACE FUNCTION public.estornar_ai_credit(p_empresa_id uuid, p_idempotency_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.exige_empresa_da_sessao(p_empresa_id);
  IF p_idempotency_key IS NULL THEN RETURN false; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_empresa_id::text || ':' || p_idempotency_key));

  SELECT id INTO v_id
  FROM public.creditos_consumo
  WHERE empresa_id = p_empresa_id
    AND idempotency_key = p_idempotency_key
    AND estornado = false
  LIMIT 1;

  IF v_id IS NULL THEN RETURN false; END IF;

  UPDATE public.creditos_consumo
  SET estornado = true, estornado_em = now()
  WHERE id = v_id;

  UPDATE public.empresas
  SET creditos_consumidos = GREATEST(creditos_consumidos - 1, 0)
  WHERE id = p_empresa_id;

  RETURN true;
END;
$function$;

-- ─────────────────── riscos_recalcular_empresa ───────────────────
CREATE OR REPLACE FUNCTION public.riscos_recalcular_empresa(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_linhas integer;
BEGIN
  /* Escreve nos riscos de uma empresa inteira. Só a da sessão. */
  PERFORM public.exige_empresa_da_sessao(p_empresa_id);

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
  RETURN v_linhas;
END;
$function$;

DO $$
BEGIN
  RAISE NOTICE 'ia/risco: consumo, estorno e recálculo passam a exigir a empresa da sessão';
END $$;
