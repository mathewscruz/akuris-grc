-- Corrigir permissões para o usuário anon nas tabelas do Due Diligence
-- Conceder permissões explícitas para permitir operações sem RLS

-- Conceder permissões SELECT, INSERT, UPDATE para anon user nas tabelas do Due Diligence
GRANT SELECT, INSERT, UPDATE ON public.due_diligence_assessments TO anon;
GRANT SELECT, INSERT, UPDATE ON public.due_diligence_responses TO anon;
GRANT SELECT ON public.due_diligence_templates TO anon;
GRANT SELECT ON public.due_diligence_questions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.due_diligence_scores TO anon;

-- Conceder permissões para authenticated user também
GRANT SELECT, INSERT, UPDATE ON public.due_diligence_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.due_diligence_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.due_diligence_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.due_diligence_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.due_diligence_scores TO authenticated;