ALTER TABLE public.creditos_consumo
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS estornado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estornado_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS creditos_consumo_idem_uidx
  ON public.creditos_consumo (empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consume_ai_credit_idempotente(
  p_empresa_id uuid,
  p_user_id uuid,
  p_funcionalidade text,
  p_idempotency_key text,
  p_descricao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_franquia integer;
  v_consumidos integer;
  v_existing public.creditos_consumo%ROWTYPE;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('charged', false, 'reason', 'MISSING_IDEMPOTENCY_KEY');
  END IF;

  -- Serializa cobranças concorrentes da mesma chave (duplo clique, retry de rede).
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
    SET estornado = false, estornado_em = NULL, user_id = p_user_id,
        funcionalidade = p_funcionalidade, descricao = p_descricao
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.creditos_consumo (empresa_id, user_id, funcionalidade, descricao, idempotency_key)
    VALUES (p_empresa_id, p_user_id, p_funcionalidade, p_descricao, p_idempotency_key);
  END IF;

  UPDATE public.empresas SET creditos_consumidos = creditos_consumidos + 1
  WHERE id = p_empresa_id;

  RETURN jsonb_build_object('charged', true, 'duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.estornar_ai_credit(
  p_empresa_id uuid,
  p_idempotency_key text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id uuid;
BEGIN
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
$$;

REVOKE ALL ON FUNCTION public.consume_ai_credit_idempotente(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.estornar_ai_credit(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit_idempotente(uuid, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.estornar_ai_credit(uuid, text) TO service_role;