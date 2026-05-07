
-- 1) profiles.invitation_link: revoke column SELECT
REVOKE SELECT (invitation_link) ON public.profiles FROM anon, authenticated;

-- 2) denuncias: rewrite broad policy to token-only path
DROP POLICY IF EXISTS "View denuncia by token or auth" ON public.denuncias;
CREATE POLICY "View denuncia by public token"
ON public.denuncias
FOR SELECT
TO anon, authenticated
USING (
  token_publico IS NOT NULL
  AND token_publico = ((current_setting('request.headers'::text, true))::json ->> 'x-token-publico'::text)
);
-- Admins/responsavel policy continues to grant authenticated empresa-scoped access

-- 3) api_keys: hide raw key column from clients
REVOKE SELECT (api_key) ON public.api_keys FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_api_key_full(_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  IF NOT public.is_admin_or_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT api_key INTO v_key
  FROM public.api_keys
  WHERE id = _id
    AND empresa_id = public.get_user_empresa_id();
  RETURN v_key;
END;
$$;
REVOKE ALL ON FUNCTION public.get_api_key_full(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_api_key_full(uuid) TO authenticated;

-- 4) asset_agents: hide agent_token column
REVOKE SELECT (agent_token) ON public.asset_agents FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_agent_token(_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT public.is_admin_or_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT agent_token INTO v_token
  FROM public.asset_agents
  WHERE id = _id
    AND empresa_id = public.get_user_empresa_id();
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.get_agent_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agent_token(uuid) TO authenticated;

-- 5) api_inbound_webhooks: restrict to admins
DROP POLICY IF EXISTS "Empresa pode gerenciar seus webhooks de entrada" ON public.api_inbound_webhooks;
CREATE POLICY "Admins manage inbound webhooks"
ON public.api_inbound_webhooks
FOR ALL
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND public.is_admin_or_super_admin()
)
WITH CHECK (
  empresa_id = public.get_user_empresa_id()
  AND public.is_admin_or_super_admin()
);

-- 6) integracoes_config: restrict SELECT to admins
DROP POLICY IF EXISTS "Users can view integrations from their empresa" ON public.integracoes_config;
CREATE POLICY "Admins view integrations from their empresa"
ON public.integracoes_config
FOR SELECT
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND public.is_admin_or_super_admin()
);

-- 7) gap_analysis_frameworks: require authentication for SELECT
DROP POLICY IF EXISTS "Users can view global frameworks" ON public.gap_analysis_frameworks;
DROP POLICY IF EXISTS "Users can view global and company frameworks" ON public.gap_analysis_frameworks;
CREATE POLICY "Authenticated can view global and company frameworks"
ON public.gap_analysis_frameworks
FOR SELECT
TO authenticated
USING (
  empresa_id IS NULL
  OR empresa_id = public.get_user_empresa_id()
);
