-- Evidence processing only. Provider integrations remain unavailable.
CREATE TABLE public.evidence_analysis_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 requested_by uuid NOT NULL REFERENCES auth.users(id), requirement_id uuid NOT NULL REFERENCES public.gap_analysis_requirements(id) ON DELETE CASCADE,
 cache_key text NOT NULL, source_hash text NOT NULL, reader_version text NOT NULL,
 status text NOT NULL CHECK(status IN ('running','complete','error')), attempt integer NOT NULL DEFAULT 1,
 lease_until timestamptz NOT NULL DEFAULT now()+interval '3 minutes', checkpoint jsonb, result jsonb, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(empresa_id,cache_key)
);
ALTER TABLE public.evidence_analysis_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evidence_analysis_jobs FROM anon,authenticated;
GRANT SELECT ON public.evidence_analysis_jobs TO authenticated;
GRANT ALL ON public.evidence_analysis_jobs TO service_role;
CREATE POLICY evidence_jobs_read ON public.evidence_analysis_jobs FOR SELECT TO authenticated
USING (empresa_id=public.get_user_empresa_id() AND public.has_valid_mfa_session() AND public.usuario_tem_permissao_modulo('gap-analysis','read'));
CREATE INDEX evidence_jobs_tenant_time ON public.evidence_analysis_jobs(empresa_id,updated_at DESC);
CREATE FUNCTION public.evidence_analysis_claim(p_empresa uuid,p_user uuid,p_requirement uuid,p_key text,p_hash text,p_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.evidence_analysis_jobs;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa::text,491));
 -- Retain extracted text only while it is useful for resumption. Results keep
 -- the quoted passages, not another permanent copy of the whole document.
 UPDATE public.evidence_analysis_jobs SET checkpoint=NULL WHERE empresa_id=p_empresa AND updated_at<now()-interval '7 days' AND checkpoint IS NOT NULL;
 SELECT * INTO j FROM public.evidence_analysis_jobs WHERE empresa_id=p_empresa AND cache_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF j.status='complete' AND j.updated_at>now()-interval '7 days' THEN RETURN jsonb_build_object('cached',true,'job',to_jsonb(j)); END IF;
  IF j.status='running' AND j.lease_until>now() THEN RETURN jsonb_build_object('busy',true,'job_id',j.id); END IF;
  IF j.attempt>=3 AND j.updated_at>now()-interval '1 hour' THEN RAISE EXCEPTION 'retry_later'; END IF;
 END IF;
 IF (SELECT count(*) FROM public.evidence_analysis_jobs WHERE empresa_id=p_empresa AND status='running' AND lease_until>now())>=2
  OR (SELECT count(*) FROM public.evidence_analysis_jobs WHERE empresa_id=p_empresa AND created_at>now()-interval '1 hour')>=40 THEN RAISE EXCEPTION 'processing_limit'; END IF;
 IF j.id IS NULL THEN
  INSERT INTO public.evidence_analysis_jobs(empresa_id,requested_by,requirement_id,cache_key,source_hash,reader_version,status)
  VALUES(p_empresa,p_user,p_requirement,p_key,p_hash,p_version,'running') RETURNING * INTO j;
 ELSE
  UPDATE public.evidence_analysis_jobs SET status='running',attempt=CASE WHEN updated_at<now()-interval '1 hour' THEN 1 ELSE attempt+1 END,
   lease_until=now()+interval '3 minutes',updated_at=now(),error_code=NULL,result=NULL,
   checkpoint=CASE WHEN updated_at<now()-interval '7 days' THEN NULL ELSE checkpoint END WHERE id=j.id RETURNING * INTO j;
 END IF;
 RETURN jsonb_build_object('job',to_jsonb(j));
END $$;
REVOKE ALL ON FUNCTION public.evidence_analysis_claim(uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.evidence_analysis_claim(uuid,uuid,uuid,text,text,text) TO service_role;
CREATE FUNCTION public.evidence_analysis_finish(p_id uuid,p_attempt integer,p_status text,p_result jsonb DEFAULT NULL,p_checkpoint jsonb DEFAULT NULL,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_status NOT IN ('running','complete','error') THEN RAISE EXCEPTION 'invalid_status'; END IF;
 UPDATE public.evidence_analysis_jobs SET status=p_status,result=p_result,checkpoint=CASE WHEN p_status='complete' THEN NULL ELSE COALESCE(p_checkpoint,checkpoint) END,error_code=p_error,updated_at=now()
 WHERE id=p_id AND attempt=p_attempt AND status='running' AND lease_until>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'lease_lost'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.evidence_analysis_finish(uuid,integer,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.evidence_analysis_finish(uuid,integer,text,jsonb,jsonb,text) TO service_role;
