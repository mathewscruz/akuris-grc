-- 1) Supplier scores: only the server-side calculation writes them.
DROP POLICY IF EXISTS "Users can create scores for their company assessments" ON public.due_diligence_scores;
DROP POLICY IF EXISTS "Users can insert scores in their empresa assessments" ON public.due_diligence_scores;
DROP POLICY IF EXISTS "Users can update scores from their company assessments" ON public.due_diligence_scores;
DROP POLICY IF EXISTS "Users can update scores from their empresa assessments" ON public.due_diligence_scores;
DROP POLICY IF EXISTS "Users can delete scores from their empresa assessments" ON public.due_diligence_scores;
REVOKE INSERT, UPDATE, DELETE ON public.due_diligence_scores FROM authenticated, anon;

-- 2) Access reviews: only finalize_access_review may conclude a review.
CREATE OR REPLACE FUNCTION public.guard_access_review_scope()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id OR NEW.sistema_id IS DISTINCT FROM OLD.sistema_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'REVIEW_IMMUTABLE_SCOPE';
  END IF;
  IF OLD.status IN ('concluida', 'cancelada') AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'REVIEW_CLOSED'; END IF;
  IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM 'concluida'
     AND coalesce(current_setting('app.finalizing_review', true), '') <> NEW.id::text THEN
    RAISE EXCEPTION 'REVIEW_FINALIZE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NEW.responsavel_revisao IS DISTINCT FROM OLD.responsavel_revisao THEN
    PERFORM 1 FROM public.profiles WHERE user_id = NEW.responsavel_revisao AND empresa_id = NEW.empresa_id AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_OWNER_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  END IF;
  IF (NEW.data_inicio IS DISTINCT FROM OLD.data_inicio OR NEW.data_limite IS DISTINCT FROM OLD.data_limite) AND NEW.data_limite < NEW.data_inicio THEN RAISE EXCEPTION 'REVIEW_INVALID_INPUT'; END IF;
  IF NEW.nome_revisao IS DISTINCT FROM OLD.nome_revisao AND length(btrim(NEW.nome_revisao)) < 3 THEN RAISE EXCEPTION 'REVIEW_INVALID_INPUT'; END IF;
  RETURN NEW;
END $function$;

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.finalize_access_review(uuid)'::regprocedure);
  d := replace(d, '  UPDATE public.access_reviews SET status = ''concluida'', data_conclusao = now(), total_contas = item_count WHERE id = campaign.id;',
                  '  PERFORM set_config(''app.finalizing_review'', campaign.id::text, true);
  UPDATE public.access_reviews SET status = ''concluida'', data_conclusao = now(), total_contas = item_count WHERE id = campaign.id;
  PERFORM set_config(''app.finalizing_review'', '''', true);');
  IF position('app.finalizing_review' in d) = 0 THEN RAISE EXCEPTION 'finalize patch failed'; END IF;
  EXECUTE d;
END $do$;

-- 3) Gap analysis: setting a conformity status requires the module's edit permission.
CREATE OR REPLACE FUNCTION public.guard_gap_evaluation_status()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (TG_OP = 'INSERT' AND NEW.conformity_status IS NOT NULL
          OR TG_OP = 'UPDATE' AND NEW.conformity_status IS DISTINCT FROM OLD.conformity_status)
     AND NOT public.usuario_tem_permissao_modulo('gap-analysis', 'update') THEN
    RAISE EXCEPTION 'GAP_STATUS_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_guard_gap_evaluation_status ON public.gap_analysis_evaluations;
CREATE TRIGGER trg_guard_gap_evaluation_status BEFORE INSERT OR UPDATE ON public.gap_analysis_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.guard_gap_evaluation_status();

-- 4) Audits: concluding needs items, and pending items / open major NCs need a justification.
CREATE OR REPLACE FUNCTION public.guard_auditoria_conclusao()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE v_itens int; v_pend int; v_maiores int;
BEGIN
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    IF auth.uid() IS NOT NULL AND NOT public.usuario_tem_permissao_modulo('auditorias', 'update') THEN
      RAISE EXCEPTION 'AUDIT_CONCLUDE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    SELECT count(*), count(*) FILTER (WHERE status IS DISTINCT FROM 'concluido') INTO v_itens, v_pend
      FROM public.auditoria_itens WHERE auditoria_id = NEW.id AND controle_excluido_em IS NULL;
    IF v_itens = 0 THEN RAISE EXCEPTION 'AUDIT_NO_ITEMS'; END IF;
    SELECT count(*) INTO v_maiores FROM public.auditoria_achados
      WHERE auditoria_id = NEW.id AND classificacao = 'nc_maior' AND coalesce(status, 'aberto') <> 'fechado';
    IF v_pend > 0 OR v_maiores > 0 THEN
      IF coalesce(btrim(NEW.conclusao_justificativa), '') = '' THEN RAISE EXCEPTION 'AUDIT_JUSTIFICATION_REQUIRED'; END IF;
      NEW.conclusao_forcada := true;
    END IF;
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_guard_auditoria_conclusao ON public.auditorias;
CREATE TRIGGER trg_guard_auditoria_conclusao BEFORE INSERT OR UPDATE ON public.auditorias
  FOR EACH ROW EXECUTE FUNCTION public.guard_auditoria_conclusao();

-- 5) Scheduled reports: recipients must be active users of the same company.
CREATE OR REPLACE FUNCTION public.guard_relatorio_destinatarios()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE e text;
BEGIN
  FOREACH e IN ARRAY coalesce(NEW.destinatarios, '{}'::text[]) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.empresa_id = NEW.empresa_id AND p.ativo AND lower(p.email) = lower(btrim(e))) THEN
      RAISE EXCEPTION 'RECIPIENT_NOT_IN_COMPANY: %', e USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.guard_relatorio_destinatarios() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_guard_relatorio_destinatarios ON public.relatorio_agendamentos;
CREATE TRIGGER trg_guard_relatorio_destinatarios BEFORE INSERT OR UPDATE OF destinatarios, empresa_id ON public.relatorio_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.guard_relatorio_destinatarios();