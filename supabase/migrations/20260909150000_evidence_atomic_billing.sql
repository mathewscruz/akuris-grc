-- Bill a delivered result, not each provider request. Retried completions are
-- idempotent; re-analysis after the seven-day cache window is a new delivery.
CREATE OR REPLACE FUNCTION public.evidence_analysis_finish(
 p_id uuid,p_attempt integer,p_status text,p_result jsonb DEFAULT NULL,
 p_checkpoint jsonb DEFAULT NULL,p_error text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.evidence_analysis_jobs;
BEGIN
 IF p_status IS NULL OR p_status NOT IN ('running','complete','error') THEN RAISE EXCEPTION 'invalid_status'; END IF;
 SELECT * INTO j FROM public.evidence_analysis_jobs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR j.attempt IS DISTINCT FROM p_attempt THEN RAISE EXCEPTION 'lease_lost'; END IF;
 IF j.status='complete' AND p_status='complete' AND j.result=p_result THEN RETURN; END IF;
 IF j.status<>'running' OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'lease_lost'; END IF;
 IF p_status='complete' THEN
  IF p_result IS NULL OR jsonb_typeof(p_result)<>'object'
     OR NOT (COALESCE(p_result->>'verdict','') = ANY(ARRAY['conforme','parcial','nao_conforme','indeterminado']))
     OR NOT (p_result ? 'verdict') THEN RAISE EXCEPTION 'invalid_result'; END IF;
  -- Serializes this debit against all ordinary credits on the same company.
  -- consume_ai_credit is also locked below, covering calls outside this flow.
  IF NOT public.consume_ai_credit(j.empresa_id,j.requested_by,
    'analyze_evidence_against_requirement','Análise fundamentada '||j.id::text) THEN
   RAISE EXCEPTION 'credits_exhausted';
  END IF;
 END IF;
 UPDATE public.evidence_analysis_jobs SET status=p_status,result=p_result,
 checkpoint=CASE WHEN p_status='complete' THEN NULL ELSE COALESCE(p_checkpoint,checkpoint) END,
 error_code=p_error,updated_at=now() WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.evidence_analysis_finish(uuid,integer,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.evidence_analysis_finish(uuid,integer,text,jsonb,jsonb,text) TO service_role;

-- The former read/check/increment allowed two concurrent requests to consume
-- the last available credit. Preserve tenant enforcement and actor attribution.
CREATE OR REPLACE FUNCTION public.consume_ai_credit(
 p_empresa_id uuid,p_user_id uuid,p_funcionalidade text,p_descricao text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_franquia integer; v_consumidos integer;
BEGIN
 -- Edge Functions use a server-side service-role JWT with no end-user sub.
 -- User JWTs must still be constrained to their own company.
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  PERFORM public.exige_empresa_da_sessao(p_empresa_id);
 END IF;
 SELECT p.creditos_franquia,e.creditos_consumidos INTO v_franquia,v_consumidos
 FROM public.empresas e LEFT JOIN public.planos p ON p.id=e.plano_id
 WHERE e.id=p_empresa_id FOR UPDATE OF e;
 IF v_franquia IS NULL OR v_consumidos IS NULL OR v_consumidos>=v_franquia THEN RETURN false; END IF;
 INSERT INTO public.creditos_consumo(empresa_id,user_id,funcionalidade,descricao)
 VALUES(p_empresa_id,COALESCE(auth.uid(),p_user_id),p_funcionalidade,p_descricao);
 UPDATE public.empresas SET creditos_consumidos=creditos_consumidos+1 WHERE id=p_empresa_id;
 RETURN true;
END $$;
