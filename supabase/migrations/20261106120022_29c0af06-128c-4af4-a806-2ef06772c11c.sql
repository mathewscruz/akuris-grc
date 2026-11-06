CREATE OR REPLACE FUNCTION public.consume_password_reset_attempt(p_fingerprint_hash text, p_max_attempts integer DEFAULT 3)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     OR p_fingerprint_hash !~ '^[0-9a-f]{64}$'
     OR p_max_attempts NOT BETWEEN 1 AND 50 THEN
    RETURN false;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('password-reset:' || p_fingerprint_hash, 0)
  );
  DELETE FROM public.password_reset_limits WHERE created_at < now() - interval '24 hours';
  IF (
    SELECT count(*) FROM public.password_reset_limits
    WHERE fingerprint_hash = p_fingerprint_hash
      AND created_at >= now() - interval '1 hour'
  ) >= p_max_attempts THEN
    RETURN false;
  END IF;
  INSERT INTO public.password_reset_limits (fingerprint_hash) VALUES (p_fingerprint_hash);
  RETURN true;
END;
$function$;