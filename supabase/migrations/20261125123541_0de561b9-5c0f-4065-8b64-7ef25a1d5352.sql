CREATE OR REPLACE FUNCTION public.integration_schedule_due()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE c record; queued integer:=0;
BEGIN
  UPDATE public.integration_runs SET status='error',error_code='lease_exhausted',finished_at=now()
    WHERE status='running' AND lease_until<now() AND attempt>=4;
  -- Only connections explicitly opted in to automatic sync; Google/Microsoft also need imported modules.
  FOR c IN SELECT * FROM public.integration_connections
    WHERE status NOT IN ('pending','paused') AND frequency<>'manual' AND next_run_at<=now()
      AND coalesce(settings->'automatic_sync_enabled' = 'true'::jsonb, false)
      AND (provider NOT IN ('google_workspace','microsoft')
           OR (jsonb_typeof(settings->'imported_modules')='array' AND jsonb_array_length(settings->'imported_modules')>0))
    FOR UPDATE SKIP LOCKED LOOP
    PERFORM public.integration_enqueue(c.id,c.empresa_id);
    UPDATE public.integration_connections SET next_run_at=now()+CASE WHEN c.frequency='weekly' THEN interval '7 days' ELSE interval '1 day' END WHERE id=c.id;
    queued:=queued+1;
  END LOOP;
  DELETE FROM public.integration_oauth_states WHERE expires_at<now();
  RETURN queued;
END $function$;

CREATE OR REPLACE FUNCTION public.integration_configure(p_id uuid, p_empresa uuid, p_frequency text, p_scope text[], p_system uuid DEFAULT NULL::uuid, p_region text DEFAULT 'us-east-1'::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE c public.integration_connections;
BEGIN
  SELECT * INTO c FROM public.integration_connections WHERE id=p_id AND empresa_id=p_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'connection_missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.integration_runs WHERE connection_id=p_id AND status IN ('running','queued')) THEN RAISE EXCEPTION 'connection_busy'; END IF;
  IF p_frequency NOT IN ('manual','daily','weekly') OR p_scope IS NULL OR cardinality(p_scope)>10000 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  IF p_system IS NOT NULL AND (c.provider NOT IN ('microsoft','microsoft365','entra_id','google_workspace') OR NOT EXISTS(
    SELECT 1 FROM public.sistemas_privilegiados WHERE id=p_system AND empresa_id=p_empresa)) THEN RAISE EXCEPTION 'invalid_system'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(p_scope) s WHERE NOT EXISTS(SELECT 1 FROM public.integration_resources r WHERE r.connection_id=p_id AND r.external_id=s)) THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  IF p_region !~ '^[a-z]{2}-[a-z]+-[0-9]$' THEN RAISE EXCEPTION 'invalid_region'; END IF;
  -- Explicit frequency choice is the opt-in: manual turns automatic sync off, daily/weekly turns it on.
  UPDATE public.integration_connections SET frequency=p_frequency, scope_ids=p_scope,
    settings=settings||jsonb_build_object('system_id',p_system,'region',p_region,'automatic_sync_enabled',p_frequency<>'manual'),
    next_run_at=CASE WHEN status='paused' OR p_frequency='manual' THEN NULL ELSE now()+CASE WHEN p_frequency='weekly' THEN interval '7 days' ELSE interval '1 day' END END
    WHERE id=p_id;
END $function$;

CREATE OR REPLACE FUNCTION public.integration_import_module(p_id uuid, p_empresa uuid, p_module text, p_periodic boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.integration_connections; mods text[]; sys uuid; nome text; scope jsonb; prefix text; picked jsonb;
BEGIN
  SELECT * INTO c FROM public.integration_connections WHERE id=p_id AND empresa_id=p_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'connection_missing'; END IF;
  IF c.status IN ('pending','paused') THEN RAISE EXCEPTION 'connection_not_authorized'; END IF;
  mods := ARRAY(SELECT jsonb_array_elements_text(coalesce(c.settings->'modules',
    CASE c.provider WHEN 'google_workspace' THEN '["usuarios","dispositivos","auditoria","drive"]'::jsonb
                    WHEN 'microsoft' THEN '["intune"]'::jsonb ELSE '[]'::jsonb END)));
  IF NOT (p_module = ANY(mods)) THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  sys := nullif(c.settings->>'system_id','')::uuid;
  IF sys IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sistemas_privilegiados WHERE id=sys AND empresa_id=p_empresa) THEN sys := NULL; END IF;
  IF p_module IN ('usuarios','entra') AND sys IS NULL THEN
    IF c.provider <> 'google_workspace' THEN RAISE EXCEPTION 'system_required'; END IF;
    nome := 'Google Workspace – ' || coalesce(nullif(c.settings->>'customer_domain',''), c.settings->>'customer_id', 'organização');
    PERFORM pg_advisory_xact_lock(hashtextextended('gw-system:'||p_empresa::text||':'||nome,0));
    SELECT id INTO sys FROM public.sistemas_privilegiados WHERE empresa_id=p_empresa AND nome_sistema=nome ORDER BY created_at LIMIT 1;
    IF sys IS NULL THEN
      INSERT INTO public.sistemas_privilegiados(empresa_id,nome_sistema,tipo_sistema,criticidade,categoria,observacoes,ativo)
      VALUES(p_empresa,nome,'SaaS','alto','identidade','Criado ao importar usuários do Google Workspace (somente leitura).',true)
      RETURNING id INTO sys;
    END IF;
  END IF;
  scope := coalesce(c.settings->'module_scope','{}'::jsonb);
  IF NOT scope ? p_module THEN
    prefix := CASE WHEN p_module IN ('usuarios','entra') THEN 'user:'
                   WHEN p_module IN ('dispositivos','intune') THEN 'device:'
                   WHEN p_module IN ('drive','documentos') THEN 'file:' ELSE NULL END;
    picked := CASE WHEN prefix IS NULL THEN NULL ELSE
      (SELECT jsonb_agg(DISTINCT s) FROM unnest(coalesce(c.scope_ids, ARRAY[]::text[])) s WHERE left(s, length(prefix)) = prefix) END;
    scope := scope || jsonb_build_object(p_module, coalesce(picked, '"all"'::jsonb));
  END IF;
  -- Opt-in to automatic sync only on this explicit click and only when the scheduler is ready.
  UPDATE public.integration_connections SET
    settings = settings || jsonb_build_object(
      'imported_modules', (SELECT to_jsonb(array_agg(DISTINCT m)) FROM unnest(ARRAY(SELECT jsonb_array_elements_text(coalesce(settings->'imported_modules','[]'::jsonb))) || p_module) m),
      'module_scope', scope) || CASE WHEN p_periodic THEN jsonb_build_object('automatic_sync_enabled', true) ELSE '{}'::jsonb END || CASE WHEN sys IS NOT NULL THEN jsonb_build_object('system_id',sys) ELSE '{}'::jsonb END,
    frequency = CASE WHEN p_periodic AND frequency='manual' THEN 'daily' ELSE frequency END,
    next_run_at = CASE WHEN p_periodic AND (frequency='manual' OR next_run_at IS NULL) THEN now()+interval '1 day' ELSE next_run_at END
  WHERE id=p_id AND empresa_id=p_empresa;
  RETURN jsonb_build_object('system_id',sys,'module_scope',scope);
END $function$;

REVOKE EXECUTE ON FUNCTION public.integration_schedule_due() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.integration_configure(uuid,uuid,text,text[],uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.integration_import_module(uuid,uuid,text,boolean) FROM PUBLIC, anon, authenticated;