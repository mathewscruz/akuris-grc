-- LOCAL ONLY: non-login fixtures, no emails or model calls; every change rolls back.
BEGIN;
DO $$
DECLARE ta uuid:=gen_random_uuid(); tb uuid:=gen_random_uuid(); ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid();
 pa uuid:=gen_random_uuid(); pb uuid:=gen_random_uuid(); product uuid; other_product uuid; version uuid; version2 uuid; catalog uuid;
 assessment uuid; assessment2 uuid; item uuid; finding uuid; evidence uuid; foreign_evidence uuid; evidence_link uuid; action uuid;
 snapshot_before jsonb; answer jsonb; role_name text; scope_class text; expected_count int; count_rows bigint; j jsonb; map_record record;
BEGIN
 INSERT INTO public.empresas(id,nome) VALUES(ta,'CRA workflow QA A - rollback'),(tb,'CRA workflow QA B - rollback');
 INSERT INTO auth.users(id,email,aud,role,created_at,updated_at) VALUES(ua,'cra-workflow-'||ua||'@example.invalid','authenticated','authenticated',now(),now()),(ub,'cra-workflow-'||ub||'@example.invalid','authenticated','authenticated',now(),now());
 INSERT INTO public.profiles(id,user_id,empresa_id,nome,email,role,ativo,preferred_locale) VALUES(pa,ua,ta,'CRA QA A','cra-workflow-a@example.invalid','user',true,'pt'),(pb,ub,tb,'CRA QA B','cra-workflow-b@example.invalid','user',true,'pt');
 INSERT INTO public.user_module_permissions(user_id,module_id,can_access,can_create,can_read,can_update,can_delete)
 SELECT u,m.id,true,true,true,true,false FROM unnest(ARRAY[ua,ub]) u CROSS JOIN public.system_modules m WHERE m.name IN ('gap-analysis','planos-acao')
 ON CONFLICT(user_id,module_id) DO UPDATE SET can_access=true,can_create=true,can_read=true,can_update=true;
 INSERT INTO public.mfa_sessions(user_id,empresa_id,auth_session_id,expires_at) VALUES(ua,ta,'cra-workflow-a',now()+interval '1 hour'),(ub,tb,'cra-workflow-b',now()+interval '1 hour');
 INSERT INTO public.products(empresa_id,name,product_type) VALUES(tb,'Other product','software') RETURNING id INTO other_product;
 INSERT INTO public.evidence_library(empresa_id,nome,link_externo) VALUES(tb,'Other evidence','https://example.invalid/private') RETURNING id INTO foreign_evidence;
 SELECT id INTO STRICT catalog FROM public.regulatory_framework_versions WHERE framework_id='a8c1f2d4-2929-4292-8292-000000002847';
 SELECT jsonb_object_agg(k,'no') INTO answer FROM unnest(ARRAY['digital','connected','commercial','eu_market','installed','desktop','mobile','device','required_cloud','cybersecurity','authentication','iam','endpoint','monitoring','networks','develops','imports','distributes','represents','noncommercial_oss','steward','sector_exclusion','substantial_modification','own_brand']) k;
 answer:=answer||'{"digital":"yes","connected":"yes","commercial":"yes","eu_market":"yes","installed":"yes","primary_category":"other"}';
 IF public.regulatory_cra_triage(answer)->>'applicability'<>'likely_applicable' THEN RAISE EXCEPTION 'triage_applicable'; END IF;
 IF public.regulatory_cra_triage(answer||'{"eu_market":"no"}')->>'applicability'<>'likely_not_applicable' THEN RAISE EXCEPTION 'triage_outside_eu'; END IF;
 IF public.regulatory_cra_triage(answer||'{"sector_exclusion":"unknown"}')->>'applicability'<>'legal_review_required' THEN RAISE EXCEPTION 'triage_uncertainty'; END IF;
 BEGIN PERFORM public.regulatory_cra_triage('{}'); RAISE EXCEPTION 'incomplete_triage_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'incomplete_applicability_answers' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ua,'role','authenticated','session_id','cra-workflow-a')::text,true);
 PERFORM set_config('request.jwt.claim.sub',ua::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 INSERT INTO public.products(empresa_id,name,product_type,product_owner_id) VALUES(ta,'QA Gateway','software',pa) RETURNING id INTO product;
 INSERT INTO public.product_versions(empresa_id,product_id,version) VALUES(ta,product,'1.0') RETURNING id INTO version;
 INSERT INTO public.product_versions(empresa_id,product_id,version) VALUES(ta,product,'2.0') RETURNING id INTO version2;
 -- Every economic role gets its own obligations, not a manufacturer questionnaire.
 FOREACH role_name IN ARRAY ARRAY['manufacturer','importer','distributor','authorised_representative'] LOOP
  FOREACH scope_class IN ARRAY ARRAY['default','important_class_i'] LOOP
   INSERT INTO public.regulatory_assessments(empresa_id,product_id,product_version_id,framework_version_id,name,answers,roles,applicability,classification,decision_rationale)
   VALUES(ta,product,version,catalog,'QA '||role_name||' '||scope_class,answer,ARRAY[role_name],'likely_applicable',scope_class,'Human-reviewed scope for local transactional testing.') RETURNING id INTO assessment;
   expected_count:=CASE role_name WHEN 'manufacturer' THEN CASE scope_class WHEN 'default' THEN 23 ELSE 24 END WHEN 'importer' THEN 4 WHEN 'distributor' THEN 3 ELSE 2 END;
   IF (SELECT count(*) FROM public.regulatory_assessment_items WHERE assessment_id=assessment)<>expected_count THEN RAISE EXCEPTION 'requirement_selection_failed: %/%',role_name,scope_class; END IF;
   IF (SELECT count(*) FROM public.regulatory_reporting_workflows WHERE assessment_id=assessment)<>2 THEN RAISE EXCEPTION 'reporting_not_seeded'; END IF;
  END LOOP;
 END LOOP;
 INSERT INTO public.regulatory_assessments(empresa_id,product_id,product_version_id,framework_version_id,name,answers,roles,applicability,classification,decision_rationale)
 VALUES(ta,product,version,catalog,'QA main',answer,ARRAY['manufacturer'],'likely_applicable','default','Human-reviewed scope for local transactional testing.') RETURNING id INTO assessment;
 INSERT INTO public.regulatory_assessments(empresa_id,product_id,product_version_id,framework_version_id,name,answers,roles,applicability,classification,decision_rationale)
 VALUES(ta,product,version2,catalog,'QA release two',answer,ARRAY['manufacturer'],'likely_applicable','default','Separate release must never inherit answers.') RETURNING id INTO assessment2;
 SELECT id,snapshot INTO STRICT item,snapshot_before FROM public.regulatory_assessment_items WHERE assessment_id=assessment ORDER BY id LIMIT 1;
 IF public.regulatory_readiness(assessment)->'score'<>'null'::jsonb THEN RAISE EXCEPTION 'empty_score_not_null'; END IF;
 IF EXISTS(SELECT 1 FROM public.regulatory_assessment_items WHERE assessment_id=assessment AND reviewed_at IS NOT NULL) THEN RAISE EXCEPTION 'unassessed_marked_reviewed'; END IF;
 BEGIN UPDATE public.regulatory_assessment_items SET status='conforme' WHERE id=item; RAISE EXCEPTION 'unjustified_response'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'assessment_justification_required' THEN RAISE; END IF; END;
 UPDATE public.regulatory_assessment_items SET status='parcial',notes='Policy exists but operation records are missing.',owner_id=pa,due_on=current_date+30 WHERE id=item;
 SELECT id INTO STRICT finding FROM public.regulatory_findings WHERE item_id=item;
 UPDATE public.regulatory_assessment_items SET notes='Policy exists but reviewed operation records remain missing.' WHERE id=item;
 IF (SELECT count(*) FROM public.regulatory_findings WHERE item_id=item)<>1 THEN RAISE EXCEPTION 'duplicate_finding'; END IF;
 IF (public.regulatory_readiness(assessment)->>'score')::numeric<>50 THEN RAISE EXCEPTION 'weighted_score'; END IF;
 IF EXISTS(SELECT 1 FROM public.regulatory_assessment_items WHERE assessment_id=assessment2 AND status<>'nao_avaliado') THEN RAISE EXCEPTION 'version_response_leak'; END IF;
 BEGIN UPDATE public.regulatory_assessment_items SET snapshot='{}' WHERE id=item; RAISE EXCEPTION 'client_snapshot_write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.regulatory_assessments SET classification='critical' WHERE id=assessment; RAISE EXCEPTION 'scope_overwritten'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.regulatory_assessments SET status='review_ready' WHERE id=assessment; RAISE EXCEPTION 'pending_marked_ready'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'pending_assessment_items' THEN RAISE; END IF; END;
 INSERT INTO public.evidence_library(empresa_id,nome,link_externo) VALUES(ta,'CRA QA policy','https://example.invalid/policy') RETURNING id INTO evidence;
 INSERT INTO public.regulatory_evidence_links(empresa_id,product_id,item_id,evidence_id) VALUES(ta,product,item,evidence) RETURNING id INTO evidence_link;
 UPDATE public.regulatory_evidence_links SET review_status='accepted',comment='Reviewed against this product version.',owner_id=pa,evidence_date=current_date,valid_until=current_date+365 WHERE id=evidence_link;
 IF (SELECT status FROM public.regulatory_assessment_items WHERE id=item)<>'parcial' THEN RAISE EXCEPTION 'evidence_auto_compliance'; END IF;
 BEGIN INSERT INTO public.regulatory_evidence_links(empresa_id,product_id,item_id,evidence_id) VALUES(ta,product,item,foreign_evidence); RAISE EXCEPTION 'cross_tenant_evidence'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_evidence_context' THEN RAISE; END IF; END;
 BEGIN UPDATE public.regulatory_evidence_links SET owner_id=pb WHERE id=evidence_link; RAISE EXCEPTION 'cross_tenant_owner'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_product_owner' THEN RAISE; END IF; END;
 action:=public.regulatory_create_action(finding,'Create missing records','Collect and review execution records for the product.',ua,current_date+30);
 IF public.regulatory_create_action(finding,'Create missing records','Retry same request',ua,current_date+30)<>action THEN RAISE EXCEPTION 'duplicate_action'; END IF;
 BEGIN UPDATE public.regulatory_findings SET status='risk_accepted',decision_note='' WHERE id=finding; RAISE EXCEPTION 'risk_acceptance_without_reason'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'finding_decision_required' THEN RAISE; END IF; END;
 UPDATE public.regulatory_findings SET status='completed',decision_note='Implementation completed; evidence still needs independent review.' WHERE id=finding;
 IF (SELECT status FROM public.regulatory_assessment_items WHERE id=item)<>'parcial' THEN RAISE EXCEPTION 'action_auto_compliance'; END IF;
 UPDATE public.regulatory_assessment_items SET status='conforme',notes='Evidence reviewed in this scope with operational samples.' WHERE id=item;
 IF (SELECT status FROM public.regulatory_findings WHERE id=finding)<>'resolved' THEN RAISE EXCEPTION 'finding_not_resolved'; END IF;
 UPDATE public.regulatory_assessment_items SET status='nao_conforme',notes='Reassessment identified failed implementation.' WHERE id=item;
 IF (SELECT status FROM public.regulatory_findings WHERE id=finding)<>'open' THEN RAISE EXCEPTION 'finding_not_reopened'; END IF;
 IF (SELECT count(*) FROM public.regulatory_assessment_scores WHERE assessment_id=assessment)<>4 THEN RAISE EXCEPTION 'score_history_missing'; END IF;
 UPDATE public.regulatory_evidence_links SET removed_at=now() WHERE id=evidence_link;
 IF NOT EXISTS(SELECT 1 FROM public.evidence_library WHERE id=evidence) THEN RAISE EXCEPTION 'unlink_deleted_library_file'; END IF;
 BEGIN UPDATE public.regulatory_evidence_links SET removed_at=NULL WHERE id=evidence_link; RAISE EXCEPTION 'removed_link_resurrected'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'removed_evidence_is_immutable' THEN RAISE; END IF; END;
 UPDATE public.regulatory_reporting_workflows SET responsible_team='QA Incident Response',initial_procedure='Escalate to PSIRT without undue delay.' WHERE assessment_id=assessment;
 UPDATE public.regulatory_assessments SET status='archived' WHERE id=assessment;
 BEGIN UPDATE public.regulatory_assessment_items SET notes='Forbidden after archive' WHERE id=item; RAISE EXCEPTION 'archived_write'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'assessment_archived' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM public.regulatory_audit_events WHERE entity_id=item AND old_value->>'status'='parcial' AND new_value->>'status'='conforme') THEN RAISE EXCEPTION 'response_audit_missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.regulatory_audit_events WHERE empresa_id=ta AND (new_value ? 'notes' OR new_value ? 'comment')) THEN RAISE EXCEPTION 'sensitive_log_content'; END IF;
 EXECUTE 'RESET ROLE';
 -- Real RLS: a different tenant cannot read/write any workflow row.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ub,'role','authenticated','session_id','cra-workflow-b')::text,true);PERFORM set_config('request.jwt.claim.sub',ub::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 IF EXISTS(SELECT 1 FROM public.regulatory_assessments WHERE id=assessment) OR EXISTS(SELECT 1 FROM public.regulatory_assessment_items WHERE id=item) OR EXISTS(SELECT 1 FROM public.regulatory_findings WHERE id=finding) OR EXISTS(SELECT 1 FROM public.regulatory_evidence_links WHERE id=evidence_link) OR EXISTS(SELECT 1 FROM public.regulatory_assessment_scores WHERE assessment_id=assessment) THEN RAISE EXCEPTION 'cross_tenant_read'; END IF;
 UPDATE public.regulatory_assessment_items SET status='conforme',notes='Foreign override' WHERE id=item;GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>0 THEN RAISE EXCEPTION 'cross_tenant_update'; END IF;
 BEGIN PERFORM public.regulatory_create_action(finding,'Unauthorized action','Must not be allowed',ub,NULL);RAISE EXCEPTION 'cross_tenant_action';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'finding_not_found' THEN RAISE;END IF;END;
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ua,'role','authenticated','session_id','wrong-session')::text,true);PERFORM set_config('request.jwt.claim.sub',ua::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';IF EXISTS(SELECT 1 FROM public.regulatory_assessments WHERE id=assessment) THEN RAISE EXCEPTION 'mfa_bypass';END IF;EXECUTE 'RESET ROLE';
 RAISE NOTICE 'CRA workflow QA passed: role/class selection, product/version isolation, scores/history, evidence, findings, actions, archive, RLS and MFA.';
END $$;
ROLLBACK;
