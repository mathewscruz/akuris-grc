-- Corrigir definitivamente a RLS policy para permitir finalização de assessments
DROP POLICY IF EXISTS "Public can update assessments via link_token" ON public.due_diligence_assessments;

CREATE POLICY "Public can update assessments via link_token"
ON public.due_diligence_assessments
FOR UPDATE
TO anon, authenticated
USING (
  link_token IS NOT NULL 
  AND status IN ('enviado', 'em_andamento', 'concluido')
)
WITH CHECK (
  link_token IS NOT NULL 
  AND status IN ('enviado', 'em_andamento', 'concluido')
);