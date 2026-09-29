BEGIN;
SET LOCAL lock_timeout='5s';

CREATE TABLE public.regulatory_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  product_id uuid NOT NULL,
  product_version_id uuid NOT NULL,
  framework_version_id uuid NOT NULL REFERENCES public.regulatory_framework_versions(id),
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 3 AND 200),
  answers jsonb NOT NULL CHECK(jsonb_typeof(answers)='object' AND octet_length(answers::text)<20000),
  roles text[] NOT NULL CHECK(cardinality(roles) BETWEEN 1 AND 4 AND roles <@ ARRAY['manufacturer','importer','distributor','authorised_representative']),
  preliminary jsonb NOT NULL DEFAULT '{}',
  applicability text NOT NULL CHECK(applicability IN ('likely_applicable','potentially_applicable','likely_not_applicable','legal_review_required')),
  classification text NOT NULL CHECK(classification IN ('default','important_class_i','important_class_ii','critical','review_required')),
  decision_rationale text NOT NULL CHECK(length(btrim(decision_rationale)) BETWEEN 20 AND 6000),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','review_ready','archived')),
  scope_note text NOT NULL DEFAULT 'Initial readiness baseline; not certification or an exhaustive legal assessment.',
  revision integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,empresa_id,product_id),
  FOREIGN KEY(product_id,empresa_id) REFERENCES public.products(id,empresa_id),
  FOREIGN KEY(product_version_id,product_id,empresa_id) REFERENCES public.product_versions(id,product_id,empresa_id)
);
CREATE INDEX regulatory_assessments_tenant ON public.regulatory_assessments(empresa_id,created_at DESC,id);
CREATE INDEX regulatory_assessments_product ON public.regulatory_assessments(product_id,empresa_id);
CREATE INDEX regulatory_assessments_version ON public.regulatory_assessments(product_version_id,product_id,empresa_id);
CREATE INDEX regulatory_assessments_framework ON public.regulatory_assessments(framework_version_id);
CREATE INDEX regulatory_assessments_author ON public.regulatory_assessments(created_by);
CREATE INDEX regulatory_assessments_reviewer ON public.regulatory_assessments(reviewed_by);

CREATE TABLE public.regulatory_assessment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  product_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  requirement_id uuid NOT NULL REFERENCES public.gap_analysis_requirements(id),
  snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'nao_avaliado' CHECK(status IN ('conforme','parcial','nao_conforme','nao_aplicavel','nao_avaliado')),
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=16000),
  owner_id uuid REFERENCES public.profiles(id),
  due_on date,
  revision integer NOT NULL DEFAULT 1,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assessment_id,requirement_id), UNIQUE(id,empresa_id,product_id),
  FOREIGN KEY(assessment_id,empresa_id,product_id) REFERENCES public.regulatory_assessments(id,empresa_id,product_id)
);
CREATE INDEX regulatory_items_tenant ON public.regulatory_assessment_items(empresa_id,assessment_id);
CREATE INDEX regulatory_items_requirement ON public.regulatory_assessment_items(requirement_id);
CREATE INDEX regulatory_items_owner ON public.regulatory_assessment_items(owner_id);
CREATE INDEX regulatory_items_reviewer ON public.regulatory_assessment_items(reviewed_by);

CREATE TABLE public.regulatory_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL, product_id uuid NOT NULL,
  item_id uuid NOT NULL, evidence_id uuid NOT NULL REFERENCES public.evidence_library(id) ON DELETE RESTRICT,
  owner_id uuid REFERENCES public.profiles(id), evidence_date date, valid_until date,
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK(review_status IN ('unreviewed','accepted','rejected')),
  comment text NOT NULL DEFAULT '' CHECK(length(comment)<=6000),
  reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz,
  removed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(item_id,empresa_id,product_id) REFERENCES public.regulatory_assessment_items(id,empresa_id,product_id),
  CHECK(valid_until IS NULL OR evidence_date IS NULL OR valid_until>=evidence_date)
);
CREATE UNIQUE INDEX regulatory_evidence_active ON public.regulatory_evidence_links(item_id,evidence_id) WHERE removed_at IS NULL;
CREATE INDEX regulatory_evidence_tenant ON public.regulatory_evidence_links(empresa_id,item_id);
CREATE INDEX regulatory_evidence_library ON public.regulatory_evidence_links(evidence_id);
CREATE INDEX regulatory_evidence_owner ON public.regulatory_evidence_links(owner_id);
CREATE INDEX regulatory_evidence_reviewer ON public.regulatory_evidence_links(reviewed_by);

CREATE TABLE public.regulatory_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL, product_id uuid NOT NULL,
  item_id uuid NOT NULL UNIQUE,
  title text NOT NULL, description text NOT NULL DEFAULT '', impact text NOT NULL DEFAULT '',
  recommendation text NOT NULL DEFAULT '', missing_evidence text NOT NULL DEFAULT '',
  risk text NOT NULL CHECK(risk IN ('low','medium','high','critical')),
  owner_id uuid REFERENCES public.profiles(id), due_on date,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','planned','in_progress','pending_evidence','ready_for_review','completed','risk_accepted','resolved')),
  decision_note text NOT NULL DEFAULT '' CHECK(length(decision_note)<=6000),
  department text NOT NULL DEFAULT '' CHECK(length(department)<=300),
  action_plan_id uuid REFERENCES public.planos_acao(id) ON DELETE RESTRICT,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(item_id,empresa_id,product_id) REFERENCES public.regulatory_assessment_items(id,empresa_id,product_id),
  CHECK(length(title)<=300 AND length(description)<=16000 AND length(impact)<=8000 AND length(recommendation)<=8000 AND length(missing_evidence)<=8000)
);
CREATE INDEX regulatory_findings_tenant ON public.regulatory_findings(empresa_id,status,product_id);
CREATE INDEX regulatory_findings_owner ON public.regulatory_findings(owner_id);
CREATE INDEX regulatory_findings_plan ON public.regulatory_findings(action_plan_id);

CREATE TABLE public.regulatory_sboms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL, product_id uuid NOT NULL, product_version_id uuid NOT NULL,
  evidence_id uuid NOT NULL REFERENCES public.evidence_library(id) ON DELETE RESTRICT,
  format text NOT NULL CHECK(format IN ('CycloneDX','SPDX')), spec_version text NOT NULL CHECK(length(spec_version)<30),
  component_count integer NOT NULL CHECK(component_count BETWEEN 0 AND 100000),
  tool text NOT NULL DEFAULT '' CHECK(length(tool)<500), generated_at timestamptz,
  validation_note text NOT NULL DEFAULT 'Structural metadata validation only; not a vulnerability scan or full specification certification.',
  status text NOT NULL DEFAULT 'uploaded' CHECK(status IN ('uploaded','reviewed','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_version_id,evidence_id),
  FOREIGN KEY(product_version_id,product_id,empresa_id) REFERENCES public.product_versions(id,product_id,empresa_id)
);
CREATE INDEX regulatory_sboms_tenant ON public.regulatory_sboms(empresa_id,product_id);
CREATE INDEX regulatory_sboms_evidence ON public.regulatory_sboms(evidence_id);

CREATE TABLE public.regulatory_reporting_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL, product_id uuid NOT NULL, assessment_id uuid NOT NULL,
  event_type text NOT NULL CHECK(event_type IN ('exploited_vulnerability','severe_incident')),
  responsible_team text NOT NULL DEFAULT '' CHECK(length(responsible_team)<=500),
  psirt text NOT NULL DEFAULT '' CHECK(length(psirt)<=500), legal_contact text NOT NULL DEFAULT '' CHECK(length(legal_contact)<=500),
  management_contact text NOT NULL DEFAULT '' CHECK(length(management_contact)<=500),
  initial_procedure text NOT NULL DEFAULT '' CHECK(length(initial_procedure)<=4000),
  detailed_procedure text NOT NULL DEFAULT '' CHECK(length(detailed_procedure)<=4000),
  final_procedure text NOT NULL DEFAULT '' CHECK(length(final_procedure)<=4000),
  last_exercise_on date, notes text NOT NULL DEFAULT '' CHECK(length(notes)<=6000),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assessment_id,event_type),
  FOREIGN KEY(assessment_id,empresa_id,product_id) REFERENCES public.regulatory_assessments(id,empresa_id,product_id)
);
CREATE INDEX regulatory_reporting_tenant ON public.regulatory_reporting_workflows(empresa_id,assessment_id);

-- Deterministic preliminary decision: human decision/rationale is stored separately.
CREATE FUNCTION public.regulatory_cra_triage(a jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE k text; result text; category text;
BEGIN
  FOREACH k IN ARRAY ARRAY['digital','connected','commercial','eu_market','installed','desktop','mobile','device','required_cloud','cybersecurity','authentication','iam','endpoint','monitoring','networks','develops','imports','distributes','represents','noncommercial_oss','steward','sector_exclusion','substantial_modification','own_brand'] LOOP
    IF a->>k IS NULL OR a->>k NOT IN ('yes','no','unknown') THEN RAISE EXCEPTION 'incomplete_applicability_answers'; END IF;
  END LOOP;
  category:=a->>'primary_category';
  IF category IS NULL OR category NOT IN ('other','annex_iii_i','annex_iii_ii','annex_iv','unknown') THEN RAISE EXCEPTION 'invalid_primary_category'; END IF;
  IF a->>'sector_exclusion'<>'no' OR a->>'steward'='yes' OR (a->>'installed'='no' AND a->>'desktop'='no' AND a->>'mobile'='no' AND a->>'device'='no' AND a->>'required_cloud'<>'yes') THEN result:='legal_review_required';
  ELSIF a->>'digital'='no' OR a->>'connected'='no' OR a->>'eu_market'='no' OR (a->>'noncommercial_oss'='yes' AND a->>'commercial'='no') THEN result:='likely_not_applicable';
  ELSIF a->>'digital'='yes' AND a->>'connected'='yes' AND a->>'commercial'='yes' AND a->>'eu_market'='yes' AND a->>'noncommercial_oss'<>'unknown' THEN result:='likely_applicable';
  ELSE result:='potentially_applicable'; END IF;
  RETURN jsonb_build_object('rules_version','cra-triage-2026-09-29.1','applicability',result,
    'classification',CASE category WHEN 'other' THEN 'default' WHEN 'annex_iii_i' THEN 'important_class_i' WHEN 'annex_iii_ii' THEN 'important_class_ii' WHEN 'annex_iv' THEN 'critical' ELSE 'review_required' END,
    'manufacturer_review',a->>'own_brand'='yes' OR a->>'substantial_modification'='yes',
    'source','https://eur-lex.europa.eu/eli/reg/2024/2847/oj');
END $$;
REVOKE ALL ON FUNCTION public.regulatory_cra_triage(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.regulatory_cra_triage(jsonb) TO authenticated,service_role;

CREATE FUNCTION public.regulatory_workflow_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE parent public.regulatory_assessments; entity jsonb; role_key text;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.empresa_id<>OLD.empresa_id OR NEW.product_id<>OLD.product_id) THEN RAISE EXCEPTION 'immutable_regulatory_identity'; END IF;
  entity:=to_jsonb(NEW);
  IF entity->>'owner_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=(entity->>'owner_id')::uuid AND empresa_id=NEW.empresa_id AND ativo) THEN RAISE EXCEPTION 'invalid_product_owner'; END IF;
  IF TG_TABLE_NAME='regulatory_assessments' THEN
    IF TG_OP='UPDATE' AND (NEW.product_version_id<>OLD.product_version_id OR NEW.framework_version_id<>OLD.framework_version_id OR NEW.roles<>OLD.roles OR NEW.classification<>OLD.classification) THEN RAISE EXCEPTION 'new_assessment_required_for_scope_change'; END IF;
    NEW.preliminary:=public.regulatory_cra_triage(NEW.answers);
    IF (NEW.preliminary->>'manufacturer_review')::boolean AND NOT 'manufacturer'=ANY(NEW.roles) THEN RAISE EXCEPTION 'manufacturer_role_review_required'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=NEW.product_id AND empresa_id=NEW.empresa_id AND status='active') THEN RAISE EXCEPTION 'inactive_product'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.product_versions WHERE id=NEW.product_version_id AND empresa_id=NEW.empresa_id AND lifecycle_status<>'archived') THEN RAISE EXCEPTION 'inactive_product_version'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.regulatory_framework_versions WHERE id=NEW.framework_version_id AND status IN ('draft','active')) THEN RAISE EXCEPTION 'framework_version_unavailable'; END IF;
    NEW.reviewed_by:=auth.uid(); NEW.reviewed_at:=now();
    IF TG_OP='INSERT' THEN NEW.created_by:=auth.uid(); NEW.revision:=1;
    ELSE NEW.created_by:=OLD.created_by; NEW.revision:=OLD.revision+1; END IF;
  ELSE
    IF entity->>'assessment_id' IS NOT NULL THEN
      SELECT * INTO parent FROM public.regulatory_assessments WHERE id=(entity->>'assessment_id')::uuid AND empresa_id=NEW.empresa_id;
    ELSIF entity->>'item_id' IS NOT NULL THEN
      SELECT a.* INTO parent FROM public.regulatory_assessments a JOIN public.regulatory_assessment_items i ON i.assessment_id=a.id WHERE i.id=(entity->>'item_id')::uuid AND a.empresa_id=NEW.empresa_id;
    END IF;
    IF TG_OP='UPDATE' AND ((entity->>'assessment_id') IS DISTINCT FROM (to_jsonb(OLD)->>'assessment_id') OR (entity->>'item_id') IS DISTINCT FROM (to_jsonb(OLD)->>'item_id')) THEN RAISE EXCEPTION 'immutable_assessment_context'; END IF;
    IF parent.status='archived' THEN RAISE EXCEPTION 'assessment_archived'; END IF;
    IF TG_TABLE_NAME='regulatory_assessment_items' THEN
      IF TG_OP='UPDATE' AND (NEW.snapshot<>OLD.snapshot OR NEW.requirement_id<>OLD.requirement_id) THEN RAISE EXCEPTION 'immutable_requirement_snapshot'; END IF;
      IF NEW.status<>'nao_avaliado' AND length(btrim(NEW.notes))<10 THEN RAISE EXCEPTION 'assessment_justification_required'; END IF;
      IF TG_OP='UPDATE' THEN NEW.revision:=OLD.revision+1; END IF;
      NEW.reviewed_by:=auth.uid(); NEW.reviewed_at:=now();
    ELSIF TG_TABLE_NAME IN ('regulatory_evidence_links','regulatory_sboms') THEN
      IF NOT EXISTS(SELECT 1 FROM public.evidence_library WHERE id=NEW.evidence_id AND empresa_id=NEW.empresa_id) THEN RAISE EXCEPTION 'invalid_evidence_context'; END IF;
      IF TG_OP='UPDATE' AND NEW.evidence_id<>OLD.evidence_id THEN RAISE EXCEPTION 'immutable_evidence_reference'; END IF;
      IF TG_TABLE_NAME='regulatory_evidence_links' THEN
        IF NEW.review_status<>'unreviewed' THEN NEW.reviewed_by:=auth.uid(); NEW.reviewed_at:=now(); END IF;
        IF NEW.removed_at IS NOT NULL THEN NEW.removed_at:=now(); END IF;
      ELSE
        IF TG_OP='UPDATE' AND NEW.product_version_id<>OLD.product_version_id THEN RAISE EXCEPTION 'immutable_product_version'; END IF;
      END IF;
    ELSIF TG_TABLE_NAME='regulatory_findings' THEN
      IF NEW.action_plan_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.planos_acao WHERE id=NEW.action_plan_id AND empresa_id=NEW.empresa_id) THEN RAISE EXCEPTION 'invalid_remediation_context'; END IF;
      IF NEW.status IN ('risk_accepted','completed') AND length(btrim(NEW.decision_note))<20 THEN RAISE EXCEPTION 'finding_decision_required'; END IF;
      IF TG_OP='UPDATE' THEN NEW.revision:=OLD.revision+1; END IF;
    END IF;
  END IF;
  IF TG_OP='INSERT' THEN NEW.created_at:=now(); ELSE NEW.created_at:=OLD.created_at; END IF;
  NEW.updated_at:=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.regulatory_workflow_integrity() FROM PUBLIC,anon,authenticated;

-- Trigger-only helpers write derived snapshots/findings; clients cannot forge them.
CREATE FUNCTION regulatory_private.seed_assessment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authenticated_assessment_required'; END IF;
  INSERT INTO public.regulatory_assessment_items(empresa_id,product_id,assessment_id,requirement_id,snapshot)
  SELECT NEW.empresa_id,NEW.product_id,NEW.id,r.id,
    jsonb_build_object('code',r.codigo,'title',r.titulo,'title_en',r.titulo_en,'domain',d.code,'domain_name',d.name,'domain_name_en',d.name_en,
      'description',r.descricao,'description_en',r.descricao_en,'question',def.assessment_question,'question_en',def.assessment_question_en,
      'guidance',r.orientacao_implementacao,'guidance_en',r.orientacao_implementacao_en,'evidence',r.exemplos_evidencias,'evidence_en',r.exemplos_evidencias_en,
      'weight',r.peso,'criticality',def.criticality,'risk',def.risk_level,'remediation',def.remediation_guidance,'remediation_en',def.remediation_guidance_en,
      'legal_reference',def.legal_reference,'source_url',def.source_url,'order',r.ordem,
      'controls',(SELECT jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'strength',m.mapping_strength)) FROM public.control_framework_mappings m JOIN public.universal_controls c ON c.id=m.control_id WHERE m.requirement_id=r.id))
  FROM public.regulatory_requirement_definitions def
  JOIN public.gap_analysis_requirements r ON r.id=def.requirement_id
  JOIN public.regulatory_domains d ON d.id=def.domain_id
  WHERE def.framework_version_id=NEW.framework_version_id AND def.review_status<>'retired'
    AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(def.applicability_rule->'roles') role WHERE role=ANY(NEW.roles))
    AND def.applicability_rule->'categories' ? NEW.classification;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_requirements_for_scope'; END IF;
  INSERT INTO public.regulatory_reporting_workflows(empresa_id,product_id,assessment_id,event_type)
    SELECT NEW.empresa_id,NEW.product_id,NEW.id,event FROM unnest(ARRAY['exploited_vulnerability','severe_incident']) event;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION regulatory_private.seed_assessment() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER regulatory_assessment_seed AFTER INSERT ON public.regulatory_assessments FOR EACH ROW EXECUTE FUNCTION regulatory_private.seed_assessment();

CREATE FUNCTION regulatory_private.sync_finding() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authenticated_review_required'; END IF;
  IF NEW.status IN ('parcial','nao_conforme') THEN
    INSERT INTO public.regulatory_findings(empresa_id,product_id,item_id,title,description,risk,recommendation,missing_evidence,owner_id,due_on)
    VALUES(NEW.empresa_id,NEW.product_id,NEW.id,NEW.snapshot->>'title',NEW.notes,NEW.snapshot->>'risk',NEW.snapshot->>'remediation',NEW.snapshot->>'evidence',NEW.owner_id,NEW.due_on)
    ON CONFLICT(item_id) DO UPDATE SET description=EXCLUDED.description,
      status=CASE WHEN regulatory_findings.status IN ('resolved','completed') THEN 'open' ELSE regulatory_findings.status END,
      updated_at=now();
  ELSE
    UPDATE public.regulatory_findings SET status=CASE WHEN NEW.status IN ('conforme','nao_aplicavel') THEN 'resolved' ELSE 'ready_for_review' END
      WHERE item_id=NEW.id AND status<>'risk_accepted';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION regulatory_private.sync_finding() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER regulatory_item_finding AFTER UPDATE OF status,notes ON public.regulatory_assessment_items FOR EACH ROW EXECUTE FUNCTION regulatory_private.sync_finding();

DO $$ DECLARE relation text; BEGIN
  FOREACH relation IN ARRAY ARRAY['regulatory_assessments','regulatory_assessment_items','regulatory_evidence_links','regulatory_findings','regulatory_sboms','regulatory_reporting_workflows'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',relation);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',relation);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',relation);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',relation);
    EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING (empresa_id=(SELECT public.get_user_empresa_id()) AND (SELECT public.has_valid_mfa_session()) AND (SELECT public.usuario_tem_permissao_modulo(''gap-analysis'',''read'')))',relation);
    EXECUTE format('CREATE POLICY tenant_create ON public.%I FOR INSERT TO authenticated WITH CHECK (empresa_id=(SELECT public.get_user_empresa_id()) AND (SELECT public.has_valid_mfa_session()) AND (SELECT public.usuario_tem_permissao_modulo(''gap-analysis'',''create'')))',relation);
    EXECUTE format('CREATE POLICY tenant_update ON public.%I FOR UPDATE TO authenticated USING (empresa_id=(SELECT public.get_user_empresa_id()) AND (SELECT public.has_valid_mfa_session()) AND (SELECT public.usuario_tem_permissao_modulo(''gap-analysis'',''update''))) WITH CHECK (empresa_id=(SELECT public.get_user_empresa_id()) AND (SELECT public.has_valid_mfa_session()) AND (SELECT public.usuario_tem_permissao_modulo(''gap-analysis'',''update'')))',relation);
    EXECUTE format('CREATE TRIGGER regulatory_integrity BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.regulatory_workflow_integrity()',relation);
    EXECUTE format('CREATE TRIGGER regulatory_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION regulatory_private.audit_product_change()',relation);
  END LOOP;
END $$;
GRANT INSERT ON public.regulatory_assessments,public.regulatory_evidence_links,public.regulatory_sboms TO authenticated;
GRANT UPDATE(name,answers,applicability,decision_rationale,status) ON public.regulatory_assessments TO authenticated;
GRANT UPDATE(status,notes,owner_id,due_on) ON public.regulatory_assessment_items TO authenticated;
GRANT UPDATE(owner_id,evidence_date,valid_until,review_status,comment,removed_at) ON public.regulatory_evidence_links TO authenticated;
GRANT UPDATE(title,description,impact,recommendation,missing_evidence,risk,owner_id,due_on,status,decision_note,department,action_plan_id) ON public.regulatory_findings TO authenticated;
GRANT UPDATE(status) ON public.regulatory_sboms TO authenticated;
GRANT UPDATE(responsible_team,psirt,legal_contact,management_contact,initial_procedure,detailed_procedure,final_procedure,last_exercise_on,notes) ON public.regulatory_reporting_workflows TO authenticated;

-- Derived metrics use invoker RLS; pending answers do not inflate maturity.
CREATE FUNCTION public.regulatory_readiness(p_assessment uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('method','assessed_weighted_v1','total',count(*),
    'assessed',count(*) FILTER(WHERE status IN ('conforme','parcial','nao_conforme')),
    'pending',count(*) FILTER(WHERE status='nao_avaliado'), 'not_applicable',count(*) FILTER(WHERE status='nao_aplicavel'),
    'score',round(sum(CASE status WHEN 'conforme' THEN 100 WHEN 'parcial' THEN 50 WHEN 'nao_conforme' THEN 0 END * (snapshot->>'weight')::numeric) /
      NULLIF(sum((snapshot->>'weight')::numeric) FILTER(WHERE status IN ('conforme','parcial','nao_conforme')),0),1))
    FROM public.regulatory_assessment_items WHERE assessment_id=p_assessment;
$$;
REVOKE ALL ON FUNCTION public.regulatory_readiness(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.regulatory_readiness(uuid) TO authenticated,service_role;

CREATE FUNCTION public.regulatory_create_action(p_finding uuid,p_title text,p_description text,p_owner uuid,p_due date)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE finding public.regulatory_findings; action_id uuid;
BEGIN
  IF NOT public.has_valid_mfa_session() OR NOT public.usuario_tem_permissao_modulo('gap-analysis','update') OR NOT public.usuario_tem_permissao_modulo('planos-acao','create') THEN RAISE insufficient_privilege; END IF;
  SELECT * INTO finding FROM public.regulatory_findings WHERE id=p_finding FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'finding_not_found'; END IF;
  IF finding.action_plan_id IS NOT NULL THEN RETURN finding.action_plan_id; END IF;
  IF length(btrim(p_title)) NOT BETWEEN 3 AND 200 OR length(p_description)>16000 THEN RAISE EXCEPTION 'invalid_action'; END IF;
  IF p_owner IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=p_owner AND empresa_id=finding.empresa_id AND ativo) THEN RAISE EXCEPTION 'invalid_action_owner'; END IF;
  INSERT INTO public.planos_acao(empresa_id,titulo,descricao,responsavel_id,prazo,prioridade,status,modulo_origem,registro_origem_id,registro_origem_titulo,created_by,tags)
    VALUES(finding.empresa_id,p_title,p_description,p_owner,p_due,CASE finding.risk WHEN 'critical' THEN 'critica' WHEN 'high' THEN 'alta' WHEN 'medium' THEN 'media' ELSE 'baixa' END,'pendente','manual',NULL,'CRA · '||finding.title,auth.uid(),ARRAY['CRA',finding.id::text]) RETURNING id INTO action_id;
  UPDATE public.regulatory_findings SET action_plan_id=action_id,status='planned' WHERE id=finding.id;
  RETURN action_id;
END $$;
REVOKE ALL ON FUNCTION public.regulatory_create_action(uuid,text,text,uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.regulatory_create_action(uuid,text,text,uuid,date) TO authenticated,service_role;
COMMIT;
