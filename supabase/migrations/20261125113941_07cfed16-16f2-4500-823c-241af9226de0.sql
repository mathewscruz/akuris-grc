ALTER TABLE public.integration_connections DROP CONSTRAINT IF EXISTS integration_connections_provider_check;
ALTER TABLE public.integration_connections ADD CONSTRAINT integration_connections_provider_check
  CHECK (provider = ANY (ARRAY['microsoft','microsoft365','entra_id','intune','aws','github','sharepoint','onedrive','google_drive','google_workspace']));

ALTER TABLE public.ativos ADD COLUMN IF NOT EXISTS google_device_id text;
ALTER TABLE public.ativos ADD COLUMN IF NOT EXISTS google_connection_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS ativos_empresa_google_device_uidx ON public.ativos(empresa_id, google_device_id) WHERE google_device_id IS NOT NULL;

-- Accounts import: origin follows the connection provider (Google never becomes entra_id).
CREATE OR REPLACE FUNCTION public.integration_import_accounts(p_run uuid, p_attempt integer, p_rows jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
DECLARE c public.integration_connections; r public.integration_runs; item jsonb; existing uuid; imported integer:=0; system_id uuid; v_origem text;
BEGIN
  SELECT * INTO r FROM public.integration_runs WHERE id=p_run AND attempt=p_attempt AND status='running' AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lease_lost'; END IF;
  SELECT * INTO c FROM public.integration_connections WHERE id=r.connection_id AND empresa_id=r.empresa_id;
  v_origem := CASE WHEN c.provider='google_workspace' THEN 'google_workspace' ELSE 'entra_id' END;
  system_id:=(c.settings->>'system_id')::uuid;
  IF system_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.sistemas_privilegiados WHERE id=system_id AND empresa_id=c.empresa_id) THEN RAISE EXCEPTION 'invalid_system'; END IF;
  IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>10000 THEN RAISE EXCEPTION 'invalid_rows'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(system_id::text,0));
  FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF NOT ('user:'||(item->>'origem_id')=ANY(c.scope_ids)) OR item->>'origem'<>v_origem THEN RAISE EXCEPTION 'invalid_scope'; END IF;
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

CREATE OR REPLACE FUNCTION public.integration_configure(p_id uuid, p_empresa uuid, p_frequency text, p_scope text[], p_system uuid DEFAULT NULL::uuid, p_region text DEFAULT 'us-east-1'::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
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
  UPDATE public.integration_connections SET frequency=p_frequency, scope_ids=p_scope,
    settings=settings||jsonb_build_object('system_id',p_system,'region',p_region),
    next_run_at=CASE WHEN status='paused' OR p_frequency='manual' THEN NULL ELSE now()+CASE WHEN p_frequency='weekly' THEN interval '7 days' ELSE interval '1 day' END END
    WHERE id=p_id;
END $function$;

-- Purge: Microsoft modules unchanged; Google modules added (dispositivos/usuarios/drive/auditoria).
CREATE OR REPLACE FUNCTION public.integration_purge_module(p_id uuid, p_empresa uuid, p_module text, p_dry_run boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE removidos int:=0; arquivados int:=0; limpos int:=0; r record; ligado boolean;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.integration_connections WHERE id=p_id AND empresa_id=p_empresa) THEN RAISE EXCEPTION 'connection_missing'; END IF;
  IF p_module='intune' THEN
    FOR r IN SELECT id, mesh_node_id FROM public.ativos WHERE empresa_id=p_empresa AND integration_connection_id=p_id LOOP
      IF r.mesh_node_id IS NOT NULL THEN
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
    NULL; -- login audit lives only as signals on collected identities
  ELSE RAISE EXCEPTION 'invalid_module';
  END IF;
  RETURN jsonb_build_object('module',p_module,'removidos',removidos,'arquivados',arquivados,'limpos',limpos);
END $$;
REVOKE ALL ON FUNCTION public.integration_purge_module(uuid,uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_purge_module(uuid,uuid,text,boolean) TO service_role;