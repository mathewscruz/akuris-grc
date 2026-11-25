CREATE OR REPLACE FUNCTION public.integration_configure(p_id uuid, p_empresa uuid, p_frequency text, p_scope text[], p_system uuid DEFAULT NULL::uuid, p_region text DEFAULT 'us-east-1'::text, p_scope_explicit boolean DEFAULT false)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE c public.integration_connections; ms jsonb; m text; prefix text; picked jsonb; imported text[]; mods text[];
BEGIN
  SELECT * INTO c FROM public.integration_connections WHERE id=p_id AND empresa_id=p_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'connection_missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.integration_runs WHERE connection_id=p_id AND status IN ('running','queued')) THEN RAISE EXCEPTION 'connection_busy'; END IF;
  IF p_frequency NOT IN ('manual','daily','weekly') OR p_scope IS NULL OR cardinality(p_scope)>10000 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  IF p_system IS NOT NULL AND (c.provider NOT IN ('microsoft','microsoft365','entra_id','google_workspace') OR NOT EXISTS(
    SELECT 1 FROM public.sistemas_privilegiados WHERE id=p_system AND empresa_id=p_empresa)) THEN RAISE EXCEPTION 'invalid_system'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(p_scope) s WHERE NOT EXISTS(SELECT 1 FROM public.integration_resources r WHERE r.connection_id=p_id AND r.external_id=s)) THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  IF p_region !~ '^[a-z]{2}-[a-z]+-[0-9]$' THEN RAISE EXCEPTION 'invalid_region'; END IF;
  ms := coalesce(c.settings->'module_scope','{}'::jsonb);
  IF coalesce(p_scope_explicit,false) THEN
    -- Explicit selection edit: strict per module of this provider (empty stays empty, never widened to "all").
    imported := ARRAY(SELECT jsonb_array_elements_text(coalesce(c.settings->'imported_modules','[]'::jsonb)));
    mods := ARRAY(SELECT jsonb_array_elements_text(coalesce(c.settings->'modules',
      CASE c.provider WHEN 'google_workspace' THEN '["usuarios","dispositivos","auditoria","drive"]'::jsonb
                      WHEN 'microsoft' THEN '["intune","entra","documentos"]'::jsonb ELSE '[]'::jsonb END)));
    FOREACH m IN ARRAY mods LOOP
      prefix := CASE WHEN m IN ('usuarios','entra') THEN 'user:' WHEN m IN ('dispositivos','intune') THEN 'device:'
                     WHEN m IN ('drive','documentos') THEN 'file:' ELSE NULL END;
      CONTINUE WHEN prefix IS NULL;
      picked := coalesce((SELECT jsonb_agg(DISTINCT s) FROM unnest(p_scope) s WHERE left(s,length(prefix))=prefix),'[]'::jsonb);
      IF m = ANY(imported) OR ms ? m OR jsonb_array_length(picked)>0 THEN
        ms := ms || jsonb_build_object(m, picked);
      END IF;
    END LOOP;
  END IF;
  UPDATE public.integration_connections SET frequency=p_frequency, scope_ids=p_scope,
    settings=settings||jsonb_build_object('system_id',p_system,'region',p_region,'automatic_sync_enabled',p_frequency<>'manual','module_scope',ms),
    next_run_at=CASE WHEN status='paused' OR p_frequency='manual' THEN NULL ELSE now()+CASE WHEN p_frequency='weekly' THEN interval '7 days' ELSE interval '1 day' END END
    WHERE id=p_id;
END $function$;
REVOKE EXECUTE ON FUNCTION public.integration_configure(uuid,uuid,text,text[],uuid,text,boolean) FROM PUBLIC, anon, authenticated;