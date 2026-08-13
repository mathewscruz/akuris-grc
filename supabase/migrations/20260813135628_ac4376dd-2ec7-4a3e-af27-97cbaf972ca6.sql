ALTER TABLE public.gap_analysis_requirements
  ADD COLUMN IF NOT EXISTS titulo_en text,
  ADD COLUMN IF NOT EXISTS descricao_en text,
  ADD COLUMN IF NOT EXISTS categoria_en text,
  ADD COLUMN IF NOT EXISTS orientacao_implementacao_en text,
  ADD COLUMN IF NOT EXISTS exemplos_evidencias_en text,
  ADD COLUMN IF NOT EXISTS perguntas_diagnostico_en text;

ALTER TABLE public.gap_analysis_frameworks
  ADD COLUMN IF NOT EXISTS nome_en text,
  ADD COLUMN IF NOT EXISTS descricao_en text;