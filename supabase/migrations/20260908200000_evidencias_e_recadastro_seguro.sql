-- All extensions are accepted only in private, authenticated evidence buckets.
-- Preserve existing per-bucket/global size limits and all object RLS policies.
UPDATE storage.buckets SET allowed_mime_types = NULL, public = false
WHERE id IN ('gap-evidence-library', 'controles-evidencias', 'auditoria-evidencias');

-- Server-owned provenance for a profile removed while its Auth identity remains.
-- Never trust user_metadata or an email address to establish previous tenancy.
CREATE TABLE IF NOT EXISTS public.removed_user_registrations (
  user_id uuid PRIMARY KEY,
  empresa_id uuid,
  previous_role public.user_role NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.removed_user_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.removed_user_registrations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.removed_user_registrations TO service_role;

CREATE OR REPLACE FUNCTION public.remember_removed_user_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.removed_user_registrations(user_id, empresa_id, previous_role, removed_at)
  VALUES (OLD.user_id, OLD.empresa_id, OLD.role, now())
  ON CONFLICT (user_id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id,
    previous_role = EXCLUDED.previous_role, removed_at = EXCLUDED.removed_at;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.remember_removed_user_registration() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS remember_removed_user_registration ON public.profiles;
CREATE TRIGGER remember_removed_user_registration
BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.remember_removed_user_registration();

-- Exact, case-insensitive lookup; no first-page limit and no directory disclosure.
CREATE OR REPLACE FUNCTION public.find_registration_auth_user(p_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id FROM auth.users
  WHERE auth.role() = 'service_role' AND lower(email) = lower(btrim(p_email))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_registration_auth_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_registration_auth_user(text) TO service_role;

-- Profile + permissions + role change are one transaction. Called only by the
-- authenticated/MFA-protected create-user endpoint, never directly by the browser.
CREATE OR REPLACE FUNCTION public.provision_user_registration(
  p_actor_id uuid, p_session_id text, p_user_id uuid, p_email text, p_nome text,
  p_role public.user_role, p_empresa_id uuid, p_permission_profile_id uuid,
  p_new_auth boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_existing public.profiles%ROWTYPE;
  v_previous public.removed_user_registrations%ROWTYPE;
  v_profile_empresa uuid;
  v_limit integer;
  v_count integer;
  v_has_profile boolean;
  v_auth_email text;
  v_banned_until timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_actor FROM public.profiles WHERE user_id = p_actor_id AND ativo = true FOR SHARE;
  IF NOT FOUND OR v_actor.role NOT IN ('admin', 'super_admin') OR NOT EXISTS (
    SELECT 1 FROM public.mfa_sessions WHERE user_id = p_actor_id
      AND auth_session_id = p_session_id AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = p_actor_id OR p_role IS NULL
     OR nullif(btrim(p_nome), '') IS NULL OR length(p_nome) > 160
     OR nullif(btrim(p_email), '') IS NULL OR length(p_email) > 254
     OR (p_role <> 'super_admin' AND p_empresa_id IS NULL) THEN
    RAISE EXCEPTION 'INVALID_REGISTRATION';
  END IF;
  IF v_actor.role <> 'super_admin' AND (
    p_role = 'super_admin' OR p_empresa_id IS DISTINCT FROM v_actor.empresa_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)), 208));
  SELECT email, banned_until INTO v_auth_email, v_banned_until FROM auth.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR lower(v_auth_email) IS DISTINCT FROM lower(btrim(p_email)) THEN
    RAISE EXCEPTION 'INVALID_REGISTRATION';
  END IF;
  IF v_banned_until > now() THEN RAISE EXCEPTION 'USER_ACCOUNT_REVIEW_REQUIRED'; END IF;
  SELECT * INTO v_existing FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
  v_has_profile := FOUND;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = lower(btrim(p_email)) AND user_id <> p_user_id)
     OR (v_has_profile AND v_existing.ativo) THEN
    RAISE EXCEPTION 'DUPLICATE_USER';
  END IF;
  IF v_has_profile THEN
    -- Even a super admin must not silently transfer an existing account.
    IF v_existing.empresa_id IS DISTINCT FROM p_empresa_id
       OR (v_actor.role <> 'super_admin' AND v_existing.role = 'super_admin') THEN
      RAISE EXCEPTION 'USER_ACCOUNT_REVIEW_REQUIRED';
    END IF;
  ELSIF NOT p_new_auth THEN
    SELECT * INTO v_previous FROM public.removed_user_registrations WHERE user_id = p_user_id;
    IF v_actor.role <> 'super_admin' AND (
      NOT FOUND OR v_previous.empresa_id IS DISTINCT FROM p_empresa_id OR v_previous.previous_role = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'USER_ACCOUNT_REVIEW_REQUIRED';
    END IF;
    IF FOUND AND v_previous.empresa_id IS DISTINCT FROM p_empresa_id THEN
      RAISE EXCEPTION 'USER_ACCOUNT_REVIEW_REQUIRED';
    END IF;
  END IF;

  IF p_empresa_id IS NOT NULL THEN
    -- Serialize seat allocation. Restoring an inactive profile uses its existing seat.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text, 209));
    SELECT pl.limite_usuarios INTO v_limit FROM public.empresas e
      LEFT JOIN public.planos pl ON pl.id = e.plano_id WHERE e.id = p_empresa_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_REGISTRATION'; END IF;
    SELECT count(*) INTO v_count FROM public.profiles WHERE empresa_id = p_empresa_id;
    IF NOT v_has_profile AND v_limit > 0 AND v_count >= v_limit THEN
      RAISE EXCEPTION 'USER_LIMIT_REACHED';
    END IF;
  END IF;
  IF p_permission_profile_id IS NOT NULL THEN
    SELECT empresa_id INTO v_profile_empresa FROM public.permission_profiles WHERE id = p_permission_profile_id;
    IF NOT FOUND OR (v_profile_empresa IS NOT NULL AND v_profile_empresa IS DISTINCT FROM p_empresa_id) THEN
      RAISE EXCEPTION 'INVALID_PERMISSION_PROFILE';
    END IF;
  END IF;

  IF v_has_profile THEN
    UPDATE public.profiles SET nome = btrim(p_nome), email = lower(btrim(p_email)), role = p_role,
      ativo = true, permission_profile_id = p_permission_profile_id, invitation_link = NULL
    WHERE user_id = p_user_id;
  ELSE
    INSERT INTO public.profiles(user_id, nome, email, role, empresa_id, ativo, permission_profile_id)
    VALUES (p_user_id, btrim(p_nome), lower(btrim(p_email)), p_role, p_empresa_id, true, p_permission_profile_id);
  END IF;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles(user_id, role)
    VALUES (p_user_id, (CASE WHEN p_role = 'readonly' THEN 'user' ELSE p_role::text END)::public.app_role);
  DELETE FROM public.user_module_permissions WHERE user_id = p_user_id;
  IF p_permission_profile_id IS NULL THEN
    PERFORM public.apply_default_permissions_for_user(p_user_id);
  ELSE
    PERFORM public.apply_permission_profile(p_user_id, p_permission_profile_id);
  END IF;
  -- Old application MFA sessions cannot authorize a restored account.
  -- Passwords, Auth factors and sessions are not reset or returned to the admin.
  DELETE FROM public.mfa_sessions WHERE user_id = p_user_id;
  DELETE FROM public.mfa_codes WHERE user_id = p_user_id;
  DELETE FROM public.temporary_passwords WHERE user_id = p_user_id;
  DELETE FROM public.removed_user_registrations WHERE user_id = p_user_id;
  RETURN jsonb_build_object('user_id', p_user_id, 'restored', NOT p_new_auth);
END;
$$;
REVOKE ALL ON FUNCTION public.provision_user_registration(uuid,text,uuid,text,text,public.user_role,uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_user_registration(uuid,text,uuid,text,text,public.user_role,uuid,uuid,boolean) TO service_role;
