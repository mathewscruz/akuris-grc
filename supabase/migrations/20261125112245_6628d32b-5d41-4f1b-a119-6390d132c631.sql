ALTER TABLE public.ativos ADD COLUMN IF NOT EXISTS integration_connection_id uuid;
CREATE INDEX IF NOT EXISTS ativos_integration_conn_idx ON public.ativos(empresa_id, integration_connection_id) WHERE integration_connection_id IS NOT NULL;

-- Migrate legacy intune connection to unified microsoft (only if company has no microsoft yet)
UPDATE public.integration_connections c
SET provider='microsoft', settings = coalesce(c.settings,'{}'::jsonb) || jsonb_build_object('modules', jsonb_build_array('intune'), 'legacy_provider','intune')
WHERE c.provider='intune'
  AND NOT EXISTS (SELECT 1 FROM public.integration_connections m WHERE m.empresa_id=c.empresa_id AND m.provider='microsoft');

UPDATE public.ativos a SET integration_connection_id = c.id
FROM public.integration_connections c
WHERE a.empresa_id=c.empresa_id AND c.provider='microsoft' AND a.intune_device_id IS NOT NULL AND a.integration_connection_id IS NULL;

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
      ligado := EXISTS(SELECT 1 FROM public.riscos_ativos WHERE ativo_id=r.id)
        OR EXISTS(SELECT 1 FROM public.controles_ativos WHERE ativo_id=r.id)
        OR EXISTS(SELECT 1 FROM public.dados_mapeamento WHERE ativo_id=r.id)
        OR EXISTS(SELECT 1 FROM public.incidentes WHERE empresa_id=p_empresa AND ativos_afetados::text LIKE '%'||r.id::text||'%');
      IF ligado THEN
        arquivados:=arquivados+1;
        IF NOT p_dry_run THEN UPDATE public.ativos SET status='inativo', intune_device_id=NULL, integration_connection_id=NULL WHERE id=r.id AND empresa_id=p_empresa; END IF;
      ELSE
        removidos:=removidos+1;
        IF NOT p_dry_run THEN DELETE FROM public.ativos WHERE id=r.id AND empresa_id=p_empresa; END IF;
      END IF;
    END LOOP;
  ELSIF p_module='entra' THEN
    FOR r IN SELECT id FROM public.sistemas_usuarios WHERE empresa_id=p_empresa AND integration_connection_id=p_id LOOP
      IF EXISTS(SELECT 1 FROM public.access_review_items WHERE sistema_usuario_id=r.id) OR EXISTS(SELECT 1 FROM public.access_review_history WHERE sistema_usuario_id=r.id) THEN
        arquivados:=arquivados+1;
        IF NOT p_dry_run THEN UPDATE public.sistemas_usuarios SET ativo=false, integration_connection_id=NULL WHERE id=r.id AND empresa_id=p_empresa; END IF;
      ELSE
        removidos:=removidos+1;
        IF NOT p_dry_run THEN DELETE FROM public.sistemas_usuarios WHERE id=r.id AND empresa_id=p_empresa; END IF;
      END IF;
    END LOOP;
  ELSIF p_module='documentos' THEN
    SELECT count(*) INTO removidos FROM public.integration_resources WHERE empresa_id=p_empresa AND connection_id=p_id AND kind='document';
    IF NOT p_dry_run THEN
      DELETE FROM public.integration_observations o USING public.integration_resources ir
        WHERE o.resource_id=ir.id AND o.empresa_id=p_empresa AND ir.empresa_id=p_empresa AND ir.connection_id=p_id AND ir.kind='document';
      DELETE FROM public.integration_resources WHERE empresa_id=p_empresa AND connection_id=p_id AND kind='document';
    END IF;
  ELSE RAISE EXCEPTION 'invalid_module';
  END IF;
  RETURN jsonb_build_object('module',p_module,'removidos',removidos,'arquivados',arquivados,'limpos',limpos);
END $$;
REVOKE ALL ON FUNCTION public.integration_purge_module(uuid,uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_purge_module(uuid,uuid,text,boolean) TO service_role;