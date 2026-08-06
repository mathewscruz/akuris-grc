DROP POLICY IF EXISTS "Users can insert assessments in their empresa" ON public.due_diligence_assessments;
DROP POLICY IF EXISTS "Users can delete assessments from their empresa" ON public.due_diligence_assessments;
DROP POLICY IF EXISTS "Users can delete responses from their empresa assessments" ON public.due_diligence_responses;

CREATE POLICY "Authenticated users insert assessments in their empresa"
ON public.due_diligence_assessments FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Authenticated users delete assessments from their empresa"
ON public.due_diligence_assessments FOR DELETE TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Authenticated users delete responses from their empresa"
ON public.due_diligence_responses FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a
  WHERE a.id = due_diligence_responses.assessment_id
    AND a.empresa_id = public.get_user_empresa_id()
));

REVOKE EXECUTE ON FUNCTION public.get_assessment_empresa_info(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assessment_empresa_info(text) TO authenticated, service_role;