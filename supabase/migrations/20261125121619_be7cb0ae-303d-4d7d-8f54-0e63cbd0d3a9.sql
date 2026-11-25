CREATE TABLE public.integration_delegated_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  purpose text NOT NULL DEFAULT 'cloud_identity_devices',
  credentials text NOT NULL,
  client_email text NOT NULL,
  project_id text NOT NULL,
  key_id_suffix text,
  admin_email text NOT NULL,
  customer_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  error_code text,
  validated_at timestamptz,
  last_used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, purpose)
);
-- Server only: the browser never reads or writes this table.
REVOKE ALL ON public.integration_delegated_credentials FROM anon, authenticated, public;
GRANT ALL ON public.integration_delegated_credentials TO service_role;
ALTER TABLE public.integration_delegated_credentials ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.integration_delegated_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF NEW.purpose <> 'cloud_identity_devices' THEN RAISE EXCEPTION 'invalid_purpose'; END IF;
  IF NEW.status NOT IN ('active','error') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  -- The credential must belong to the same company as its Google Workspace connection.
  IF NOT EXISTS (SELECT 1 FROM public.integration_connections c
     WHERE c.id = NEW.connection_id AND c.empresa_id = NEW.empresa_id AND c.provider = 'google_workspace'
       AND c.settings->>'customer_id' = NEW.customer_id) THEN
    RAISE EXCEPTION 'connection_mismatch';
  END IF;
  IF NEW.credentials IS NOT NULL AND (TG_OP='INSERT' OR NEW.credentials IS DISTINCT FROM OLD.credentials) THEN
    NEW.credentials := public.cifrar_credenciais(NEW.credentials);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER integration_delegated_guard BEFORE INSERT OR UPDATE ON public.integration_delegated_credentials
FOR EACH ROW EXECUTE FUNCTION public.integration_delegated_guard();

CREATE OR REPLACE FUNCTION public.integration_read_delegated(p_connection uuid, p_empresa uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions','pg_temp' AS $$
DECLARE r public.integration_delegated_credentials;
BEGIN
  SELECT d.* INTO r FROM public.integration_delegated_credentials d
   JOIN public.integration_connections c ON c.id = d.connection_id AND c.empresa_id = d.empresa_id
  WHERE d.connection_id = p_connection AND d.empresa_id = p_empresa AND d.purpose = 'cloud_identity_devices'
    AND c.settings->>'customer_id' = d.customer_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF left(r.credentials,4) <> 'pgp:' THEN RAISE EXCEPTION 'credentials_not_encrypted'; END IF;
  RETURN jsonb_build_object(
    'key', extensions.pgp_sym_decrypt(decode(substr(r.credentials,5),'base64'), public.chave_credenciais_integracao())::jsonb,
    'admin_email', r.admin_email, 'customer_id', r.customer_id);
END $$;
REVOKE ALL ON FUNCTION public.integration_read_delegated(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_read_delegated(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.integration_delegated_guard() FROM public, anon, authenticated;

-- Disconnect also drops the delegated credential.
CREATE OR REPLACE FUNCTION public.integration_change_state(p_id uuid, p_empresa uuid, p_action text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
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
    IF p_action='disconnect' THEN
      DELETE FROM public.integration_delegated_credentials WHERE connection_id=p_id AND empresa_id=p_empresa;
    END IF;
  END IF;
END $function$;