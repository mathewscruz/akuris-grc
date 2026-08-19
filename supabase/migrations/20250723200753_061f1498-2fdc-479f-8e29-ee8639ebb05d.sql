-- Add RLS policy to allow authenticated users to view questions from standard templates
CREATE POLICY "Users can view questions from standard templates" 
ON public.due_diligence_questions 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM due_diligence_templates t 
    WHERE t.id = due_diligence_questions.template_id 
    AND t.padrao = true
  )
);