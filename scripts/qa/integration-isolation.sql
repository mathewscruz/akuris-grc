-- Local Supabase only. Assertions use fixtures inside a rolled-back transaction.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='credenciais_integracao_key') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'base64'),'credenciais_integracao_key','QA fixture rolled back');
  END IF;
END $$;
CREATE TEMP TABLE integration_qa_context AS
  SELECT p.user_id,p.empresa_id,gen_random_uuid() AS session_id,gen_random_uuid() AS connection_id,
    (SELECT id FROM public.empresas WHERE id<>p.empresa_id LIMIT 1) AS other_empresa
  FROM public.profiles p JOIN auth.users u ON u.id=p.user_id WHERE p.ativo AND p.empresa_id IS NOT NULL AND p.role::text IN ('admin','super_admin') LIMIT 1;
GRANT SELECT ON integration_qa_context TO authenticated;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM integration_qa_context WHERE other_empresa IS NOT NULL) THEN RAISE EXCEPTION 'Need local admin and two local tenants'; END IF; END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',user_id,'role','authenticated','session_id',session_id)::text,true) IS NOT NULL AS fixture_context FROM integration_qa_context;
INSERT INTO public.integration_connections(id,empresa_id,provider,name,status,created_by,credentials)
  SELECT connection_id,empresa_id,'github','Integration QA','authorized',user_id,'{"access_token":"not-a-real-token"}' FROM integration_qa_context;
DO $$ DECLARE c record; BEGIN
  SELECT * INTO c FROM integration_qa_context;
  IF (SELECT credentials NOT LIKE 'pgp:%' FROM public.integration_connections WHERE id=c.connection_id) THEN RAISE EXCEPTION 'unencrypted credential'; END IF;
  IF public.integration_read_credentials(c.connection_id,c.empresa_id)->>'access_token'<>'not-a-real-token' THEN RAISE EXCEPTION 'decryption failed'; END IF;
  IF public.integration_read_credentials(c.connection_id,c.other_empresa) IS NOT NULL THEN RAISE EXCEPTION 'cross-tenant secret'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.integration_connections WHERE id=(SELECT connection_id FROM integration_qa_context)) THEN RAISE EXCEPTION 'read without MFA'; END IF;
  BEGIN PERFORM credentials FROM public.integration_connections; RAISE EXCEPTION 'credential column exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.integration_read_credentials(gen_random_uuid(),gen_random_uuid()); RAISE EXCEPTION 'credential RPC exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.integration_oauth_states(state_hash,connection_id,user_id,session_id,verifier) VALUES('x',gen_random_uuid(),auth.uid(),gen_random_uuid(),'x'); RAISE EXCEPTION 'browser may write OAuth state'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO public.mfa_sessions(user_id,empresa_id,auth_session_id,expires_at)
  SELECT user_id,empresa_id,session_id::text,now()+interval '10 minutes' FROM integration_qa_context;
INSERT INTO public.integration_connections(empresa_id,provider,name,status,created_by)
  SELECT other_empresa,'github','Other tenant QA','authorized',user_id FROM integration_qa_context;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.integration_connections WHERE id=(SELECT connection_id FROM integration_qa_context))<>1 THEN RAISE EXCEPTION 'own tenant not visible'; END IF;
  IF EXISTS(SELECT 1 FROM public.integration_connections WHERE empresa_id=(SELECT other_empresa FROM integration_qa_context)) THEN RAISE EXCEPTION 'cross-tenant read'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE c record; r uuid; attempt_num integer; second_run uuid; BEGIN
  SELECT * INTO c FROM integration_qa_context;
  r:=public.integration_enqueue(c.connection_id,c.empresa_id);
  IF public.integration_enqueue(c.connection_id,c.empresa_id)<>r THEN RAISE EXCEPTION 'duplicate queued run'; END IF;
  SELECT attempt INTO attempt_num FROM public.integration_claim(r); IF attempt_num<>1 THEN RAISE EXCEPTION 'claim failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.integration_claim(r)) THEN RAISE EXCEPTION 'double claim'; END IF;
  BEGIN PERFORM public.integration_configure(c.connection_id,c.empresa_id,'manual','{}'); RAISE EXCEPTION 'configuration changed mid-run'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'connection_busy' THEN RAISE; END IF; END;
  UPDATE public.integration_runs SET lease_until=now()-interval '1 second' WHERE id=r;
  SELECT attempt INTO attempt_num FROM public.integration_claim(r); IF attempt_num<>2 THEN RAISE EXCEPTION 'lease was not recovered'; END IF;
  IF public.integration_finish_run(r,1,'success',1,NULL,NULL,jsonb_build_object('hash',repeat('a',64),'size',100)) THEN RAISE EXCEPTION 'stale worker finalized new attempt'; END IF;
  IF EXISTS(SELECT 1 FROM public.evidence_library WHERE id=r) THEN RAISE EXCEPTION 'stale attempt published evidence'; END IF;
  IF NOT public.integration_finish_run(r,2,'success',1,NULL,NULL,jsonb_build_object('hash',repeat('b',64),'size',123)) THEN RAISE EXCEPTION 'current worker cannot finalize'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.evidence_library WHERE id=r AND empresa_id=c.empresa_id AND arquivo_hash=repeat('b',64) AND arquivo_url=c.empresa_id::text||'/integrations/'||r::text||'-2.json') THEN RAISE EXCEPTION 'evidence was not published atomically'; END IF;
  IF public.integration_finish_run(r,2,'success',1,NULL,NULL,jsonb_build_object('hash',repeat('c',64),'size',321)) THEN RAISE EXCEPTION 'finalized evidence overwritten'; END IF;
  IF (SELECT last_success_at IS NULL FROM public.integration_connections WHERE id=c.connection_id) THEN RAISE EXCEPTION 'success not recorded'; END IF;
  second_run:=public.integration_enqueue(c.connection_id,c.empresa_id);
  IF second_run=r THEN RAISE EXCEPTION 'completed run reused'; END IF;
  PERFORM public.integration_change_state(c.connection_id,c.empresa_id,'disconnect');
  IF (SELECT credentials IS NOT NULL FROM public.integration_connections WHERE id=c.connection_id) THEN RAISE EXCEPTION 'disconnect retained token'; END IF;
  IF (SELECT count(*) FROM public.integration_runs WHERE connection_id=c.connection_id)<>2 THEN RAISE EXCEPTION 'disconnect removed history'; END IF;
  BEGIN PERFORM public.integration_enqueue(c.connection_id,c.empresa_id); RAISE EXCEPTION 'disconnected connection enqueued'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'connection_not_authorized' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
SELECT 'PASS: encryption, MFA, tenant isolation, deduplication, leases, atomic evidence, scope lock and disconnect history' AS result;
