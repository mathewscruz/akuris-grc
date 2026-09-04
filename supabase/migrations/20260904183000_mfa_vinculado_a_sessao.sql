/*
 * MFA pertence à sessão autenticada, não apenas à pessoa.
 *
 * Antes, uma validação feita num navegador liberava qualquer login do mesmo
 * user_id durante 24 horas. O session_id do JWT passa a fazer parte tanto do
 * código quanto da confiança criada depois da verificação.
 */

ALTER TABLE public.mfa_codes
  ADD COLUMN IF NOT EXISTS code_hash text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS auth_session_id text;

-- Registos legados não podem ser consumidos depois da mudança de formato.
UPDATE public.mfa_codes
   SET used = true,
       code_hash = COALESCE(code_hash, 'retired:' || id::text)
 WHERE auth_session_id IS NULL OR code_hash IS NULL;

ALTER TABLE public.mfa_codes ALTER COLUMN code_hash SET NOT NULL;
ALTER TABLE public.mfa_codes DROP COLUMN IF EXISTS code CASCADE;

ALTER TABLE public.mfa_sessions
  ADD COLUMN IF NOT EXISTS auth_session_id text;

-- Confianças antigas não têm como provar a sessão que as originou.
DELETE FROM public.mfa_sessions WHERE auth_session_id IS NULL;

-- Códigos e identificadores de sessão são detalhes internos. O navegador usa
-- apenas as Edge Functions e as RPCs restritas desta migração.
DROP POLICY IF EXISTS "Users can read own mfa codes" ON public.mfa_codes;
DROP POLICY IF EXISTS "Users can view own mfa sessions" ON public.mfa_sessions;
REVOKE ALL ON TABLE public.mfa_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.mfa_sessions FROM anon, authenticated;

-- O trigger legado invalidava códigos de OUTROS dispositivos do mesmo
-- utilizador. Mantém-se a defesa para inserts diretos, mas apenas na sessão.
CREATE OR REPLACE FUNCTION public.invalidate_previous_mfa_codes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.mfa_codes
     SET used = true
   WHERE user_id = NEW.user_id
     AND auth_session_id IS NOT DISTINCT FROM NEW.auth_session_id
     AND id <> NEW.id
     AND used = false;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.invalidate_previous_mfa_codes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_mfa_codes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_mfa_codes() TO service_role;

CREATE INDEX IF NOT EXISTS idx_mfa_codes_session_lookup
  ON public.mfa_codes (user_id, auth_session_id, used, expires_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_sessions_auth_session_unique
  ON public.mfa_sessions (user_id, auth_session_id)
  WHERE auth_session_id IS NOT NULL;

COMMENT ON COLUMN public.mfa_codes.auth_session_id IS
  'session_id do JWT que solicitou o código; o código não vale noutra sessão.';
COMMENT ON COLUMN public.mfa_sessions.auth_session_id IS
  'session_id do JWT que concluiu o segundo fator.';
COMMENT ON COLUMN public.mfa_codes.code_hash IS
  'HMAC-SHA256 de user_id, session_id e código, com chave mantida apenas nas Edge Functions.';

/* Emissão serializada e limitada: 60 s por sessão, 10 emissões por utilizador/hora. */
CREATE OR REPLACE FUNCTION public.issue_session_mfa_code(
  p_user_id uuid,
  p_auth_session_id text,
  p_code_hash text
)
RETURNS TABLE(status text, code_id uuid, expires_at timestamptz, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_recent public.mfa_codes%ROWTYPE;
  v_count integer;
  v_code_id uuid;
  v_expires_at timestamptz := now() + interval '5 minutes';
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR nullif(btrim(p_auth_session_id), '') IS NULL
     OR length(p_auth_session_id) > 200 OR length(p_code_hash) <> 64 THEN
    RAISE EXCEPTION 'invalid MFA issue request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 731));

  SELECT p.empresa_id INTO v_empresa_id
  FROM public.profiles p
  WHERE p.user_id = p_user_id AND p.ativo = true;
  IF v_empresa_id IS NULL THEN
    RETURN QUERY SELECT 'profile_missing'::text, NULL::uuid, NULL::timestamptz, NULL::integer;
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.mfa_codes c
  WHERE c.user_id = p_user_id AND c.created_at > now() - interval '1 hour';
  IF v_count >= 10 THEN
    RETURN QUERY SELECT 'rate_limited'::text, NULL::uuid, NULL::timestamptz, 3600;
    RETURN;
  END IF;

  SELECT c.* INTO v_recent
  FROM public.mfa_codes c
  WHERE c.user_id = p_user_id
    AND c.auth_session_id = p_auth_session_id
    AND c.used = false
    AND c.expires_at > now()
  ORDER BY c.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_recent.created_at > now() - interval '60 seconds' THEN
    RETURN QUERY SELECT
      'cooldown'::text,
      v_recent.id,
      v_recent.expires_at,
      greatest(1, ceil(extract(epoch FROM (v_recent.created_at + interval '60 seconds' - now())))::integer);
    RETURN;
  END IF;

  UPDATE public.mfa_codes
     SET used = true
   WHERE user_id = p_user_id
     AND auth_session_id = p_auth_session_id
     AND used = false;

  INSERT INTO public.mfa_codes
    (user_id, empresa_id, auth_session_id, code_hash, expires_at, used, attempts)
  VALUES
    (p_user_id, v_empresa_id, p_auth_session_id, p_code_hash, v_expires_at, false, 0)
  RETURNING id INTO v_code_id;

  RETURN QUERY SELECT 'issued'::text, v_code_id, v_expires_at, 60;
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_session_mfa_code(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_session_mfa_code(uuid, text, text) TO service_role;

/*
 * Tentativa, consumo e criação da confiança acontecem sob o mesmo lock e na
 * mesma transação. Duas requisições paralelas não conseguem usar o mesmo OTP.
 */
CREATE OR REPLACE FUNCTION public.verify_session_mfa_code_attempt(
  p_user_id uuid,
  p_auth_session_id text,
  p_code_hash text
)
RETURNS TABLE(status text, remaining_attempts integer, session_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_code public.mfa_codes%ROWTYPE;
  v_empresa_id uuid;
  v_attempts integer;
  v_session_expires timestamptz := now() + interval '24 hours';
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR nullif(btrim(p_auth_session_id), '') IS NULL OR length(p_code_hash) <> 64 THEN
    RAISE EXCEPTION 'invalid MFA verify request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_auth_session_id, 947));

  SELECT c.* INTO v_code
  FROM public.mfa_codes c
  WHERE c.user_id = p_user_id
    AND c.auth_session_id = p_auth_session_id
    AND c.used = false
    AND c.expires_at > now()
  ORDER BY c.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'expired_code'::text, 0, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_code.attempts >= 5 THEN
    UPDATE public.mfa_codes SET used = true WHERE id = v_code.id;
    RETURN QUERY SELECT 'too_many_attempts'::text, 0, NULL::timestamptz;
    RETURN;
  END IF;

  v_attempts := v_code.attempts + 1;
  UPDATE public.mfa_codes SET attempts = v_attempts WHERE id = v_code.id;

  IF v_code.code_hash IS DISTINCT FROM p_code_hash THEN
    IF v_attempts >= 5 THEN
      UPDATE public.mfa_codes SET used = true WHERE id = v_code.id;
      RETURN QUERY SELECT 'too_many_attempts'::text, 0, NULL::timestamptz;
    ELSE
      RETURN QUERY SELECT 'invalid_code'::text, 5 - v_attempts, NULL::timestamptz;
    END IF;
    RETURN;
  END IF;

  SELECT p.empresa_id INTO v_empresa_id
  FROM public.profiles p
  WHERE p.user_id = p_user_id AND p.ativo = true;
  IF v_empresa_id IS NULL THEN
    UPDATE public.mfa_codes SET used = true WHERE id = v_code.id;
    RETURN QUERY SELECT 'profile_missing'::text, 0, NULL::timestamptz;
    RETURN;
  END IF;

  UPDATE public.mfa_codes SET used = true WHERE id = v_code.id;

  INSERT INTO public.mfa_sessions
    (user_id, empresa_id, auth_session_id, verified_at, expires_at)
  VALUES
    (p_user_id, v_empresa_id, p_auth_session_id, now(), v_session_expires)
  ON CONFLICT (user_id, auth_session_id) WHERE auth_session_id IS NOT NULL
  DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id,
    verified_at = EXCLUDED.verified_at,
    expires_at = EXCLUDED.expires_at;

  RETURN QUERY SELECT 'verified'::text, 5 - v_attempts, v_session_expires;
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_session_mfa_code_attempt(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_session_mfa_code_attempt(uuid, text, text) TO service_role;

/* RLS e Edge Functions fazem a mesma pergunta: usuário + session_id. */
CREATE OR REPLACE FUNCTION public.has_valid_mfa_session(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT _user_id = auth.uid()
     AND EXISTS (
       SELECT 1
       FROM public.mfa_sessions s
       WHERE s.user_id = _user_id
         AND s.auth_session_id = auth.jwt() ->> 'session_id'
         AND s.expires_at > now()
     );
$function$;

CREATE OR REPLACE FUNCTION public.has_valid_mfa_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.mfa_sessions s
       WHERE s.user_id = auth.uid()
         AND s.auth_session_id = auth.jwt() ->> 'session_id'
         AND s.expires_at > now()
     );
$function$;

REVOKE ALL ON FUNCTION public.has_valid_mfa_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_valid_mfa_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_valid_mfa_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_mfa_session() TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_my_mfa_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.mfa_codes WHERE user_id = v_user_id;
  DELETE FROM public.mfa_sessions WHERE user_id = v_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_my_mfa_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_my_mfa_sessions() TO authenticated;

/* Permite à própria pessoa encerrar os restantes dispositivos sem perder a
   sessão que está a utilizar. A revogação dos refresh tokens é feita pelo
   Supabase Auth; esta função elimina a confiança MFA correspondente. */
CREATE OR REPLACE FUNCTION public.revoke_other_mfa_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_session_id text := auth.jwt() ->> 'session_id';
BEGIN
  IF v_user_id IS NULL OR v_session_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.mfa_codes
  WHERE user_id = v_user_id AND auth_session_id IS DISTINCT FROM v_session_id;
  DELETE FROM public.mfa_sessions
  WHERE user_id = v_user_id AND auth_session_id IS DISTINCT FROM v_session_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_other_mfa_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_other_mfa_sessions() TO authenticated;
