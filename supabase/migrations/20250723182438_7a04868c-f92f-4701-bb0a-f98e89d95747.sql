-- ETAPA 1: Simplificar a política RLS para due_diligence_assessments
-- Remover a política complexa atual e criar uma mais simples

DROP POLICY IF EXISTS "Public can update assessments via link_token" ON public.due_diligence_assessments;

-- Criar função auxiliar para validação simples
CREATE OR REPLACE FUNCTION public.can_update_assessment_via_token(assessment_link_token text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.due_diligence_assessments 
    WHERE link_token = assessment_link_token 
    AND link_token IS NOT NULL
  );
$$;

-- Política RLS simplificada - só verifica se tem link_token válido
CREATE POLICY "Public can update assessments via link_token"
ON public.due_diligence_assessments
FOR UPDATE
TO anon, authenticated
USING (
  link_token IS NOT NULL
)
WITH CHECK (
  link_token IS NOT NULL
);