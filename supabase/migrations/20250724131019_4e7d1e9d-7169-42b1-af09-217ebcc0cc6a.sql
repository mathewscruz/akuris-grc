-- FASE 1: Criar política ausente para due_diligence_scores
CREATE POLICY "Users can view scores from their company assessments" 
ON public.due_diligence_scores 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.due_diligence_assessments a
    WHERE a.id = due_diligence_scores.assessment_id 
    AND a.empresa_id = public.get_user_empresa_id()
  )
);

CREATE POLICY "Users can create scores for their company assessments" 
ON public.due_diligence_scores 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.due_diligence_assessments a
    WHERE a.id = due_diligence_scores.assessment_id 
    AND a.empresa_id = public.get_user_empresa_id()
  )
);

CREATE POLICY "Users can update scores from their company assessments" 
ON public.due_diligence_scores 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.due_diligence_assessments a
    WHERE a.id = due_diligence_scores.assessment_id 
    AND a.empresa_id = public.get_user_empresa_id()
  )
);

-- FASE 2: Habilitar RLS em ordem de dependência

-- 1. Templates (não afeta assessments ativos)
ALTER TABLE public.due_diligence_templates ENABLE ROW LEVEL SECURITY;

-- 2. Questions (vinculado aos templates)
ALTER TABLE public.due_diligence_questions ENABLE ROW LEVEL SECURITY;

-- 3. Assessments (tabela principal)
ALTER TABLE public.due_diligence_assessments ENABLE ROW LEVEL SECURITY;

-- 4. Responses (depende dos assessments)
ALTER TABLE public.due_diligence_responses ENABLE ROW LEVEL SECURITY;

-- 5. Scores (depende dos assessments)
ALTER TABLE public.due_diligence_scores ENABLE ROW LEVEL SECURITY;