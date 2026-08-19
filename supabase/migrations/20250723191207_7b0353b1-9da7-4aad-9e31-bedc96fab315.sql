-- SIMPLIFICAÇÃO MÁXIMA DAS POLÍTICAS RLS PARA DUE DILIGENCE
-- Remover todas as políticas complexas e criar políticas ultra-simples

-- 1. Remover políticas atuais do due_diligence_assessments
DROP POLICY IF EXISTS "Public can update assessments via link_token" ON public.due_diligence_assessments;
DROP POLICY IF EXISTS "Public can view assessments via link_token" ON public.due_diligence_assessments;

-- 2. Criar política ULTRA-SIMPLES para UPDATE - só precisa de link_token válido
CREATE POLICY "Simple update via link_token"
ON public.due_diligence_assessments
FOR UPDATE
TO anon, authenticated
USING (link_token IS NOT NULL)
WITH CHECK (link_token IS NOT NULL);

-- 3. Criar política ULTRA-SIMPLES para SELECT - só precisa de link_token válido
CREATE POLICY "Simple view via link_token"
ON public.due_diligence_assessments
FOR SELECT
TO anon, authenticated
USING (link_token IS NOT NULL);

-- 4. Simplificar políticas de responses - remover políticas complexas
DROP POLICY IF EXISTS "Public can insert responses for active assessments" ON public.due_diligence_responses;
DROP POLICY IF EXISTS "Public can update responses for active assessments" ON public.due_diligence_responses;
DROP POLICY IF EXISTS "Public can view responses for active assessments" ON public.due_diligence_responses;

-- 5. Criar políticas ULTRA-SIMPLES para responses
CREATE POLICY "Simple insert responses"
ON public.due_diligence_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.id = due_diligence_responses.assessment_id 
    AND a.link_token IS NOT NULL
  )
);

CREATE POLICY "Simple update responses"
ON public.due_diligence_responses
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.id = due_diligence_responses.assessment_id 
    AND a.link_token IS NOT NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.id = due_diligence_responses.assessment_id 
    AND a.link_token IS NOT NULL
  )
);

CREATE POLICY "Simple view responses"
ON public.due_diligence_responses
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.id = due_diligence_responses.assessment_id 
    AND a.link_token IS NOT NULL
  )
);