ALTER TABLE public.integration_oauth_states ADD COLUMN IF NOT EXISTS return_origin text;

-- Explicit, atomic, idempotent module import. Google user import creates/reuses the
-- company's own "Google Workspace – <domain>" system; never another company's.
CREATE OR REPLACE FUNCTION public.integration_import_module(p_id uuid, p_empresa uuid, p_module text, p_periodic boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE c public.integration_connections; mods text[]; sys uuid; nome text; scope jsonb;
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
  IF NOT scope ? p_module THEN scope := scope || jsonb_build_object(p_module,'all'); END IF;
  UPDATE public.integration_connections SET
    settings = settings || jsonb_build_object(
      'imported_modules', (SELECT to_jsonb(array_agg(DISTINCT m)) FROM unnest(ARRAY(SELECT jsonb_array_elements_text(coalesce(settings->'imported_modules','[]'::jsonb))) || p_module) m),
      'module_scope', scope) || CASE WHEN sys IS NOT NULL THEN jsonb_build_object('system_id',sys) ELSE '{}'::jsonb END,
    frequency = CASE WHEN p_periodic AND frequency='manual' THEN 'daily' ELSE frequency END,
    next_run_at = CASE WHEN p_periodic AND frequency='manual' THEN now()+interval '1 day' ELSE next_run_at END
  WHERE id=p_id AND empresa_id=p_empresa;
  RETURN jsonb_build_object('system_id',sys,'module_scope',scope);
END $$;
REVOKE ALL ON FUNCTION public.integration_import_module(uuid,uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_import_module(uuid,uuid,text,boolean) TO service_role;

-- Accounts: allowed when the module scope is "all" or the account was explicitly selected.
CREATE OR REPLACE FUNCTION public.integration_import_accounts(p_run uuid, p_attempt integer, p_rows jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.integration_connections; r public.integration_runs; item jsonb; existing uuid; imported integer:=0; system_id uuid; v_origem text; v_scope jsonb; v_all boolean;
BEGIN
  SELECT * INTO r FROM public.integration_runs WHERE id=p_run AND attempt=p_attempt AND status='running' AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lease_lost'; END IF;
  SELECT * INTO c FROM public.integration_connections WHERE id=r.connection_id AND empresa_id=r.empresa_id;
  v_origem := CASE WHEN c.provider='google_workspace' THEN 'google_workspace' ELSE 'entra_id' END;
  v_scope := c.settings->'module_scope'->(CASE WHEN c.provider='google_workspace' THEN 'usuarios' ELSE 'entra' END);
  v_all := v_scope = '"all"'::jsonb;
  system_id:=(c.settings->>'system_id')::uuid;
  IF system_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.sistemas_privilegiados WHERE id=system_id AND empresa_id=c.empresa_id) THEN RAISE EXCEPTION 'invalid_system'; END IF;
  IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>10000 THEN RAISE EXCEPTION 'invalid_rows'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(system_id::text,0));
  FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF item->>'origem'<>v_origem THEN RAISE EXCEPTION 'invalid_scope'; END IF;
    IF NOT v_all AND NOT ('user:'||(item->>'origem_id')=ANY(c.scope_ids))
       AND NOT (jsonb_typeof(v_scope)='array' AND v_scope ? ('user:'||(item->>'origem_id'))) THEN RAISE EXCEPTION 'invalid_scope'; END IF;
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

-- Purge protects every other provider's link in both directions.
CREATE OR REPLACE FUNCTION public.integration_purge_module(p_id uuid, p_empresa uuid, p_module text, p_dry_run boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE removidos int:=0; arquivados int:=0; limpos int:=0; r record; ligado boolean;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.integration_connections WHERE id=p_id AND empresa_id=p_empresa) THEN RAISE EXCEPTION 'connection_missing'; END IF;
  IF p_module='intune' THEN
    FOR r IN SELECT id, mesh_node_id, google_device_id FROM public.ativos WHERE empresa_id=p_empresa AND integration_connection_id=p_id LOOP
      IF r.mesh_node_id IS NOT NULL OR r.google_device_id IS NOT NULL THEN
        limpos:=limpos+1;
        IF NOT p_dry_run THEN UPDATE public.ativos SET intune_device_id=NULL, integration_connection_id=NULL,
          atributos=coalesce(atributos,'{}'::jsonb)-'intune_nao_visto'-'intune_compliance'-'intune_ultimo_sync'
          WHERE id=r.id AND empresa_id=p_empresa; END IF;
        CONTINUE;
      END IF;
      ligado := EXISTS(SELECT 1 FROM public.riscos_ativos WHERE ativo_id=r.id) OR EXISTS(SELECT 1 FROM public.controles_ativos WHERE ativo_id=r.id)
        OR EXISTS(SELECT 1 FROM public.dados_mapeamento WHERE ativo_id=r.id)
        OR EXISTS(SELECT 1 FROM public.incidentes WHERE empresa_id=p_empresa AND ativos_afetados::text LIKE '%'||r.id::text||'%');
      IF ligado THEN arquivados:=arquivados+1;
        IF NOT p_dry_run THEN UPDATE public.ativos SET status='inativo', intune_device_id=NULL, integration_connection_id=NULL WHERE id=r.id AND empresa_id=p_empresa; END IF;
      ELSE removidos:=removidos+1;
        IF NOT p_dry_run THEN DELETE FROM public.ativos WHERE id=r.id AND empresa_id=p_empresa; END IF;
      END IF;
    END LOOP;
  ELSIF p_module='dispositivos' THEN
    FOR r IN SELECT id, mesh_node_id, intune_device_id, tags FROM public.ativos WHERE empresa_id=p_empresa AND google_connection_id=p_id LOOP
      IF r.mesh_node_id IS NOT NULL OR r.intune_device_id IS NOT NULL OR NOT ('descoberto-google' = ANY(coalesce(r.tags,'{}'))) THEN
        limpos:=limpos+1;
        IF NOT p_dry_run THEN UPDATE public.ativos SET google_device_id=NULL, google_connection_id=NULL,
          atributos=coalesce(atributos,'{}'::jsonb)-'google_nao_visto'-'google_origem'-'google_ultimo_sync' WHERE id=r.id AND empresa_id=p_empresa; END IF;
        CONTINUE;
      END IF;
      ligado := EXISTS(SELECT 1 FROM public.riscos_ativos WHERE ativo_id=r.id) OR EXISTS(SELECT 1 FROM public.controles_ativos WHERE ativo_id=r.id)
        OR EXISTS(SELECT 1 FROM public.dados_mapeamento WHERE ativo_id=r.id)
        OR EXISTS(SELECT 1 FROM public.incidentes WHERE empresa_id=p_empresa AND ativos_afetados::text LIKE '%'||r.id::text||'%');
      IF ligado THEN arquivados:=arquivados+1;
        IF NOT p_dry_run THEN UPDATE public.ativos SET status='inativo', google_device_id=NULL, google_connection_id=NULL WHERE id=r.id AND empresa_id=p_empresa; END IF;
      ELSE removidos:=removidos+1;
        IF NOT p_dry_run THEN DELETE FROM public.ativos WHERE id=r.id AND empresa_id=p_empresa; END IF;
      END IF;
    END LOOP;
  ELSIF p_module IN ('entra','usuarios') THEN
    FOR r IN SELECT id FROM public.sistemas_usuarios WHERE empresa_id=p_empresa AND integration_connection_id=p_id LOOP
      IF EXISTS(SELECT 1 FROM public.access_review_items WHERE sistema_usuario_id=r.id) OR EXISTS(SELECT 1 FROM public.access_review_history WHERE sistema_usuario_id=r.id) THEN
        arquivados:=arquivados+1;
        IF NOT p_dry_run THEN UPDATE public.sistemas_usuarios SET ativo=false, integration_connection_id=NULL WHERE id=r.id AND empresa_id=p_empresa; END IF;
      ELSE removidos:=removidos+1;
        IF NOT p_dry_run THEN DELETE FROM public.sistemas_usuarios WHERE id=r.id AND empresa_id=p_empresa; END IF;
      END IF;
    END LOOP;
  ELSIF p_module IN ('documentos','drive') THEN
    SELECT count(*) INTO removidos FROM public.integration_resources WHERE empresa_id=p_empresa AND connection_id=p_id AND kind='document';
    IF NOT p_dry_run THEN
      DELETE FROM public.integration_observations o USING public.integration_resources ir
        WHERE o.resource_id=ir.id AND o.empresa_id=p_empresa AND ir.empresa_id=p_empresa AND ir.connection_id=p_id AND ir.kind='document';
      DELETE FROM public.integration_resources WHERE empresa_id=p_empresa AND connection_id=p_id AND kind='document';
    END IF;
  ELSIF p_module='auditoria' THEN
    NULL;
  ELSE RAISE EXCEPTION 'invalid_module';
  END IF;
  RETURN jsonb_build_object('module',p_module,'removidos',removidos,'arquivados',arquivados,'limpos',limpos);
END $function$;