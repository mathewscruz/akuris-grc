-- Fix RLS policies for public access to due diligence assessments via link_token

-- Allow public access to assessments via link_token (for email links)
CREATE POLICY "Public can view assessments via link_token"
ON public.due_diligence_assessments
FOR SELECT
TO anon, authenticated
USING (
  link_token IS NOT NULL 
  AND status IN ('enviado', 'em_andamento')
);

-- Allow public updates to assessments via link_token (to mark as started/completed)
CREATE POLICY "Public can update assessments via link_token"
ON public.due_diligence_assessments
FOR UPDATE
TO anon, authenticated
USING (
  link_token IS NOT NULL 
  AND status IN ('enviado', 'em_andamento')
)
WITH CHECK (
  link_token IS NOT NULL 
  AND status IN ('enviado', 'em_andamento', 'concluido')
);

-- Allow public access to templates for active assessments
CREATE POLICY "Public can view templates for active assessments"
ON public.due_diligence_templates
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.template_id = due_diligence_templates.id 
    AND a.link_token IS NOT NULL 
    AND a.status IN ('enviado', 'em_andamento')
  )
);

-- Allow public access to questions for active assessments
CREATE POLICY "Public can view questions for active assessments"
ON public.due_diligence_questions
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.template_id = due_diligence_questions.template_id 
    AND a.link_token IS NOT NULL 
    AND a.status IN ('enviado', 'em_andamento')
  )
);

-- Allow public insert of responses for active assessments
CREATE POLICY "Public can insert responses for active assessments"
ON public.due_diligence_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.id = due_diligence_responses.assessment_id 
    AND a.link_token IS NOT NULL 
    AND a.status IN ('enviado', 'em_andamento')
  )
);

-- Allow public update of responses for active assessments
CREATE POLICY "Public can update responses for active assessments"
ON public.due_diligence_responses
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.id = due_diligence_responses.assessment_id 
    AND a.link_token IS NOT NULL 
    AND a.status IN ('enviado', 'em_andamento')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.id = due_diligence_responses.assessment_id 
    AND a.link_token IS NOT NULL 
    AND a.status IN ('enviado', 'em_andamento')
  )
);

-- Allow public view of responses for active assessments (needed for loading existing responses)
CREATE POLICY "Public can view responses for active assessments"
ON public.due_diligence_responses
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.id = due_diligence_responses.assessment_id 
    AND a.link_token IS NOT NULL 
    AND a.status IN ('enviado', 'em_andamento', 'concluido')
  )
);