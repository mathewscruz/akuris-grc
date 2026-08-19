-- Criar políticas RLS para due_diligence_assessments baseadas na empresa

-- Política para DELETE - permitir que usuários excluam assessments da sua empresa
CREATE POLICY "Users can delete assessments from their empresa" 
ON public.due_diligence_assessments 
FOR DELETE 
USING (empresa_id = public.get_user_empresa_id());

-- Política para INSERT - permitir que usuários criem assessments na sua empresa
CREATE POLICY "Users can insert assessments in their empresa" 
ON public.due_diligence_assessments 
FOR INSERT 
WITH CHECK (empresa_id = public.get_user_empresa_id());

-- Política para SELECT - permitir que usuários vejam assessments da sua empresa
CREATE POLICY "Users can view assessments from their empresa" 
ON public.due_diligence_assessments 
FOR SELECT 
USING (empresa_id = public.get_user_empresa_id());

-- Política para UPDATE - permitir que usuários atualizem assessments da sua empresa
CREATE POLICY "Users can update assessments from their empresa" 
ON public.due_diligence_assessments 
FOR UPDATE 
USING (empresa_id = public.get_user_empresa_id());

-- Verificar se as tabelas relacionadas têm cascade delete ou precisam de políticas
-- Criar políticas para due_diligence_responses
CREATE POLICY "Users can delete responses from their empresa assessments" 
ON public.due_diligence_responses 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a 
  WHERE a.id = due_diligence_responses.assessment_id 
  AND a.empresa_id = public.get_user_empresa_id()
));

CREATE POLICY "Users can insert responses in their empresa assessments" 
ON public.due_diligence_responses 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a 
  WHERE a.id = due_diligence_responses.assessment_id 
  AND a.empresa_id = public.get_user_empresa_id()
));

CREATE POLICY "Users can view responses from their empresa assessments" 
ON public.due_diligence_responses 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a 
  WHERE a.id = due_diligence_responses.assessment_id 
  AND a.empresa_id = public.get_user_empresa_id()
));

CREATE POLICY "Users can update responses from their empresa assessments" 
ON public.due_diligence_responses 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a 
  WHERE a.id = due_diligence_responses.assessment_id 
  AND a.empresa_id = public.get_user_empresa_id()
));

-- Criar políticas para due_diligence_scores
CREATE POLICY "Users can delete scores from their empresa assessments" 
ON public.due_diligence_scores 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a 
  WHERE a.id = due_diligence_scores.assessment_id 
  AND a.empresa_id = public.get_user_empresa_id()
));

CREATE POLICY "Users can insert scores in their empresa assessments" 
ON public.due_diligence_scores 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a 
  WHERE a.id = due_diligence_scores.assessment_id 
  AND a.empresa_id = public.get_user_empresa_id()
));

CREATE POLICY "Users can view scores from their empresa assessments" 
ON public.due_diligence_scores 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a 
  WHERE a.id = due_diligence_scores.assessment_id 
  AND a.empresa_id = public.get_user_empresa_id()
));

CREATE POLICY "Users can update scores from their empresa assessments" 
ON public.due_diligence_scores 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.due_diligence_assessments a 
  WHERE a.id = due_diligence_scores.assessment_id 
  AND a.empresa_id = public.get_user_empresa_id()
));