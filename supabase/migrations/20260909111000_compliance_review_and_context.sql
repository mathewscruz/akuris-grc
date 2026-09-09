CREATE TABLE public.compliance_review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 evaluation_id uuid NOT NULL REFERENCES public.gap_analysis_evaluations(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('review','exception_requested','exception_approved','exception_rejected','plan_linked')),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 12 AND 4000),
 actor_id uuid NOT NULL REFERENCES auth.users(id), request_id uuid REFERENCES public.compliance_review_events(id),
 valid_until date, snapshot jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX compliance_exception_one_decision ON public.compliance_review_events(request_id) WHERE kind IN ('exception_approved','exception_rejected');
CREATE INDEX compliance_review_timeline ON public.compliance_review_events(empresa_id,evaluation_id,created_at DESC);
ALTER TABLE public.compliance_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compliance_review_events FROM anon,authenticated;
GRANT SELECT ON public.compliance_review_events TO authenticated;
GRANT ALL ON public.compliance_review_events TO service_role;
CREATE POLICY compliance_review_read ON public.compliance_review_events FOR SELECT TO authenticated USING(
 empresa_id=public.get_user_empresa_id() AND public.has_valid_mfa_session() AND public.usuario_tem_permissao_modulo('gap-analysis','read'));

CREATE FUNCTION public.compliance_evaluation_snapshot(p_evaluation uuid,p_empresa uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('files',e.evidence_files,'evaluation',jsonb_build_object('status',e.conformity_status,'answers',e.diagnostic_answers,'observations',e.observacoes,'plan_id',e.plano_acao_id),'requirement',to_jsonb(r)-'created_at','controls',
   COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'updated_at',c.updated_at,'mapping_updated_at',cr.updated_at) ORDER BY c.id)
    FROM public.controles_requisitos cr JOIN public.controles c ON c.id=cr.controle_id AND c.empresa_id=p_empresa
    WHERE cr.requirement_id=e.requirement_id AND cr.empresa_id=p_empresa),'[]'::jsonb),
   'evidence',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'hash',v.arquivo_hash,'updated_at',v.updated_at,'valid_until',v.valido_ate,'accepted_at',l.aceito_em) ORDER BY v.id)
    FROM public.evidence_library_links l JOIN public.evidence_library v ON v.id=l.evidence_id AND v.empresa_id=p_empresa
    WHERE l.evaluation_id=e.id AND l.empresa_id=p_empresa AND (l.vinculo_tipo='manual' OR l.aceito_em IS NOT NULL)),'[]'::jsonb))
 FROM public.gap_analysis_evaluations e JOIN public.gap_analysis_requirements r ON r.id=e.requirement_id WHERE e.id=p_evaluation AND e.empresa_id=p_empresa;
$$;
REVOKE ALL ON FUNCTION public.compliance_evaluation_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.compliance_review_state(p_evaluation uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tenant uuid:=public.get_user_empresa_id(); snap jsonb; reviewed public.compliance_review_events; approved public.compliance_review_events; pending public.compliance_review_events;
BEGIN
 IF tenant IS NULL OR NOT public.has_valid_mfa_session() OR NOT public.usuario_tem_permissao_modulo('gap-analysis','read') THEN RAISE EXCEPTION 'forbidden'; END IF;
 snap:=public.compliance_evaluation_snapshot(p_evaluation,tenant);
 IF snap IS NULL THEN RAISE EXCEPTION 'evaluation_missing'; END IF;
 SELECT * INTO reviewed FROM public.compliance_review_events WHERE empresa_id=tenant AND evaluation_id=p_evaluation AND kind='review' ORDER BY created_at DESC,id DESC LIMIT 1;
 SELECT * INTO approved FROM public.compliance_review_events WHERE empresa_id=tenant AND evaluation_id=p_evaluation AND kind='exception_approved' ORDER BY created_at DESC,id DESC LIMIT 1;
 SELECT * INTO pending FROM public.compliance_review_events e WHERE empresa_id=tenant AND evaluation_id=p_evaluation AND kind='exception_requested' AND valid_until>=current_date
  AND NOT EXISTS(SELECT 1 FROM public.compliance_review_events d WHERE d.request_id=e.id) ORDER BY created_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_object('reviewed_at',reviewed.created_at,'changed',reviewed.id IS NOT NULL AND reviewed.snapshot IS DISTINCT FROM snap,
  'pending_request',CASE WHEN pending.id IS NOT NULL THEN to_jsonb(pending)-'snapshot' ELSE NULL END,
  'exception',CASE WHEN approved.id IS NOT NULL THEN jsonb_build_object('valid_until',approved.valid_until,'reason',approved.reason,'expired',approved.valid_until<current_date,'changed',approved.snapshot IS DISTINCT FROM snap) ELSE NULL END,
  'expired',EXISTS(SELECT 1 FROM jsonb_array_elements(snap->'evidence') ev WHERE (ev->>'valid_until')::date<current_date),
  'events',COALESCE((SELECT jsonb_agg(to_jsonb(x)-'snapshot' ORDER BY x.created_at DESC) FROM (SELECT * FROM public.compliance_review_events WHERE empresa_id=tenant AND evaluation_id=p_evaluation ORDER BY created_at DESC LIMIT 20)x),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.compliance_review_state(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.compliance_review_state(uuid) TO authenticated;

CREATE FUNCTION public.compliance_record_review(p_evaluation uuid,p_kind text,p_reason text,p_until date DEFAULT NULL,p_request uuid DEFAULT NULL,p_plan uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tenant uuid:=public.get_user_empresa_id(); snap jsonb; request public.compliance_review_events; event_id uuid;
BEGIN
 IF tenant IS NULL OR NOT public.has_valid_mfa_session() OR NOT public.usuario_tem_permissao_modulo('gap-analysis','update') THEN RAISE EXCEPTION 'forbidden'; END IF;
 PERFORM 1 FROM public.gap_analysis_evaluations WHERE id=p_evaluation AND empresa_id=tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'evaluation_missing'; END IF;
 snap:=public.compliance_evaluation_snapshot(p_evaluation,tenant);
 IF p_kind NOT IN ('review','exception_requested','exception_approved','exception_rejected','plan_linked') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 12 AND 4000 THEN RAISE EXCEPTION 'invalid_review'; END IF;
 IF p_kind='exception_requested' THEN
  IF p_until IS NULL OR p_until<=current_date OR p_until>current_date+365 THEN RAISE EXCEPTION 'invalid_expiry'; END IF;
  IF EXISTS(SELECT 1 FROM public.compliance_review_events e WHERE e.evaluation_id=p_evaluation AND e.kind='exception_requested' AND e.valid_until>=current_date
    AND NOT EXISTS(SELECT 1 FROM public.compliance_review_events d WHERE d.request_id=e.id)) THEN RAISE EXCEPTION 'exception_pending'; END IF;
 ELSIF p_kind IN ('exception_approved','exception_rejected') THEN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND empresa_id=tenant AND ativo AND role::text IN ('admin','super_admin')) THEN RAISE EXCEPTION 'approver_required'; END IF;
  SELECT * INTO request FROM public.compliance_review_events WHERE id=p_request AND evaluation_id=p_evaluation AND empresa_id=tenant AND kind='exception_requested' FOR UPDATE;
  IF NOT FOUND OR request.actor_id=auth.uid() OR request.valid_until<current_date THEN RAISE EXCEPTION 'invalid_approver_or_request'; END IF;
  p_until:=request.valid_until;
  IF p_kind='exception_approved' AND request.snapshot IS DISTINCT FROM snap THEN RAISE EXCEPTION 'sources_changed'; END IF;
 ELSIF p_kind='plan_linked' THEN
  IF NOT public.usuario_tem_permissao_modulo('planos-acao','read') OR NOT EXISTS(SELECT 1 FROM public.planos_acao WHERE id=p_plan AND empresa_id=tenant AND status NOT IN ('cancelado','concluido')) THEN RAISE EXCEPTION 'invalid_plan'; END IF;
  UPDATE public.gap_analysis_evaluations SET plano_acao_id=p_plan,updated_at=now() WHERE id=p_evaluation AND empresa_id=tenant;
  snap:=snap||jsonb_build_object('plan_id',p_plan);
 END IF;
 INSERT INTO public.compliance_review_events(empresa_id,evaluation_id,kind,reason,actor_id,request_id,valid_until,snapshot)
 VALUES(tenant,p_evaluation,p_kind,btrim(p_reason),auth.uid(),CASE WHEN p_kind IN ('exception_approved','exception_rejected') THEN p_request ELSE NULL END,
 CASE WHEN p_kind LIKE 'exception_%' THEN p_until ELSE NULL END,snap) RETURNING id INTO event_id;
 RETURN event_id;
END $$;
REVOKE ALL ON FUNCTION public.compliance_record_review(uuid,text,text,date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.compliance_record_review(uuid,text,text,date,uuid,uuid) TO authenticated;

-- Read-only correlations use existing, explicit foreign keys and the caller's RLS.
-- No inferred relation based on names; no automatic change to risk or compliance.
CREATE FUNCTION public.compliance_module_context() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 WITH signals AS (
  SELECT 'contract:'||c.id AS key, 'contract_assessment' AS rule, c.nome AS title,
   CASE WHEN c.data_fim<current_date THEN 'high' ELSE 'medium' END AS priority,
   jsonb_build_object('contract_end',c.data_fim,'assessment_deadline',a.data_expiracao,'assessment_status',a.status) AS facts,
   jsonb_build_array(jsonb_build_object('label',c.nome,'path','/contratos'),jsonb_build_object('label',f.nome,'path','/due-diligence')) AS sources
  FROM public.contratos c JOIN public.fornecedores f ON f.id=c.fornecedor_id AND f.empresa_id=c.empresa_id
  LEFT JOIN LATERAL(SELECT data_expiracao,status FROM public.due_diligence_assessments WHERE fornecedor_id=f.id AND empresa_id=c.empresa_id ORDER BY created_at DESC,id LIMIT 1)a ON true
  WHERE c.empresa_id=public.get_user_empresa_id() AND c.status NOT IN ('cancelado','encerrado') AND c.data_fim<=current_date+60
   AND (a.status IS NULL OR a.status NOT IN ('concluida','concluido','finalizada'))
   AND public.usuario_tem_permissao_modulo('contratos','read') AND public.usuario_tem_permissao_modulo('due-diligence','read')
  UNION ALL
  SELECT 'privacy:'||r.id||':'||d.id||':'||a.id,'risk_personal_data',r.nome,
   CASE WHEN lower(COALESCE(r.nivel_risco_residual,r.nivel_risco_inicial,'')) IN ('alto','critico','crítico') THEN 'high' ELSE 'medium' END,
   jsonb_build_object('asset',a.nome,'data',d.nome,'sensitivity',d.sensibilidade,'risk',COALESCE(r.nivel_risco_residual,r.nivel_risco_inicial)),
   jsonb_build_array(jsonb_build_object('label',r.nome,'path','/riscos?view=table'),jsonb_build_object('label',d.nome,'path','/dados'),jsonb_build_object('label',a.nome,'path','/ativos'))
  FROM public.riscos r JOIN public.riscos_ativos ra ON ra.risco_id=r.id JOIN public.ativos a ON a.id=ra.ativo_id AND a.empresa_id=r.empresa_id
  JOIN public.dados_mapeamento dm ON dm.ativo_id=a.id JOIN public.dados_pessoais d ON d.id=dm.dados_pessoais_id AND d.empresa_id=r.empresa_id
  WHERE r.empresa_id=public.get_user_empresa_id() AND r.arquivado_em IS NULL
   AND public.usuario_tem_permissao_modulo('riscos','read') AND public.usuario_tem_permissao_modulo('dados','read') AND public.usuario_tem_permissao_modulo('ativos','read')
  UNION ALL
  SELECT 'access:'||i.id,'access_revocation_pending',s.nome_sistema,'high',
   jsonb_build_object('decision',i.decisao,'reviewed_at',i.data_revisao),
   jsonb_build_array(jsonb_build_object('label',s.nome_sistema,'path','/sistemas'),jsonb_build_object('label',v.nome_revisao,'path','/revisao-acessos'))
  FROM public.access_review_items i JOIN public.access_reviews v ON v.id=i.review_id
  JOIN public.sistemas_privilegiados s ON s.id=v.sistema_id AND s.empresa_id=v.empresa_id
  LEFT JOIN public.sistemas_usuarios u ON u.id=i.sistema_usuario_id AND u.empresa_id=v.empresa_id
  LEFT JOIN public.contas_privilegiadas p ON p.id=i.conta_id AND p.empresa_id=v.empresa_id
  WHERE v.empresa_id=public.get_user_empresa_id() AND i.decisao IN ('revogar','revogado') AND (u.ativo OR p.status='ativo')
   AND public.usuario_tem_permissao_modulo('contas-privilegiadas','read')
  UNION ALL
  SELECT 'continuity:'||p.id,'recovery_not_demonstrated',p.nome,'medium',
   jsonb_build_object('last_test',t.data_teste,'result',t.resultado,'target_hours',p.rto_horas),
   jsonb_build_array(jsonb_build_object('label',p.nome,'path','/continuidade'))
  FROM public.continuidade_planos p LEFT JOIN LATERAL(SELECT data_teste,resultado FROM public.continuidade_testes WHERE plano_id=p.id AND empresa_id=p.empresa_id ORDER BY data_teste DESC,id LIMIT 1)t ON true
  WHERE p.empresa_id=public.get_user_empresa_id() AND p.status NOT IN ('arquivado','inativo') AND (t.resultado IS DISTINCT FROM 'aprovado' OR t.data_teste<current_date-365)
   AND public.usuario_tem_permissao_modulo('continuidade','read')
 ) SELECT jsonb_build_object('checked_at',now(),'rule_version','2026-09-09.1','limited',(SELECT count(*)>100 FROM signals),
  'items',COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM (SELECT DISTINCT * FROM signals ORDER BY priority,key LIMIT 100)s),'[]'::jsonb))
 WHERE public.has_valid_mfa_session();
$$;
REVOKE ALL ON FUNCTION public.compliance_module_context() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.compliance_module_context() TO authenticated;
