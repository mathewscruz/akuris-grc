DROP POLICY IF EXISTS "View assessment via matching link_token header" ON public.due_diligence_assessments;
DROP POLICY IF EXISTS "Update assessment via matching link_token header" ON public.due_diligence_assessments;
DROP POLICY IF EXISTS "Token-bearer can view questions for active assessments" ON public.due_diligence_questions;
DROP POLICY IF EXISTS "View responses via matching assessment token" ON public.due_diligence_responses;
DROP POLICY IF EXISTS "Insert responses via matching assessment token" ON public.due_diligence_responses;
DROP POLICY IF EXISTS "Update responses via matching assessment token" ON public.due_diligence_responses;

CREATE POLICY "Authenticated users view assessments from their empresa"
ON public.due_diligence_assessments FOR SELECT TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Authenticated users update assessments from their empresa"
ON public.due_diligence_assessments FOR UPDATE TO authenticated
USING (empresa_id = public.get_user_empresa_id())
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Authenticated users view assessment questions"
ON public.due_diligence_questions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.due_diligence_assessments a
    WHERE a.template_id = due_diligence_questions.template_id
      AND a.empresa_id = public.get_user_empresa_id()
  )
  OR EXISTS (
    SELECT 1 FROM public.due_diligence_templates t
    WHERE t.id = due_diligence_questions.template_id
      AND t.empresa_id = public.get_user_empresa_id()
  )
);

CREATE POLICY "Authenticated users view responses from their empresa"
ON public.due_diligence_responses FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a
  WHERE a.id = due_diligence_responses.assessment_id
    AND a.empresa_id = public.get_user_empresa_id()
));

CREATE POLICY "Authenticated users insert responses from their empresa"
ON public.due_diligence_responses FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a
  WHERE a.id = due_diligence_responses.assessment_id
    AND a.empresa_id = public.get_user_empresa_id()
));

CREATE POLICY "Authenticated users update responses from their empresa"
ON public.due_diligence_responses FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a
  WHERE a.id = due_diligence_responses.assessment_id
    AND a.empresa_id = public.get_user_empresa_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a
  WHERE a.id = due_diligence_responses.assessment_id
    AND a.empresa_id = public.get_user_empresa_id()
));

REVOKE ALL ON public.due_diligence_assessments FROM anon;
REVOKE ALL ON public.due_diligence_questions FROM anon;
REVOKE ALL ON public.due_diligence_responses FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.due_diligence_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.due_diligence_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.due_diligence_responses TO authenticated;
GRANT ALL ON public.due_diligence_assessments TO service_role;
GRANT ALL ON public.due_diligence_questions TO service_role;
GRANT ALL ON public.due_diligence_responses TO service_role;

ALTER TABLE public.due_diligence_responses
ADD CONSTRAINT due_diligence_responses_assessment_question_key UNIQUE (assessment_id, question_id);

DROP POLICY IF EXISTS due_diligence_evid_insert_valid_assessment ON storage.objects;
DROP POLICY IF EXISTS "due_diligence_evid_insert_valid_assessment" ON storage.objects;
DROP POLICY IF EXISTS "due_diligence_evid_select_empresa" ON storage.objects;

CREATE POLICY "Authenticated users read due diligence evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'due-diligence-evidencias'
  AND EXISTS (
    SELECT 1 FROM public.due_diligence_assessments a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND a.empresa_id = public.get_user_empresa_id()
  )
);

CREATE POLICY "Authenticated users upload due diligence evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'due-diligence-evidencias'
  AND EXISTS (
    SELECT 1 FROM public.due_diligence_assessments a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND a.empresa_id = public.get_user_empresa_id()
  )
);