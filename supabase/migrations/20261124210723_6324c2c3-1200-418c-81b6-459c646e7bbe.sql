CREATE OR REPLACE FUNCTION public.integration_configure(p_id uuid, p_empresa uuid, p_frequency text, p_scope text[], p_system uuid DEFAULT NULL::uuid, p_region text DEFAULT 'us-east-1'::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.integration_connections;
BEGIN
  SELECT * INTO c FROM public.integration_connections WHERE id=p_id AND empresa_id=p_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'connection_missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.integration_runs WHERE connection_id=p_id AND status IN ('running','queued')) THEN RAISE EXCEPTION 'connection_busy'; END IF;
  IF p_frequency NOT IN ('manual','daily','weekly') OR p_scope IS NULL OR cardinality(p_scope)>10000 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  IF p_system IS NOT NULL AND (c.provider NOT IN ('microsoft','microsoft365','entra_id') OR NOT EXISTS(
    SELECT 1 FROM public.sistemas_privilegiados WHERE id=p_system AND empresa_id=p_empresa)) THEN RAISE EXCEPTION 'invalid_system'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(p_scope) s WHERE NOT EXISTS(SELECT 1 FROM public.integration_resources r WHERE r.connection_id=p_id AND r.external_id=s)) THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  IF p_region !~ '^[a-z]{2}-[a-z]+-[0-9]$' THEN RAISE EXCEPTION 'invalid_region'; END IF;
  UPDATE public.integration_connections SET frequency=p_frequency, scope_ids=p_scope,
    settings=settings||jsonb_build_object('system_id',p_system,'region',p_region),
    next_run_at=CASE WHEN status='paused' OR p_frequency='manual' THEN NULL ELSE now()+CASE WHEN p_frequency='weekly' THEN interval '7 days' ELSE interval '1 day' END END
    WHERE id=p_id;
END $function$;