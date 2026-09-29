BEGIN;
SET LOCAL lock_timeout='5s';

-- Only user-authored fields may enter an assessment; identity and derived values are server-owned.
REVOKE INSERT ON public.regulatory_assessments,public.regulatory_evidence_links,public.regulatory_sboms FROM authenticated;
GRANT INSERT(id,empresa_id,product_id,product_version_id,framework_version_id,name,answers,roles,applicability,classification,decision_rationale)
  ON public.regulatory_assessments TO authenticated;
GRANT INSERT(empresa_id,product_id,item_id,evidence_id,owner_id,evidence_date,valid_until,comment)
  ON public.regulatory_evidence_links TO authenticated;
GRANT INSERT(empresa_id,product_id,product_version_id,evidence_id,format,spec_version,component_count,tool,generated_at)
  ON public.regulatory_sboms TO authenticated;
ALTER TABLE public.regulatory_evidence_links ADD COLUMN analysis_job_id uuid REFERENCES public.evidence_analysis_jobs(id) ON DELETE RESTRICT;
CREATE INDEX regulatory_evidence_analysis ON public.regulatory_evidence_links(analysis_job_id);
GRANT UPDATE(analysis_job_id) ON public.regulatory_evidence_links TO authenticated;
ALTER TABLE public.regulatory_sboms ADD CONSTRAINT regulatory_sbom_supported_format CHECK(
 (format='CycloneDX' AND spec_version IN ('1.4','1.5','1.6','1.7')) OR (format='SPDX' AND spec_version IN ('SPDX-2.2','SPDX-2.3')));

CREATE FUNCTION public.regulatory_review_guards() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item public.regulatory_assessment_items;
BEGIN
  IF TG_TABLE_NAME='regulatory_evidence_links' THEN
    IF TG_OP='UPDATE' AND OLD.removed_at IS NOT NULL THEN RAISE EXCEPTION 'removed_evidence_is_immutable'; END IF;
    IF NEW.review_status='unreviewed' THEN NEW.reviewed_at:=NULL; NEW.reviewed_by:=NULL; END IF;
    IF NEW.analysis_job_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.analysis_job_id IS DISTINCT FROM OLD.analysis_job_id) THEN
      SELECT * INTO item FROM public.regulatory_assessment_items WHERE id=NEW.item_id AND empresa_id=NEW.empresa_id;
      IF NOT EXISTS(SELECT 1 FROM public.evidence_analysis_jobs j JOIN public.evidence_library e ON e.id=NEW.evidence_id
        WHERE j.id=NEW.analysis_job_id AND j.empresa_id=NEW.empresa_id AND j.status='complete'
          AND j.requirement_id=item.requirement_id AND j.source_hash=e.arquivo_hash
          AND j.result->>'assessment_item_id'=NEW.item_id::text AND j.result->>'evidence_id'=NEW.evidence_id::text)
      THEN RAISE EXCEPTION 'invalid_regulatory_analysis_context'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME='regulatory_assessment_items' THEN
    IF NEW.status='nao_avaliado' THEN NEW.reviewed_at:=NULL; NEW.reviewed_by:=NULL; END IF;
  ELSIF TG_TABLE_NAME='regulatory_findings' THEN
    SELECT * INTO item FROM public.regulatory_assessment_items WHERE id=NEW.item_id AND empresa_id=NEW.empresa_id;
    IF NEW.status='resolved' AND item.status NOT IN ('conforme','nao_aplicavel') THEN RAISE EXCEPTION 'reassessment_required'; END IF;
    IF TG_OP='UPDATE' AND OLD.action_plan_id IS NOT NULL AND NEW.action_plan_id IS DISTINCT FROM OLD.action_plan_id THEN RAISE EXCEPTION 'immutable_remediation_link'; END IF;
  ELSIF TG_TABLE_NAME='regulatory_assessments' THEN
    IF NEW.status='review_ready' AND EXISTS(SELECT 1 FROM public.regulatory_assessment_items WHERE assessment_id=NEW.id AND status='nao_avaliado') THEN RAISE EXCEPTION 'pending_assessment_items'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.regulatory_review_guards() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['regulatory_evidence_links','regulatory_assessment_items','regulatory_findings','regulatory_assessments'] LOOP
  EXECUTE format('CREATE TRIGGER zz_regulatory_review_guards BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.regulatory_review_guards()',t);
END LOOP; END $$;

CREATE TABLE public.regulatory_assessment_scores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL, product_id uuid NOT NULL, assessment_id uuid NOT NULL,
 source_item_id uuid REFERENCES public.regulatory_assessment_items(id), source_revision integer,
 result jsonb NOT NULL, calculated_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(assessment_id,empresa_id,product_id) REFERENCES public.regulatory_assessments(id,empresa_id,product_id)
);
CREATE INDEX regulatory_scores_tenant ON public.regulatory_assessment_scores(empresa_id,assessment_id,created_at DESC);
CREATE INDEX regulatory_scores_source ON public.regulatory_assessment_scores(source_item_id);
CREATE INDEX regulatory_scores_actor ON public.regulatory_assessment_scores(calculated_by);
ALTER TABLE public.regulatory_assessment_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulatory_assessment_scores FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.regulatory_assessment_scores TO authenticated;
GRANT ALL ON public.regulatory_assessment_scores TO service_role;
CREATE POLICY tenant_read ON public.regulatory_assessment_scores FOR SELECT TO authenticated USING(
 empresa_id=(SELECT public.get_user_empresa_id()) AND (SELECT public.has_valid_mfa_session()) AND (SELECT public.usuario_tem_permissao_modulo('gap-analysis','read')));
CREATE FUNCTION regulatory_private.capture_score() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE assessment uuid; result jsonb; previous jsonb; score_id uuid;
BEGIN
 IF TG_TABLE_NAME='regulatory_assessment_items' THEN
   IF NEW.status=OLD.status THEN RETURN NULL; END IF;
   assessment:=NEW.assessment_id;
 ELSE assessment:=NEW.id; END IF;
 result:=public.regulatory_readiness(assessment);
 SELECT s.result INTO previous FROM public.regulatory_assessment_scores s WHERE s.assessment_id=assessment ORDER BY created_at DESC,id DESC LIMIT 1;
 INSERT INTO public.regulatory_assessment_scores(empresa_id,product_id,assessment_id,source_item_id,source_revision,result,calculated_by)
 VALUES(NEW.empresa_id,NEW.product_id,assessment,CASE WHEN TG_TABLE_NAME='regulatory_assessment_items' THEN NEW.id ELSE NULL END,
   NEW.revision,result,auth.uid()) RETURNING id INTO score_id;
 INSERT INTO public.regulatory_audit_events(empresa_id,product_id,entity_type,entity_id,action,actor_id,old_value,new_value,changed_fields)
 VALUES(NEW.empresa_id,NEW.product_id,'regulatory_assessment_scores',score_id,'INSERT',auth.uid(),previous,result,ARRAY['score','assessed','pending']);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION regulatory_private.capture_score() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_regulatory_initial_score AFTER INSERT ON public.regulatory_assessments FOR EACH ROW EXECUTE FUNCTION regulatory_private.capture_score();
CREATE TRIGGER zz_regulatory_recalculate_score AFTER UPDATE ON public.regulatory_assessment_items FOR EACH ROW EXECUTE FUNCTION regulatory_private.capture_score();

-- Audit records preserve decisions and changed-field names, never file bodies, tokens or free-text content.
CREATE OR REPLACE FUNCTION regulatory_private.audit_product_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE before_value jsonb; after_value jsonb; row_value jsonb; changed text[]; redact text[]:=ARRAY['repositories','description','support_rationale','notes','comment','decision_rationale','impact','recommendation','missing_evidence','decision_note','initial_procedure','detailed_procedure','final_procedure','psirt','legal_contact','management_contact'];
BEGIN
 IF TG_OP<>'INSERT' THEN before_value:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN after_value:=to_jsonb(NEW); END IF;
 row_value:=COALESCE(after_value,before_value);
 SELECT array_agg(key ORDER BY key) INTO changed FROM jsonb_object_keys(row_value) key WHERE (before_value->key) IS DISTINCT FROM (after_value->key);
 INSERT INTO public.regulatory_audit_events(empresa_id,product_id,entity_type,entity_id,action,actor_id,old_value,new_value,changed_fields)
 VALUES((row_value->>'empresa_id')::uuid,CASE WHEN TG_TABLE_NAME='products' THEN (row_value->>'id')::uuid ELSE (row_value->>'product_id')::uuid END,
 TG_TABLE_NAME,(row_value->>'id')::uuid,TG_OP,auth.uid(),before_value-redact,after_value-redact,COALESCE(changed,'{}'));
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION regulatory_private.audit_product_change() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
