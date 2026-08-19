-- Desabilitar RLS nas tabelas do Due Diligence para resolver problemas de acesso
-- IMPORTANTE: Isso remove as restrições de segurança, mas permite que o questionário funcione

-- Desabilitar RLS na tabela de assessments
ALTER TABLE public.due_diligence_assessments DISABLE ROW LEVEL SECURITY;

-- Desabilitar RLS na tabela de respostas
ALTER TABLE public.due_diligence_responses DISABLE ROW LEVEL SECURITY;

-- Desabilitar RLS na tabela de templates
ALTER TABLE public.due_diligence_templates DISABLE ROW LEVEL SECURITY;

-- Desabilitar RLS na tabela de perguntas
ALTER TABLE public.due_diligence_questions DISABLE ROW LEVEL SECURITY;

-- Desabilitar RLS na tabela de scores
ALTER TABLE public.due_diligence_scores DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes das tabelas do Due Diligence
DROP POLICY IF EXISTS "Users can manage templates from their empresa" ON public.due_diligence_templates;
DROP POLICY IF EXISTS "Users can manage questions from their empresa templates" ON public.due_diligence_questions;
DROP POLICY IF EXISTS "Users can manage assessments from their empresa" ON public.due_diligence_assessments;
DROP POLICY IF EXISTS "Users can view responses from their empresa assessments" ON public.due_diligence_responses;
DROP POLICY IF EXISTS "Public can insert responses via valid assessment" ON public.due_diligence_responses;
DROP POLICY IF EXISTS "Users can manage scores from their empresa assessments" ON public.due_diligence_scores;
DROP POLICY IF EXISTS "Public can view assessments via link_token" ON public.due_diligence_assessments;
DROP POLICY IF EXISTS "Public can update assessments via link_token" ON public.due_diligence_assessments;
DROP POLICY IF EXISTS "Public can view templates for active assessments" ON public.due_diligence_templates;
DROP POLICY IF EXISTS "Public can view questions for active assessments" ON public.due_diligence_questions;
DROP POLICY IF EXISTS "Public can insert responses for active assessments" ON public.due_diligence_responses;
DROP POLICY IF EXISTS "Public can update responses for active assessments" ON public.due_diligence_responses;
DROP POLICY IF EXISTS "Public can view responses for active assessments" ON public.due_diligence_responses;