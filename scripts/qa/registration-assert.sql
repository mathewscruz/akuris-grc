-- Synthetic records inside a rollback-only transaction on an isolated local clone.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() NOT LIKE 'akuris_qa_registration_%' THEN
    RAISE EXCEPTION 'Use an isolated akuris_qa_registration_* database';
  END IF;
END $$;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

CREATE FUNCTION pg_temp.provision(actor uuid, target uuid, company uuid, new_auth boolean DEFAULT false,
  target_role public.user_role DEFAULT 'user', permission_profile uuid DEFAULT NULL, session_id text DEFAULT 'qa-session')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.provision_user_registration(actor, session_id, target,
    (SELECT email FROM auth.users WHERE id=target), 'QA restored', target_role, company, permission_profile, new_auth);
$$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN actual := SQLERRM; END;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Expected %, got %', expected, coalesce(actual, 'success'); END IF;
END;
$$;

DO $$
DECLARE
  root_id uuid := gen_random_uuid(); admin_a uuid := gen_random_uuid(); admin_b uuid := gen_random_uuid();
  company_a uuid := gen_random_uuid(); company_b uuid := gen_random_uuid(); plan_id uuid := gen_random_uuid();
  target uuid := gen_random_uuid(); orphan uuid := gen_random_uuid(); inactive uuid := gen_random_uuid();
  fresh uuid := gen_random_uuid(); blocked uuid := gen_random_uuid(); other_profile uuid := gen_random_uuid();
  old_profile_id uuid; result jsonb; v_id uuid; n integer;
BEGIN
  INSERT INTO public.system_modules(name,display_name,is_active) VALUES ('qa_registration_module','QA module',true);
  INSERT INTO public.planos(id,nome,codigo,creditos_franquia,limite_usuarios) VALUES (plan_id,'QA registration','qa-registration-test',0,100);
  INSERT INTO public.empresas(id,nome,plano_id) VALUES (company_a,'QA A',plan_id),(company_b,'QA B',plan_id);
  FOREACH v_id IN ARRAY ARRAY[root_id,admin_a,admin_b,target,orphan,inactive,fresh,blocked] LOOP
    INSERT INTO auth.users(id,email,encrypted_password,raw_user_meta_data,raw_app_meta_data)
      VALUES(v_id,v_id::text || '@example.test','password-must-remain', '{"admin_created":"true"}','{}');
  END LOOP;
  INSERT INTO public.profiles(user_id,nome,email,role,empresa_id) VALUES
    (root_id,'QA root',root_id::text || '@example.test','super_admin',company_a),
    (admin_a,'QA admin A',admin_a::text || '@example.test','admin',company_a),
    (admin_b,'QA admin B',admin_b::text || '@example.test','admin',company_b),
    (target,'QA active',target::text || '@example.test','user',company_a),
    (inactive,'QA inactive',inactive::text || '@example.test','user',company_a);
  UPDATE public.profiles SET ativo=false WHERE user_id=inactive;
  SELECT id INTO old_profile_id FROM public.profiles WHERE user_id=inactive;
  INSERT INTO public.mfa_sessions(user_id,empresa_id,auth_session_id,expires_at) VALUES
    (root_id,company_a,'qa-session',now()+interval '1 hour'),
    (admin_a,company_a,'qa-session',now()+interval '1 hour'),
    (admin_b,company_b,'qa-session',now()+interval '1 hour'),
    (inactive,company_a,'old-session',now()+interval '1 hour');

  -- Exact lookup, independently of directory size and email case.
  IF public.find_registration_auth_user(' ' || upper(target::text || '@example.test') || ' ') IS DISTINCT FROM target THEN
    RAISE EXCEPTION 'Case insensitive lookup failed';
  END IF;
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.provision(%L,%L,%L)',admin_a,target,company_a),'DUPLICATE_USER');
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.provision(%L,%L,%L,false,''user'',NULL,''wrong-session'')',admin_a,inactive,company_a),'FORBIDDEN');
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.provision(%L,%L,%L)',admin_b,inactive,company_a),'FORBIDDEN');
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.provision(%L,%L,%L)',root_id,inactive,company_b),'USER_ACCOUNT_REVIEW_REQUIRED');
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.provision(%L,%L,%L,false,''super_admin'')',admin_a,inactive,company_a),'FORBIDDEN');

  -- Inactive seat can be restored even when the plan is already at its limit.
  UPDATE public.planos SET limite_usuarios=(SELECT count(*) FROM public.profiles WHERE empresa_id=company_a) WHERE id=plan_id;
  result := pg_temp.provision(admin_a,inactive,company_a);
  IF result->>'restored' <> 'true' OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=inactive AND id=old_profile_id AND ativo) THEN
    RAISE EXCEPTION 'Inactive profile restoration lost its identity';
  END IF;
  IF EXISTS(SELECT 1 FROM public.mfa_sessions WHERE user_id=inactive) THEN RAISE EXCEPTION 'Stale MFA session survived'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_module_permissions WHERE user_id=inactive) THEN RAISE EXCEPTION 'Permissions missing'; END IF;
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.provision(%L,%L,%L,true)',admin_a,fresh,company_a),'USER_LIMIT_REACHED');
  IF EXISTS(SELECT 1 FROM public.profiles WHERE user_id=fresh) THEN RAISE EXCEPTION 'Failed transaction leaked a profile'; END IF;
  UPDATE public.planos SET limite_usuarios=100 WHERE id=plan_id;

  -- Deleted profile leaves trusted tenant provenance; reuses Auth identity.
  DELETE FROM public.profiles WHERE user_id=target;
  IF NOT EXISTS(SELECT 1 FROM public.removed_user_registrations WHERE user_id=target AND empresa_id=company_a) THEN
    RAISE EXCEPTION 'Removal provenance was not saved';
  END IF;
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.provision(%L,%L,%L)',admin_b,target,company_b),'USER_ACCOUNT_REVIEW_REQUIRED');
  result := pg_temp.provision(admin_a,target,company_a);
  IF result->>'restored' <> 'true' THEN RAISE EXCEPTION 'Deleted user was not restored'; END IF;
  IF EXISTS(SELECT 1 FROM public.removed_user_registrations WHERE user_id=target) THEN RAISE EXCEPTION 'Stale provenance'; END IF;

  -- Legacy orphan: never adopted by a company admin without trusted history.
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.provision(%L,%L,%L)',admin_a,orphan,company_a),'USER_ACCOUNT_REVIEW_REQUIRED');
  PERFORM pg_temp.provision(root_id,orphan,company_a);
  INSERT INTO public.permission_profiles(id,empresa_id,name) VALUES(other_profile,company_b,'QA other tenant');
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.provision(%L,%L,%L,true,''user'',%L)',admin_a,fresh,company_a,other_profile),'INVALID_PERMISSION_PROFILE');
  IF EXISTS(SELECT 1 FROM public.profiles WHERE user_id=fresh) THEN RAISE EXCEPTION 'Permission validation was not atomic'; END IF;
  UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id=blocked;
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.provision(%L,%L,%L)',root_id,blocked,company_a),'USER_ACCOUNT_REVIEW_REQUIRED');

  -- No new account adoption, credential reset or old admin-role resurrection.
  result := pg_temp.provision(admin_a,fresh,company_a,true);
  IF result->>'restored' <> 'false' THEN RAISE EXCEPTION 'New user reported as restored'; END IF;
  UPDATE public.profiles SET ativo=false WHERE user_id=inactive;
  INSERT INTO public.user_roles(user_id,role) VALUES(inactive,'super_admin') ON CONFLICT DO NOTHING;
  PERFORM pg_temp.provision(root_id,inactive,company_a,false,'readonly');
  SELECT count(*) INTO n FROM public.user_roles WHERE user_id=inactive;
  IF n<>1 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=inactive AND role='user') THEN RAISE EXCEPTION 'Stale RBAC survived'; END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE id IN(target,orphan,inactive,fresh) AND encrypted_password <> 'password-must-remain') THEN
    RAISE EXCEPTION 'Credential changed';
  END IF;

  -- Authenticated JWT claims cannot invoke the service-only provisioning path.
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.provision(%L,%L,%L)',root_id,orphan,company_a),'FORBIDDEN');
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  IF has_function_privilege('authenticated','public.find_registration_auth_user(text)','EXECUTE')
    OR has_function_privilege('anon','public.provision_user_registration(uuid,text,uuid,text,text,public.user_role,uuid,uuid,boolean)','EXECUTE')
    OR has_table_privilege('authenticated','public.removed_user_registrations','SELECT') THEN
    RAISE EXCEPTION 'Private provisioning surface exposed';
  END IF;
  RAISE NOTICE 'PASS: duplicate, MFA, tenant isolation, inactive seat, deletion/re-registration, legacy orphan, ban, new user, RBAC, credentials and private RPCs';
END $$;
ROLLBACK;
