-- Atomic configuration and lifecycle operations share the enqueue row lock.
-- Never change scope underneath an in-flight collection.
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['integration_connections','integration_runs','integration_resources','integration_observations'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname='integration_mfa_required') THEN
      EXECUTE format('CREATE POLICY integration_mfa_required ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_valid_mfa_session())',tab);
    END IF;
  END LOOP;
END $$;
CREATE FUNCTION public.integration_scheduler_ready(p_token_sha256 text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE secret text; worker_url text;
BEGIN
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='integration_worker_token' LIMIT 1;
  SELECT decrypted_secret INTO worker_url FROM vault.decrypted_secrets WHERE name='integration_worker_url' LIMIT 1;
  RETURN coalesce(length(secret)>=32 AND encode(extensions.digest(secret,'sha256'),'hex')=p_token_sha256
    AND worker_url LIKE 'https://%/functions/v1/integration-worker'
    AND EXISTS(SELECT 1 FROM cron.job WHERE jobname='integration-collections' AND active),false);
END $$;
REVOKE ALL ON FUNCTION public.integration_scheduler_ready(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.integration_scheduler_ready(text) TO service_role;

CREATE FUNCTION public.integration_configure(p_id uuid,p_empresa uuid,p_frequency text,p_scope text[],p_system uuid DEFAULT NULL,p_region text DEFAULT 'us-east-1') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.integration_connections;
BEGIN
  SELECT * INTO c FROM public.integration_connections WHERE id=p_id AND empresa_id=p_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'connection_missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.integration_runs WHERE connection_id=p_id AND status IN ('running','queued')) THEN RAISE EXCEPTION 'connection_busy'; END IF;
  IF p_frequency NOT IN ('manual','daily','weekly') OR p_scope IS NULL OR cardinality(p_scope)>10000 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  IF p_system IS NOT NULL AND (c.provider NOT IN ('microsoft365','entra_id') OR NOT EXISTS(
    SELECT 1 FROM public.sistemas_privilegiados WHERE id=p_system AND empresa_id=p_empresa)) THEN RAISE EXCEPTION 'invalid_system'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(p_scope) s WHERE NOT EXISTS(SELECT 1 FROM public.integration_resources r WHERE r.connection_id=p_id AND r.external_id=s)) THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  IF p_region !~ '^[a-z]{2}-[a-z]+-[0-9]$' THEN RAISE EXCEPTION 'invalid_region'; END IF;
  UPDATE public.integration_connections SET frequency=p_frequency, scope_ids=p_scope,
    settings=settings||jsonb_build_object('system_id',p_system,'region',p_region),
    next_run_at=CASE WHEN status='paused' OR p_frequency='manual' THEN NULL ELSE now()+CASE WHEN p_frequency='weekly' THEN interval '7 days' ELSE interval '1 day' END END
    WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.integration_configure(uuid,uuid,text,text[],uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.integration_configure(uuid,uuid,text,text[],uuid,text) TO service_role;

CREATE FUNCTION public.integration_change_state(p_id uuid,p_empresa uuid,p_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.integration_connections;
BEGIN
  SELECT * INTO c FROM public.integration_connections WHERE id=p_id AND empresa_id=p_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'connection_missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.integration_runs WHERE connection_id=p_id AND status='running' AND lease_until>now()) THEN RAISE EXCEPTION 'connection_busy'; END IF;
  IF p_action NOT IN ('pause','resume','disconnect') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  IF p_action='resume' THEN
    IF c.provider<>'aws' AND c.credentials IS NULL THEN RAISE EXCEPTION 'authorization_required'; END IF;
    UPDATE public.integration_connections SET status='authorized',next_run_at=CASE WHEN frequency='manual' THEN NULL ELSE now()+CASE WHEN frequency='weekly' THEN interval '7 days' ELSE interval '1 day' END END WHERE id=p_id;
  ELSE
    UPDATE public.integration_runs SET status='error',error_code='cancelled',finished_at=now(),lease_until=NULL WHERE connection_id=p_id AND status IN ('queued','running');
    UPDATE public.integration_connections SET status='paused',next_run_at=NULL,
      credentials=CASE WHEN p_action='disconnect' THEN NULL ELSE credentials END,
      settings=CASE WHEN p_action='disconnect' AND provider='aws' THEN settings-'role_arn' ELSE settings END WHERE id=p_id;
    DELETE FROM public.integration_oauth_states WHERE connection_id=p_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.integration_change_state(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.integration_change_state(uuid,uuid,text) TO service_role;

-- Structured source signals, separate from operational status and prose.
ALTER TABLE public.sistemas_usuarios ADD COLUMN IF NOT EXISTS integration_signals jsonb;
ALTER TABLE public.sistemas_usuarios ADD COLUMN IF NOT EXISTS integration_connection_id uuid REFERENCES public.integration_connections(id);

CREATE FUNCTION public.integration_import_accounts(p_run uuid,p_attempt integer,p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.integration_connections; r public.integration_runs; item jsonb; existing uuid; imported integer:=0; system_id uuid;
BEGIN
  SELECT * INTO r FROM public.integration_runs WHERE id=p_run AND attempt=p_attempt AND status='running' AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lease_lost'; END IF;
  SELECT * INTO c FROM public.integration_connections WHERE id=r.connection_id AND empresa_id=r.empresa_id;
  system_id:=(c.settings->>'system_id')::uuid;
  IF system_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.sistemas_privilegiados WHERE id=system_id AND empresa_id=c.empresa_id) THEN RAISE EXCEPTION 'invalid_system'; END IF;
  IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>10000 THEN RAISE EXCEPTION 'invalid_rows'; END IF;
  -- Serializes imports from overlapping directory connections into this system.
  PERFORM pg_advisory_xact_lock(hashtextextended(system_id::text,0));
  FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF NOT ('user:'||(item->>'origem_id')=ANY(c.scope_ids)) OR item->>'origem'<>'entra_id' THEN RAISE EXCEPTION 'invalid_scope'; END IF;
    SELECT id INTO existing FROM public.sistemas_usuarios WHERE empresa_id=c.empresa_id AND sistema_id=system_id AND origem='entra_id' AND origem_id=item->>'origem_id' ORDER BY created_at LIMIT 1;
    IF existing IS NULL THEN
      INSERT INTO public.sistemas_usuarios(empresa_id,sistema_id,nome_usuario,email_usuario,departamento,cargo,tipo_acesso,nivel_privilegio,ativo,origem,origem_id,sincronizado_em,integration_signals,integration_connection_id,created_by)
      VALUES(c.empresa_id,system_id,item->>'nome_usuario',item->>'email_usuario',item->>'departamento',item->>'cargo',item->>'tipo_acesso',item->>'nivel_privilegio',(item->>'ativo')::boolean,'entra_id',item->>'origem_id',now(),item->'integration_signals',c.id,c.created_by);
    ELSE
      UPDATE public.sistemas_usuarios SET nome_usuario=item->>'nome_usuario',email_usuario=item->>'email_usuario',departamento=item->>'departamento',cargo=item->>'cargo',
        tipo_acesso=item->>'tipo_acesso',nivel_privilegio=item->>'nivel_privilegio',ativo=(item->>'ativo')::boolean,sincronizado_em=now(),updated_at=now(),integration_signals=item->'integration_signals',integration_connection_id=c.id
        WHERE id=existing AND empresa_id=c.empresa_id;
    END IF;
    imported:=imported+1;
  END LOOP;
  RETURN imported;
END $$;
REVOKE ALL ON FUNCTION public.integration_import_accounts(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.integration_import_accounts(uuid,integer,jsonb) TO service_role;

-- Fencing prevents a timed-out worker from finalizing another attempt's run.
DROP FUNCTION IF EXISTS public.integration_finish_run(uuid,integer,text,integer,text,timestamptz);
CREATE FUNCTION public.integration_finish_run(p_run uuid,p_attempt integer,p_status text,p_count integer,p_error text,p_retry_at timestamptz DEFAULT NULL,p_evidence jsonb DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.integration_runs; c public.integration_connections;
BEGIN
  SELECT * INTO c FROM public.integration_connections WHERE id=(SELECT connection_id FROM public.integration_runs WHERE id=p_run) FOR UPDATE;
  SELECT * INTO r FROM public.integration_runs WHERE id=p_run AND attempt=p_attempt AND status='running' AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_status NOT IN ('queued','success','partial','error') OR p_count<0 THEN RAISE EXCEPTION 'invalid_result'; END IF;
  IF p_evidence IS NOT NULL THEN
    IF p_status NOT IN ('success','partial') OR jsonb_typeof(p_evidence)<>'object'
      OR coalesce(p_evidence->>'hash','') !~ '^[a-f0-9]{64}$' OR coalesce((p_evidence->>'size')::bigint,0)<=0
      THEN RAISE EXCEPTION 'invalid_evidence'; END IF;
    INSERT INTO public.evidence_library(id,empresa_id,nome,arquivo_url,bucket,arquivo_nome,arquivo_tipo,arquivo_tamanho,arquivo_hash,tags,created_by,valido_ate)
    VALUES(r.id,r.empresa_id,c.name||' · '||current_date::text,r.empresa_id::text||'/integrations/'||r.id::text||'-'||r.attempt::text||'.json',
      'gap-evidence-library',c.provider||'-'||r.id::text||'.json','application/json',(p_evidence->>'size')::bigint,
      p_evidence->>'hash',ARRAY['integration',c.provider,'metadata'],c.created_by,current_date+CASE WHEN c.frequency='weekly' THEN 8 ELSE 2 END);
  END IF;
  UPDATE public.integration_runs SET status=p_status,resource_count=p_count,error_code=p_error,lease_until=NULL,
    evidence_id=CASE WHEN p_evidence IS NOT NULL THEN r.id ELSE evidence_id END,
    finished_at=CASE WHEN p_status='queued' THEN NULL ELSE now() END,available_at=coalesce(p_retry_at,available_at) WHERE id=r.id;
  UPDATE public.integration_connections SET status=CASE WHEN p_status='success' THEN 'connected' WHEN p_status='partial' THEN 'partial' ELSE 'error' END,
    last_success_at=CASE WHEN p_status='success' THEN now() ELSE last_success_at END,error_code=p_error
    WHERE id=r.connection_id AND empresa_id=r.empresa_id AND status<>'paused';
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.integration_finish_run(uuid,integer,text,integer,text,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.integration_finish_run(uuid,integer,text,integer,text,timestamptz,jsonb) TO service_role;
