
-- 1) Denuncias: restrict public-token SELECT to non-closed cases
DROP POLICY IF EXISTS "View denuncia by public token" ON public.denuncias;
CREATE POLICY "View denuncia by public token"
ON public.denuncias
FOR SELECT
TO anon, authenticated
USING (
  token_publico IS NOT NULL
  AND token_publico = ((current_setting('request.headers', true))::json ->> 'x-token-publico')
  AND COALESCE(status, '') NOT IN ('encerrada','fechada','arquivada','cancelada')
);

-- 2) Due Diligence standard template questions: restrict to admins (fornecedores keep token-based access via other policy)
DROP POLICY IF EXISTS "Users can view questions from standard templates" ON public.due_diligence_questions;
CREATE POLICY "Admins can view questions from standard templates"
ON public.due_diligence_questions
FOR SELECT
TO authenticated
USING (
  is_admin_or_super_admin()
  AND EXISTS (
    SELECT 1 FROM public.due_diligence_templates t
    WHERE t.id = due_diligence_questions.template_id AND t.padrao = true
  )
);

-- 3) Scope public-role policies to authenticated
DROP POLICY IF EXISTS "Super admins can delete contact submissions" ON public.contact_form_submissions;
CREATE POLICY "Super admins can delete contact submissions"
ON public.contact_form_submissions FOR DELETE TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins can update contact submissions" ON public.contact_form_submissions;
CREATE POLICY "Super admins can update contact submissions"
ON public.contact_form_submissions FOR UPDATE TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins can view contact submissions" ON public.contact_form_submissions;
CREATE POLICY "Super admins can view contact submissions"
ON public.contact_form_submissions FOR SELECT TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins podem ver logs de campanha" ON public.email_campanha_logs;
CREATE POLICY "Super admins podem ver logs de campanha"
ON public.email_campanha_logs FOR SELECT TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins podem ver campanhas" ON public.email_campanhas;
CREATE POLICY "Super admins podem ver campanhas"
ON public.email_campanhas FOR SELECT TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins podem criar campanhas" ON public.email_campanhas;
CREATE POLICY "Super admins podem criar campanhas"
ON public.email_campanhas FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Super admins podem atualizar campanhas" ON public.email_campanhas;
CREATE POLICY "Super admins podem atualizar campanhas"
ON public.email_campanhas FOR UPDATE TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins podem deletar campanhas" ON public.email_campanhas;
CREATE POLICY "Super admins podem deletar campanhas"
ON public.email_campanhas FOR DELETE TO authenticated USING (is_super_admin());

-- 4) Revoke EXECUTE on all SECURITY DEFINER public functions from anon/PUBLIC,
--    then re-grant to a small whitelist of truly public-facing functions.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid,
           n.nspname,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true AND n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Re-grant to anon for genuinely public-facing helpers (whistleblower / assessment token / company slug lookups)
GRANT EXECUTE ON FUNCTION public.can_update_assessment_via_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assessment_empresa_info(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_denuncia_config_publica(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_empresa_by_slug(text) TO anon, authenticated;
