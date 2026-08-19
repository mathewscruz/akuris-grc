-- Corrigir definitivamente a RLS policy para permitir transição de status correta
DROP POLICY IF EXISTS "Public can update assessments via link_token" ON public.due_diligence_assessments;

CREATE POLICY "Public can update assessments via link_token"
ON public.due_diligence_assessments
FOR UPDATE
TO anon, authenticated
USING (
  link_token IS NOT NULL
)
WITH CHECK (
  link_token IS NOT NULL 
  AND (
    -- Permite manter status atual ou transicionar para próximo status válido
    status = due_diligence_assessments.status OR
    (due_diligence_assessments.status = 'enviado' AND NEW.status IN ('em_andamento', 'concluido')) OR
    (due_diligence_assessments.status = 'em_andamento' AND NEW.status = 'concluido')
  )
);