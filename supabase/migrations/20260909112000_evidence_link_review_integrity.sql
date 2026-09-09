CREATE FUNCTION public.compliance_guard_evidence_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE evidence public.evidence_library; evaluation public.gap_analysis_evaluations;
BEGIN
 SELECT * INTO evidence FROM public.evidence_library WHERE id=NEW.evidence_id AND empresa_id=NEW.empresa_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'evidence_tenant_mismatch'; END IF;
 IF NEW.evaluation_id IS NOT NULL THEN
  SELECT * INTO evaluation FROM public.gap_analysis_evaluations WHERE id=NEW.evaluation_id AND empresa_id=NEW.empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'evaluation_link_mismatch'; END IF;
  -- Older evaluation links did not always duplicate the requirement/framework.
  NEW.requirement_id:=COALESCE(NEW.requirement_id,evaluation.requirement_id);
  NEW.framework_id:=COALESCE(NEW.framework_id,evaluation.framework_id);
  IF NEW.requirement_id IS DISTINCT FROM evaluation.requirement_id OR NEW.framework_id IS DISTINCT FROM evaluation.framework_id THEN RAISE EXCEPTION 'evaluation_link_mismatch'; END IF;
 END IF;
 IF (NEW.vinculo_tipo='manual' OR NEW.aceito_em IS NOT NULL) AND evidence.valido_ate<current_date THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.evidence_id IS DISTINCT FROM OLD.evidence_id OR NEW.evaluation_id IS DISTINCT FROM OLD.evaluation_id
     OR (OLD.aceito_em IS NULL AND OLD.vinculo_tipo<>'manual') THEN RAISE EXCEPTION 'expired_evidence'; END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM public.evidence_library_links WHERE empresa_id=NEW.empresa_id AND evidence_id=NEW.evidence_id AND evaluation_id=NEW.evaluation_id AND (vinculo_tipo='manual' OR aceito_em IS NOT NULL)) THEN
   RAISE EXCEPTION 'expired_evidence';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.compliance_guard_evidence_link() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER compliance_guard_evidence_link BEFORE INSERT OR UPDATE ON public.evidence_library_links FOR EACH ROW EXECUTE FUNCTION public.compliance_guard_evidence_link();
