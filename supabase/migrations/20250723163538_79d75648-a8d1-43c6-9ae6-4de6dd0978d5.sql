-- Adicionar campo ultimo_lembrete_enviado na tabela due_diligence_assessments
ALTER TABLE public.due_diligence_assessments 
ADD COLUMN IF NOT EXISTS ultimo_lembrete_enviado TIMESTAMP WITH TIME ZONE;