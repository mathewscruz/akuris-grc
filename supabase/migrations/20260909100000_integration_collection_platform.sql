-- Collection platform: separate from legacy notification connectors.
-- No provider credentials, consent or customer connections are seeded.
CREATE TABLE public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  provider text NOT NULL CHECK (provider IN ('microsoft365','entra_id','intune','aws','github','sharepoint','onedrive','google_drive')),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','authorized','connected','partial','error','paused')),
  credentials text,
  settings jsonb NOT NULL DEFAULT '{}',
  frequency text NOT NULL DEFAULT 'manual' CHECK (frequency IN ('manual','daily','weekly')),
  scope_ids text[] NOT NULL DEFAULT '{}',
  last_success_at timestamptz,
  next_run_at timestamptz,
  error_code text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id)
);

CREATE TABLE public.integration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','success','partial','error')),
  attempt integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  resource_count integer NOT NULL DEFAULT 0,
  error_code text,
  evidence_id uuid REFERENCES public.evidence_library(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (connection_id, empresa_id) REFERENCES public.integration_connections(id, empresa_id),
  UNIQUE(id, empresa_id)
);
CREATE UNIQUE INDEX integration_one_active_run ON public.integration_runs(connection_id)
  WHERE status IN ('queued','running');

CREATE TABLE public.integration_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  external_id text NOT NULL,
  kind text NOT NULL,
  name text NOT NULL,
  source_url text,
  signals jsonb NOT NULL DEFAULT '{}',
  collected_at timestamptz NOT NULL,
  last_run_id uuid NOT NULL,
  FOREIGN KEY (connection_id, empresa_id) REFERENCES public.integration_connections(id, empresa_id),
  FOREIGN KEY (last_run_id, empresa_id) REFERENCES public.integration_runs(id, empresa_id),
  UNIQUE(connection_id, external_id),
  UNIQUE(id, empresa_id)
);

CREATE TABLE public.integration_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  signals jsonb NOT NULL,
  checks jsonb NOT NULL,
  rule_version text NOT NULL DEFAULT '1',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (run_id, empresa_id) REFERENCES public.integration_runs(id, empresa_id),
  FOREIGN KEY (resource_id, empresa_id) REFERENCES public.integration_resources(id, empresa_id),
  UNIQUE(run_id, resource_id)
);

CREATE TABLE public.integration_oauth_states (
  state_hash text PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  session_id uuid NOT NULL,
  verifier text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);

-- All writes go through authenticated/MFA-checked edge functions. The app
-- may never fetch credentials or OAuth state, even when the user is admin.
DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['integration_connections','integration_runs','integration_resources','integration_observations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tab);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', tab);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tab);
    EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.ativo AND p.empresa_id=%I.empresa_id AND p.role::text IN (''admin'',''super_admin'')))', tab, tab);
  END LOOP;
END $$;
GRANT SELECT (id,empresa_id,provider,name,status,settings,frequency,scope_ids,last_success_at,next_run_at,error_code,created_by,created_at,updated_at)
  ON public.integration_connections TO authenticated;
GRANT SELECT ON public.integration_runs, public.integration_resources, public.integration_observations TO authenticated;
ALTER TABLE public.integration_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integration_oauth_states FROM anon, authenticated;
GRANT ALL ON public.integration_oauth_states TO service_role;

CREATE FUNCTION public.integration_encrypt_credentials() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.credentials IS NOT NULL AND (TG_OP='INSERT' OR NEW.credentials IS DISTINCT FROM OLD.credentials) THEN
    NEW.credentials := public.cifrar_credenciais(NEW.credentials);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.integration_encrypt_credentials() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER integration_encrypt BEFORE INSERT OR UPDATE ON public.integration_connections
FOR EACH ROW EXECUTE FUNCTION public.integration_encrypt_credentials();

CREATE FUNCTION public.integration_read_credentials(p_id uuid, p_empresa uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE encrypted text;
BEGIN
  SELECT credentials INTO encrypted FROM public.integration_connections WHERE id=p_id AND empresa_id=p_empresa;
  IF encrypted IS NULL THEN RETURN NULL; END IF;
  IF left(encrypted,4) <> 'pgp:' THEN RAISE EXCEPTION 'credentials_not_encrypted'; END IF;
  RETURN extensions.pgp_sym_decrypt(decode(substr(encrypted,5),'base64'), public.chave_credenciais_integracao())::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.integration_read_credentials(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.integration_read_credentials(uuid,uuid) TO service_role;

-- Queue operations are atomic: concurrent clicks, workers or ticks do not
-- produce duplicate in-flight runs. Expired leases are recoverable.
CREATE FUNCTION public.integration_enqueue(p_id uuid, p_empresa uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run_id uuid;
BEGIN
  PERFORM 1 FROM public.integration_connections WHERE id=p_id AND empresa_id=p_empresa
    AND status NOT IN ('pending','paused') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'connection_not_authorized'; END IF;
  SELECT id INTO run_id FROM public.integration_runs WHERE connection_id=p_id AND status IN ('queued','running');
  IF run_id IS NULL THEN
    INSERT INTO public.integration_runs(connection_id,empresa_id) VALUES(p_id,p_empresa) RETURNING id INTO run_id;
  END IF;
  RETURN run_id;
END $$;
REVOKE ALL ON FUNCTION public.integration_enqueue(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.integration_enqueue(uuid,uuid) TO service_role;

CREATE FUNCTION public.integration_claim(p_run uuid DEFAULT NULL) RETURNS SETOF public.integration_runs
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  UPDATE public.integration_runs SET status='running', attempt=attempt+1,
    started_at=coalesce(started_at,now()), lease_until=now()+interval '5 minutes'
  WHERE id IN (
    SELECT r.id FROM public.integration_runs r JOIN public.integration_connections c ON c.id=r.connection_id
    WHERE c.status NOT IN ('paused','pending') AND (p_run IS NULL OR r.id=p_run)
      AND ((r.status='queued' AND r.available_at<=now()) OR (r.status='running' AND r.lease_until<now()))
      AND r.attempt<4 ORDER BY r.created_at FOR UPDATE OF r SKIP LOCKED LIMIT 1
  ) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.integration_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.integration_claim(uuid) TO service_role;

CREATE FUNCTION public.integration_schedule_due() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c record; queued integer:=0;
BEGIN
  UPDATE public.integration_runs SET status='error',error_code='lease_exhausted',finished_at=now()
    WHERE status='running' AND lease_until<now() AND attempt>=4;
  FOR c IN SELECT * FROM public.integration_connections WHERE status NOT IN ('pending','paused')
    AND frequency<>'manual' AND next_run_at<=now() FOR UPDATE SKIP LOCKED LOOP
    PERFORM public.integration_enqueue(c.id,c.empresa_id);
    UPDATE public.integration_connections SET next_run_at=now()+CASE WHEN c.frequency='weekly' THEN interval '7 days' ELSE interval '1 day' END WHERE id=c.id;
    queued:=queued+1;
  END LOOP;
  DELETE FROM public.integration_oauth_states WHERE expires_at<now();
  RETURN queued;
END $$;
REVOKE ALL ON FUNCTION public.integration_schedule_due() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.integration_schedule_due() TO service_role;

-- Activation is explicit: the same scoped token must be configured in Vault
-- and in the worker environment. No service-role secret in cron.job.
CREATE FUNCTION public.integration_dispatch_tick() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE worker_url text; worker_token text;
BEGIN
  SELECT decrypted_secret INTO worker_url FROM vault.decrypted_secrets WHERE name='integration_worker_url' LIMIT 1;
  SELECT decrypted_secret INTO worker_token FROM vault.decrypted_secrets WHERE name='integration_worker_token' LIMIT 1;
  IF worker_url IS NULL OR length(worker_token)<32 OR worker_token IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(url:=worker_url, headers:=jsonb_build_object('Authorization','Bearer '||worker_token,'Content-Type','application/json'),body:='{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.integration_dispatch_tick() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.integration_dispatch_tick() TO service_role;
DO $$ BEGIN
  IF to_regnamespace('cron') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='integration-collections') THEN
    PERFORM cron.schedule('integration-collections','*/5 * * * *','SELECT public.integration_dispatch_tick();');
  END IF;
END $$;

CREATE INDEX integration_resources_tenant_connection ON public.integration_resources(empresa_id,connection_id);
CREATE INDEX integration_runs_tenant_created ON public.integration_runs(empresa_id,created_at DESC);
