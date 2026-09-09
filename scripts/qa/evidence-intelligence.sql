-- Local-only transactional QA. Existing records are restored by ROLLBACK.
BEGIN;
DO $$
DECLARE tenant uuid; actor uuid; session_key text; evaluation uuid; requirement uuid;
 job jsonb; repeated jsonb; first_job uuid; second_job uuid; third_job uuid; event uuid; before_status text;
 other_actor uuid; fresh_evidence uuid; expired_evidence uuid; evidence_link uuid; original_observations text;
BEGIN
 SELECT p.empresa_id,p.user_id,s.auth_session_id INTO tenant,actor,session_key FROM public.profiles p
 JOIN public.mfa_sessions s ON s.user_id=p.user_id AND s.expires_at>now() WHERE p.ativo AND p.role::text='super_admin' LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'QA requires the existing local authenticated test session'; END IF;
 SELECT id,requirement_id,conformity_status INTO evaluation,requirement,before_status FROM public.gap_analysis_evaluations WHERE empresa_id=tenant LIMIT 1;
 IF evaluation IS NULL THEN RAISE EXCEPTION 'QA requires a local evaluation'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id',session_key)::text,true);
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 job:=public.evidence_analysis_claim(tenant,actor,requirement,'qa-first','sha','qa'); first_job:=(job->'job'->>'id')::uuid;
 repeated:=public.evidence_analysis_claim(tenant,actor,requirement,'qa-first','sha','qa');
 IF NOT (repeated->>'busy')::boolean THEN RAISE EXCEPTION 'duplicate job was not deduplicated'; END IF;
 BEGIN
  PERFORM public.evidence_analysis_finish(first_job,99,'complete','{}'); RAISE EXCEPTION 'wrong attempt unexpectedly accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'lease_lost' THEN RAISE; END IF; END;
 PERFORM public.evidence_analysis_finish(first_job,1,'running',NULL,'{"sources":[]}');
 PERFORM public.evidence_analysis_finish(first_job,1,'complete','{"verdict":"indeterminado"}');
 repeated:=public.evidence_analysis_claim(tenant,actor,requirement,'qa-first','sha','qa');
 IF NOT (repeated->>'cached')::boolean THEN RAISE EXCEPTION 'completed analysis not cached'; END IF;
 job:=public.evidence_analysis_claim(tenant,actor,requirement,'qa-second','sha2','qa'); second_job:=(job->'job'->>'id')::uuid;
 job:=public.evidence_analysis_claim(tenant,actor,requirement,'qa-third','sha3','qa'); third_job:=(job->'job'->>'id')::uuid;
 BEGIN
  PERFORM public.evidence_analysis_claim(tenant,actor,requirement,'qa-fourth','sha4','qa'); RAISE EXCEPTION 'tenant concurrency limit bypassed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'processing_limit' THEN RAISE; END IF; END;
 PERFORM public.evidence_analysis_finish(second_job,1,'error',NULL,'{"sources":[{"text":"checkpoint"}]}','qa');
 job:=public.evidence_analysis_claim(tenant,actor,requirement,'qa-second','sha2','qa');
 IF (job->'job'->>'attempt')::int<>2 OR job->'job'->'checkpoint' IS NULL THEN RAISE EXCEPTION 'checkpoint was not resumed'; END IF;
 event:=public.compliance_record_review(evaluation,'review','QA: fontes conferidas e critérios registrados');
 IF public.compliance_review_state(evaluation)->>'reviewed_at' IS NULL THEN RAISE EXCEPTION 'review not visible'; END IF;
 IF (SELECT conformity_status FROM public.gap_analysis_evaluations WHERE id=evaluation) IS DISTINCT FROM before_status THEN RAISE EXCEPTION 'review changed compliance'; END IF;
 BEGIN
  PERFORM public.compliance_record_review(evaluation,'exception_requested','QA: justificativa suficiente',current_date-1); RAISE EXCEPTION 'expired exception allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_expiry' THEN RAISE; END IF; END;
 event:=public.compliance_record_review(evaluation,'exception_requested','QA: justificativa e controle compensatório',current_date+10);
 BEGIN
  PERFORM public.compliance_record_review(evaluation,'exception_approved','QA: aprovação não permitida',NULL,event); RAISE EXCEPTION 'self approval allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_approver_or_request' THEN RAISE; END IF; END;
 SELECT p.user_id INTO other_actor FROM public.profiles p JOIN auth.users u ON u.id=p.user_id WHERE p.empresa_id=tenant AND p.user_id<>actor AND p.ativo LIMIT 1;
 IF other_actor IS NULL THEN
  -- Isolated request-actor fixture: no password, login or session is created;
  -- this entire transaction (including any profile trigger) is rolled back.
  other_actor:=gen_random_uuid();
  INSERT INTO auth.users(id,email,aud,role,created_at,updated_at) VALUES(other_actor,'qa-evidence-'||other_actor||'@example.invalid','authenticated','authenticated',now(),now());
 END IF;
 -- The request above is our transaction-only fixture. Change its requester to
 -- exercise a separate reviewer without creating an account or altering MFA.
 UPDATE public.compliance_review_events SET actor_id=other_actor WHERE id=event;
 SELECT observacoes INTO original_observations FROM public.gap_analysis_evaluations WHERE id=evaluation;
 UPDATE public.gap_analysis_evaluations SET observacoes='QA: fonte modificada' WHERE id=evaluation;
 IF NOT (public.compliance_review_state(evaluation)->>'changed')::boolean THEN RAISE EXCEPTION 'source changes not detected'; END IF;
 BEGIN
  PERFORM public.compliance_record_review(evaluation,'exception_approved','QA: novas fontes precisam de revisão',NULL,event); RAISE EXCEPTION 'changed sources approved';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'sources_changed' THEN RAISE; END IF; END;
 UPDATE public.gap_analysis_evaluations SET observacoes=original_observations WHERE id=evaluation;
 PERFORM public.compliance_record_review(evaluation,'exception_approved','QA: outro administrador conferiu as fontes',NULL,event);
 IF public.compliance_review_state(evaluation)->'exception'->>'valid_until' IS NULL THEN RAISE EXCEPTION 'approved exception not visible'; END IF;
 BEGIN
  PERFORM public.compliance_record_review(evaluation,'exception_rejected','QA: decisão duplicada proibida',NULL,event); RAISE EXCEPTION 'duplicate decision allowed';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 INSERT INTO public.evidence_library(empresa_id,nome,valido_ate,arquivo_url) VALUES(tenant,'QA evidence - rolled back',current_date+30,tenant||'/qa-fresh.txt') RETURNING id INTO fresh_evidence;
 INSERT INTO public.evidence_library(empresa_id,nome,valido_ate,arquivo_url) VALUES(tenant,'QA expired - rolled back',current_date-1,tenant||'/qa-expired.txt') RETURNING id INTO expired_evidence;
 INSERT INTO public.evidence_library_links(empresa_id,evidence_id,evaluation_id,vinculo_tipo) VALUES(tenant,fresh_evidence,evaluation,'manual') RETURNING id INTO evidence_link;
 IF (SELECT requirement_id FROM public.evidence_library_links WHERE id=evidence_link) IS DISTINCT FROM requirement THEN RAISE EXCEPTION 'legacy link not normalized'; END IF;
 BEGIN
  UPDATE public.evidence_library_links SET evidence_id=expired_evidence WHERE id=evidence_link; RAISE EXCEPTION 'expired evidence replacement allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'expired_evidence' THEN RAISE; END IF; END;
 BEGIN
  INSERT INTO public.evidence_library_links(empresa_id,evidence_id,evaluation_id,vinculo_tipo) VALUES(tenant,expired_evidence,evaluation,'manual'); RAISE EXCEPTION 'expired evidence link allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'expired_evidence' THEN RAISE; END IF; END;
 UPDATE public.evidence_library SET valido_ate=current_date-1 WHERE id=fresh_evidence;
 IF NOT (public.compliance_review_state(evaluation)->>'expired')::boolean THEN RAISE EXCEPTION 'expired evidence not reported'; END IF;
 UPDATE public.evidence_library_links SET updated_at=now() WHERE id=evidence_link;
 BEGIN
  PERFORM public.compliance_review_state(gen_random_uuid()); RAISE EXCEPTION 'unknown evaluation disclosed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'evaluation_missing' THEN RAISE; END IF; END;
 IF public.compliance_module_context() IS NULL THEN RAISE EXCEPTION 'context missing'; END IF;
 EXECUTE 'SET LOCAL ROLE authenticated';
 IF NOT EXISTS(SELECT 1 FROM public.evidence_analysis_jobs WHERE id=first_job) THEN RAISE EXCEPTION 'own tenant analysis invisible'; END IF;
 BEGIN
  UPDATE public.evidence_analysis_jobs SET status='complete' WHERE id=first_job; RAISE EXCEPTION 'direct client write allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","session_id":"invalid"}',true);
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 IF EXISTS(SELECT 1 FROM public.evidence_analysis_jobs WHERE id=first_job) THEN RAISE EXCEPTION 'RLS leaked analysis'; END IF;
 IF EXISTS(SELECT 1 FROM public.compliance_review_events WHERE evaluation_id=evaluation) THEN RAISE EXCEPTION 'RLS leaked review history'; END IF;
 BEGIN
  PERFORM public.compliance_review_state(evaluation); RAISE EXCEPTION 'cross tenant review access allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'forbidden' THEN RAISE; END IF; END;
 EXECUTE 'RESET ROLE';
 RAISE NOTICE 'QA passed: deduplication, cache, leases, checkpoint, fairness, review/approval, source changes, expiry, evidence link integrity and authenticated RLS';
END $$;
ROLLBACK;
