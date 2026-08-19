-- Adicionar campo area_responsavel à tabela gap_analysis_requirements
ALTER TABLE public.gap_analysis_requirements 
ADD COLUMN IF NOT EXISTS area_responsavel TEXT;