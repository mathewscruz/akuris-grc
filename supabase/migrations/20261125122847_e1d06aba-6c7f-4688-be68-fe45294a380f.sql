CREATE OR REPLACE FUNCTION public.integration_import_accounts(p_run uuid, p_attempt integer, p_rows jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.integration_connections; r public.integration_runs; item jsonb; existing uuid; imported integer:=0; system_id uuid; v_origem text; v_scope jsonb; v_all boolean; v_ext text;
BEGIN
  SELECT * INTO r FROM public.integration_runs WHERE id=p_run AND attempt=p_attempt AND status='running' AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lease_lost'; END IF;
  SELECT * INTO c FROM public.integration_connections WHERE id=r.connection_id AND empresa_id=r.empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'connection_missing'; END IF;
  v_origem := CASE WHEN c.provider='google_workspace' THEN 'google_workspace' ELSE 'entra_id' END;
  v_scope := c.settings->'module_scope'->(CASE WHEN c.provider='google_workspace' THEN 'usuarios' ELSE 'entra' END);
  -- NULL-safe: a missing scope is never "all".
  v_all := coalesce(v_scope = '"all"'::jsonb, false);
  system_id:=(c.settings->>'system_id')::uuid;
  IF system_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.sistemas_privilegiados WHERE id=system_id AND empresa_id=c.empresa_id) THEN RAISE EXCEPTION 'invalid_system'; END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)>10000 THEN RAISE EXCEPTION 'invalid_rows'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(system_id::text,0));
  FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF (item->>'origem') IS DISTINCT FROM v_origem THEN RAISE EXCEPTION 'invalid_scope'; END IF;
    IF nullif(item->>'origem_id','') IS NULL THEN RAISE EXCEPTION 'invalid_scope'; END IF;
    v_ext := 'user:'||(item->>'origem_id');
    IF NOT (v_all
            OR coalesce(v_ext = ANY(c.scope_ids), false)
            OR coalesce(jsonb_typeof(v_scope)='array' AND v_scope ? v_ext, false)) THEN
      RAISE EXCEPTION 'invalid_scope';
    END IF;
    existing := NULL;
    SELECT id INTO existing FROM public.sistemas_usuarios WHERE empresa_id=c.empresa_id AND sistema_id=system_id AND origem=v_origem AND origem_id=item->>'origem_id' ORDER BY created_at LIMIT 1;
    IF existing IS NULL THEN
      INSERT INTO public.sistemas_usuarios(empresa_id,sistema_id,nome_usuario,email_usuario,departamento,cargo,tipo_acesso,nivel_privilegio,ativo,origem,origem_id,sincronizado_em,integration_signals,integration_connection_id,created_by)
      VALUES(c.empresa_id,system_id,item->>'nome_usuario',item->>'email_usuario',item->>'departamento',item->>'cargo',item->>'tipo_acesso',item->>'nivel_privilegio',(item->>'ativo')::boolean,v_origem,item->>'origem_id',now(),item->'integration_signals',c.id,c.created_by);
    ELSE
      UPDATE public.sistemas_usuarios SET nome_usuario=item->>'nome_usuario',email_usuario=item->>'email_usuario',departamento=item->>'departamento',cargo=item->>'cargo',
        tipo_acesso=item->>'tipo_acesso',nivel_privilegio=item->>'nivel_privilegio',ativo=(item->>'ativo')::boolean,sincronizado_em=now(),updated_at=now(),integration_signals=item->'integration_signals',integration_connection_id=c.id
        WHERE id=existing AND empresa_id=c.empresa_id;
    END IF;
    imported:=imported+1;
  END LOOP;
  RETURN imported;
END $function$;

CREATE OR REPLACE FUNCTION public.integration_import_module(p_id uuid, p_empresa uuid, p_module text, p_periodic boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
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
    -- Keep an explicit earlier selection for this module; "all" only when nothing was chosen.
    prefix := CASE WHEN p_module IN ('usuarios','entra') THEN 'user:'
                   WHEN p_module IN ('dispositivos','intune') THEN 'device:'
                   WHEN p_module IN ('drive','documentos') THEN 'file:' ELSE NULL END;
    picked := CASE WHEN prefix IS NULL THEN NULL ELSE
      (SELECT jsonb_agg(DISTINCT s) FROM unnest(coalesce(c.scope_ids, ARRAY[]::text[])) s WHERE left(s, length(prefix)) = prefix) END;
    scope := scope || jsonb_build_object(p_module, coalesce(picked, '"all"'::jsonb));
  END IF;
  UPDATE public.integration_connections SET
    settings = settings || jsonb_build_object(
      'imported_modules', (SELECT to_jsonb(array_agg(DISTINCT m)) FROM unnest(ARRAY(SELECT jsonb_array_elements_text(coalesce(settings->'imported_modules','[]'::jsonb))) || p_module) m),
      'module_scope', scope) || CASE WHEN sys IS NOT NULL THEN jsonb_build_object('system_id',sys) ELSE '{}'::jsonb END,
    frequency = CASE WHEN p_periodic AND frequency='manual' THEN 'daily' ELSE frequency END,
    next_run_at = CASE WHEN p_periodic AND frequency='manual' THEN now()+interval '1 day' ELSE next_run_at END
  WHERE id=p_id AND empresa_id=p_empresa;
  RETURN jsonb_build_object('system_id',sys,'module_scope',scope);
END $function$;

REVOKE ALL ON FUNCTION public.integration_import_accounts(uuid, integer, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.integration_import_module(uuid, uuid, text, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_import_accounts(uuid, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.integration_import_module(uuid, uuid, text, boolean) TO service_role;