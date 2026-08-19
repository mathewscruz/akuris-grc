-- Adicionar coluna arquivo_url na tabela due_diligence_responses para suporte a uploads
ALTER TABLE public.due_diligence_responses 
ADD COLUMN IF NOT EXISTS arquivo_url TEXT;