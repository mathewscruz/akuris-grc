-- LOCAL ONLY. Requires regulatory foundation/catalog/input-guard migrations.
-- All users/tenants/sessions here are non-login transactional fixtures, rolled back.
BEGIN;
DO $$
DECLARE
  tenant_a uuid:=gen_random_uuid(); tenant_b uuid:=gen_random_uuid();
  actor_a uuid:=gen_random_uuid(); actor_b uuid:=gen_random_uuid();
  profile_a uuid:=gen_random_uuid(); profile_b uuid:=gen_random_uuid();
  product_a uuid; product_b uuid; version_a uuid; event_id uuid; private_framework uuid;
  invalid_entry jsonb;
  module uuid; cra uuid:='a8c1f2d4-2929-4292-8292-000000002847';
  cra_requirement uuid; cra_version uuid; other_requirement uuid; other_framework uuid; legacy_evaluation uuid;
  old_evaluations bigint; old_frameworks bigint; result_count bigint;
BEGIN
  SELECT count(*) INTO old_evaluations FROM public.gap_analysis_evaluations;
  SELECT count(*) INTO old_frameworks FROM public.gap_analysis_frameworks;
  SELECT id INTO STRICT module FROM public.system_modules WHERE name='gap-analysis';
  SELECT id INTO STRICT cra_version FROM public.regulatory_framework_versions WHERE framework_id=cra;
  SELECT id INTO cra_requirement FROM public.gap_analysis_requirements WHERE framework_id=cra LIMIT 1;
  SELECT r.id,r.framework_id INTO other_requirement,other_framework FROM public.gap_analysis_requirements r
    JOIN public.gap_analysis_frameworks f ON f.id=r.framework_id
    WHERE r.framework_id<>cra AND f.empresa_id IS NULL AND f.is_template LIMIT 1;
  IF (SELECT count(*) FROM public.regulatory_domains WHERE framework_version_id=cra_version)<>22
    OR (SELECT count(*) FROM public.regulatory_requirement_definitions WHERE framework_version_id=cra_version)<>30
    OR (SELECT count(*) FROM public.control_framework_mappings WHERE framework_version_id=cra_version)<>30
    THEN RAISE EXCEPTION 'incomplete_catalog'; END IF;
  IF EXISTS(SELECT 1 FROM public.gap_analysis_frameworks WHERE id<>cra AND (assessment_scope<>'organization' OR rollout_status<>'active'))
    THEN RAISE EXCEPTION 'legacy_framework_changed'; END IF;

  -- A global map cannot pretend a requirement belongs to another framework version.
  BEGIN
    INSERT INTO public.control_framework_mappings(control_id,requirement_id,framework_version_id,mapping_strength,mapping_notes,source_url)
    SELECT control_id,other_requirement,cra_version,'full','This mapping must not be allowed','https://example.invalid'
    FROM public.control_framework_mappings WHERE framework_version_id=cra_version LIMIT 1;
    RAISE EXCEPTION 'mismatched_framework_allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'regulatory_framework_mismatch' THEN RAISE; END IF; END;

  INSERT INTO public.empresas(id,nome) VALUES(tenant_a,'CRA QA A - rollback'),(tenant_b,'CRA QA B - rollback');
  INSERT INTO auth.users(id,email,aud,role,created_at,updated_at)
    VALUES(actor_a,'cra-a-'||actor_a||'@example.invalid','authenticated','authenticated',now(),now()),
          (actor_b,'cra-b-'||actor_b||'@example.invalid','authenticated','authenticated',now(),now());
  INSERT INTO public.profiles(id,user_id,empresa_id,nome,email,role,ativo,preferred_locale)
    VALUES(profile_a,actor_a,tenant_a,'CRA QA A','cra-a@example.invalid','user',true,'pt'),
          (profile_b,actor_b,tenant_b,'CRA QA B','cra-b@example.invalid','user',true,'pt');
  INSERT INTO public.user_module_permissions(user_id,module_id,can_access,can_create,can_read,can_update,can_delete)
    VALUES(actor_a,module,true,true,true,true,false),(actor_b,module,true,true,true,true,false)
    ON CONFLICT(user_id,module_id) DO UPDATE SET can_access=true,can_create=true,can_read=true,can_update=true,can_delete=false;
  INSERT INTO public.mfa_sessions(user_id,empresa_id,auth_session_id,expires_at)
    VALUES(actor_a,tenant_a,'cra-qa-a',now()+interval '1 hour'),(actor_b,tenant_b,'cra-qa-b',now()+interval '1 hour');
  INSERT INTO public.products(empresa_id,name,product_type) VALUES(tenant_b,'Other tenant product','software') RETURNING id INTO product_b;

  INSERT INTO public.gap_analysis_frameworks(nome,versao,tipo,empresa_id,is_template)
    VALUES('CRA QA private','1','personalizado',tenant_a,false) RETURNING id INTO private_framework;
  BEGIN
    INSERT INTO public.regulatory_framework_versions(framework_id,version,jurisdiction,legal_instrument,source_url,verified_on,coverage_note)
      VALUES(private_framework,'1','EU','QA','https://example.invalid',current_date,'Must not expose tenant content');
    RAISE EXCEPTION 'private_framework_exposed_in_global_catalog';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'global_framework_required' THEN RAISE; END IF; END;
  DELETE FROM public.gap_analysis_frameworks WHERE id=private_framework;
  BEGIN
    UPDATE public.regulatory_framework_versions SET version='rewritten' WHERE id=cra_version;
    RAISE EXCEPTION 'regulatory_version_rewritten';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'immutable_regulatory_version' THEN RAISE; END IF; END;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_a,'role','authenticated','session_id','cra-qa-a')::text,true);
  PERFORM set_config('request.jwt.claim.sub',actor_a::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF NOT public.has_valid_mfa_session() OR NOT public.usuario_tem_permissao_modulo('gap-analysis','create') THEN RAISE EXCEPTION 'invalid_qa_context'; END IF;
  IF EXISTS(SELECT 1 FROM public.gap_analysis_frameworks WHERE id=cra) THEN RAISE EXCEPTION 'draft_visible_in_legacy_catalog'; END IF;
  IF EXISTS(SELECT 1 FROM public.gap_analysis_requirements WHERE framework_id=cra) THEN RAISE EXCEPTION 'draft_requirements_visible'; END IF;
  -- Existing organization assessments remain writable with the same context.
  INSERT INTO public.gap_analysis_evaluations(empresa_id,framework_id,requirement_id,conformity_status)
    VALUES(tenant_a,other_framework,other_requirement,'nao_avaliado') RETURNING id INTO legacy_evaluation;
  UPDATE public.gap_analysis_evaluations SET conformity_status='parcial' WHERE id=legacy_evaluation;
  IF NOT EXISTS(SELECT 1 FROM public.gap_analysis_evaluations WHERE id=legacy_evaluation AND conformity_status='parcial')
    THEN RAISE EXCEPTION 'legacy_evaluation_write_regression'; END IF;
  DELETE FROM public.gap_analysis_evaluations WHERE id=legacy_evaluation;
  BEGIN
    INSERT INTO public.gap_analysis_evaluations(empresa_id,framework_id,requirement_id,conformity_status)
      VALUES(tenant_a,cra,cra_requirement,'conforme');
    RAISE EXCEPTION 'cra_organization_evaluation_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.universal_controls(code,name,name_en,domain,description,description_en)
      VALUES('AK-FAKE-001','Fake','Fake','fake','fake','fake');
    RAISE EXCEPTION 'client_catalog_write_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  INSERT INTO public.products(empresa_id,name,product_type,product_owner_id,created_by)
    VALUES(tenant_a,'My product','software',profile_a,actor_b) RETURNING id INTO product_a;
  IF (SELECT created_by FROM public.products WHERE id=product_a)<>actor_a THEN RAISE EXCEPTION 'spoofed_creator'; END IF;
  FOR invalid_entry IN SELECT jsonb_array_elements('[null,123,{},"https://token@git.example/repo","https://git.example/repo?token=secret","https://git.example:99999/repo","HTTPS://git.example:99999/repo","https://git.example/repo name"]'::jsonb) LOOP
    BEGIN
      UPDATE public.products SET repositories=jsonb_build_array(invalid_entry) WHERE id=product_a;
      RAISE EXCEPTION 'invalid_repository_accepted';
    EXCEPTION WHEN check_violation THEN NULL; END;
  END LOOP;
  BEGIN
    UPDATE public.products SET markets='[""]'::jsonb WHERE id=product_a;
    RAISE EXCEPTION 'empty_market_accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.products SET repositories='["https://git.example/team/product"]'::jsonb,description='QA content not copied into audit',markets='["Portugal"]'::jsonb WHERE id=product_a;
  IF NOT EXISTS(SELECT 1 FROM public.regulatory_audit_events WHERE entity_id=product_a
    AND changed_fields @> ARRAY['repositories','description']
    AND NOT new_value ? 'repositories' AND NOT new_value ? 'description') THEN RAISE EXCEPTION 'redacted_change_not_tracked'; END IF;
  IF EXISTS(SELECT 1 FROM public.products WHERE id=product_b) THEN RAISE EXCEPTION 'cross_tenant_read'; END IF;
  UPDATE public.products SET name='Forbidden' WHERE id=product_b;
  GET DIAGNOSTICS result_count=ROW_COUNT;
  IF result_count<>0 THEN RAISE EXCEPTION 'cross_tenant_update'; END IF;
  BEGIN
    INSERT INTO public.products(empresa_id,name,product_type) VALUES(tenant_b,'Forbidden','software');
    RAISE EXCEPTION 'cross_tenant_insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.products SET security_owner_id=profile_b WHERE id=product_a;
    RAISE EXCEPTION 'cross_tenant_owner';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_product_owner' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.products SET empresa_id=tenant_b WHERE id=product_a;
    RAISE EXCEPTION 'tenant_reassignment';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'immutable_regulatory_identity' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.product_versions(empresa_id,product_id,version) VALUES(tenant_a,product_b,'1.0');
    RAISE EXCEPTION 'cross_tenant_product_version';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  INSERT INTO public.product_versions(empresa_id,product_id,version,release_date,support_ends_on)
    VALUES(tenant_a,product_a,'1.0','2026-09-29','2028-09-29') RETURNING id INTO version_a;
  -- Shorter expected lifetimes are not automatically invalidated by a five-year rule.
  BEGIN
    UPDATE public.product_versions SET version='2.0' WHERE id=version_a;
    RAISE EXCEPTION 'version_identity_rewritten';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'immutable_product_version' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.product_versions(empresa_id,product_id,version,release_date,support_ends_on)
      VALUES(tenant_a,product_a,'invalid','2027-01-01','2026-01-01');
    RAISE EXCEPTION 'invalid_support_dates';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.products SET name='My updated product' WHERE id=product_a;
  SELECT id INTO event_id FROM public.regulatory_audit_events WHERE entity_id=product_a AND action='UPDATE'
    AND actor_id=actor_a AND old_value->>'name'='My product' AND new_value->>'name'='My updated product';
  IF event_id IS NULL THEN RAISE EXCEPTION 'audit_missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.regulatory_audit_events WHERE empresa_id=tenant_b) THEN RAISE EXCEPTION 'audit_cross_tenant_read'; END IF;
  BEGIN
    DELETE FROM public.regulatory_audit_events WHERE id=event_id;
    RAISE EXCEPTION 'audit_delete_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.products WHERE id=product_a;
    RAISE EXCEPTION 'hard_delete_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  EXECUTE 'RESET ROLE';
  UPDATE public.user_module_permissions SET can_create=false,can_update=false WHERE user_id=actor_a AND module_id=module;
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=product_a) THEN RAISE EXCEPTION 'readonly_cannot_read'; END IF;
  BEGIN
    INSERT INTO public.products(empresa_id,name,product_type) VALUES(tenant_a,'Readonly cannot create','software');
    RAISE EXCEPTION 'readonly_created';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.products SET name='Readonly cannot update' WHERE id=product_a;
  GET DIAGNOSTICS result_count=ROW_COUNT;
  IF result_count<>0 THEN RAISE EXCEPTION 'readonly_updated'; END IF;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_a,'role','authenticated','session_id','invalid')::text,true);
  IF EXISTS(SELECT 1 FROM public.products) OR EXISTS(SELECT 1 FROM public.regulatory_audit_events)
    OR EXISTS(SELECT 1 FROM public.universal_controls) THEN RAISE EXCEPTION 'mfa_bypassed'; END IF;
  EXECUTE 'RESET ROLE';
  UPDATE public.profiles SET ativo=false WHERE id=profile_a;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_a,'role','authenticated','session_id','cra-qa-a')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF EXISTS(SELECT 1 FROM public.products) OR EXISTS(SELECT 1 FROM public.universal_controls)
    THEN RAISE EXCEPTION 'inactive_profile_access'; END IF;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM 1 FROM public.products;
    RAISE EXCEPTION 'anonymous_products_access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM 1 FROM public.universal_controls;
    RAISE EXCEPTION 'anonymous_catalog_access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE 'RESET ROLE';
  IF (SELECT count(*) FROM public.gap_analysis_evaluations)<>old_evaluations
    OR (SELECT count(*) FROM public.gap_analysis_frameworks)<>old_frameworks THEN RAISE EXCEPTION 'legacy_data_changed'; END IF;
  RAISE NOTICE 'CRA foundation QA passed: catalog, legacy gate, RBAC, MFA, tenant FKs, ownership, version identity, support dates and protected audit';
END $$;
ROLLBACK;
