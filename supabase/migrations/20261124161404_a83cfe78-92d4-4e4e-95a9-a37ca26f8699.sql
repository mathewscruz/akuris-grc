CREATE OR REPLACE FUNCTION public.atribuir_responsavel_framework(p_framework_id uuid, p_user_id uuid, p_aplicar_requisitos boolean DEFAULT true)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_empresa uuid := public.get_user_empresa_id(); v_nome text; v_qtd integer := 0; v_ins integer := 0;
BEGIN
 IF v_empresa IS NULL THEN RAISE EXCEPTION 'Sem empresa'; END IF;
 IF NOT (public.is_admin_or_super_admin() OR public.usuario_tem_permissao_modulo('gap-analysis','update')) THEN RAISE EXCEPTION 'Sem permissão para atribuir responsáveis' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=p_user_id AND empresa_id=v_empresa AND ativo) THEN RAISE EXCEPTION 'Usuário fora da sua empresa' USING ERRCODE='42501'; END IF;
 SELECT nome INTO v_nome FROM public.gap_analysis_frameworks WHERE id=p_framework_id AND (empresa_id IS NULL OR empresa_id=v_empresa);
 IF v_nome IS NULL THEN RAISE EXCEPTION 'Framework não encontrado' USING ERRCODE='42501'; END IF;
 INSERT INTO public.gap_analysis_framework_owners (empresa_id,framework_id,user_id,atribuido_por) VALUES (v_empresa,p_framework_id,p_user_id,auth.uid())
 ON CONFLICT (empresa_id,framework_id) DO UPDATE SET user_id=EXCLUDED.user_id,atribuido_por=EXCLUDED.atribuido_por,updated_at=now();
 IF p_aplicar_requisitos THEN
 UPDATE public.gap_analysis_evaluations SET responsavel_avaliacao=p_user_id WHERE empresa_id=v_empresa AND framework_id=p_framework_id AND responsavel_avaliacao IS NULL;
 GET DIAGNOSTICS v_qtd=ROW_COUNT;
 INSERT INTO public.gap_analysis_evaluations (requirement_id,framework_id,empresa_id,responsavel_avaliacao,created_by)
 SELECT r.id,p_framework_id,v_empresa,p_user_id,auth.uid() FROM public.gap_analysis_requirements r WHERE r.framework_id=p_framework_id AND NOT EXISTS (SELECT 1 FROM public.gap_analysis_evaluations e WHERE e.empresa_id=v_empresa AND e.requirement_id=r.id);
 GET DIAGNOSTICS v_ins=ROW_COUNT;
 END IF;
 IF p_user_id IS DISTINCT FROM auth.uid() THEN PERFORM public.criar_notificacao(p_user_id,'Você é responsável por um framework','Você foi designado responsável pelo framework '||v_nome,'info','/gap-analysis/framework/'||p_framework_id,jsonb_build_object('framework_id',p_framework_id)); END IF;
 RETURN v_qtd+v_ins;
END $$;
CREATE OR REPLACE FUNCTION public.guard_audit_risk_acceptance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_empresa uuid := public.get_user_empresa_id(); v_authorized boolean;
BEGIN
 IF NEW.status IS DISTINCT FROM 'aceito_risco' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.auditoria_id IS NOT DISTINCT FROM NEW.auditoria_id THEN RETURN NEW; END IF;
 END IF;
 SELECT EXISTS (
 SELECT 1 FROM public.auditorias a JOIN public.profiles p ON p.user_id=auth.uid() AND p.ativo AND p.empresa_id=a.empresa_id
 WHERE a.id=NEW.auditoria_id AND a.empresa_id=v_empresa AND
 (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR
 (a.auditor_responsavel=auth.uid() AND public.usuario_tem_permissao_modulo('auditorias','update')))
 ) INTO v_authorized;
 IF NOT v_authorized THEN RAISE EXCEPTION 'Sem permissão para aceitar risco de auditoria' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_audit_risk_acceptance() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_audit_risk_acceptance BEFORE INSERT OR UPDATE OF status,auditoria_id ON public.auditoria_achados FOR EACH ROW EXECUTE FUNCTION public.guard_audit_risk_acceptance();