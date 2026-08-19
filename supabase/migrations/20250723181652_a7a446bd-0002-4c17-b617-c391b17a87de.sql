-- Corrigir definitivamente a política RLS para permitir UPDATE de assessments via link_token
DROP POLICY IF EXISTS "Public can update assessments via link_token" ON public.due_diligence_assessments;

-- Política mais robusta que permite UPDATE com verificação de status
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
  AND (
    -- Permite manter o mesmo status
    status = (SELECT status FROM due_diligence_assessments WHERE id = due_diligence_assessments.id)
    OR
    -- Permite transições válidas
    (
      (SELECT status FROM due_diligence_assessments WHERE id = due_diligence_assessments.id) = 'enviado' 
      AND status IN ('em_andamento', 'concluido')
    )
    OR
    (
      (SELECT status FROM due_diligence_assessments WHERE id = due_diligence_assessments.id) = 'em_andamento' 
      AND status = 'concluido'
    )
  )
);