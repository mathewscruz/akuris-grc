-- Remover constraint de foreign key que está causando erro
ALTER TABLE public.gap_analysis_evaluations 
DROP CONSTRAINT IF EXISTS gap_analysis_evaluations_assessment_id_fkey;

-- Tornar assessment_id nullable para permitir salvamento sem assessment
ALTER TABLE public.gap_analysis_evaluations 
ALTER COLUMN assessment_id DROP NOT NULL;

-- Adicionar framework_id se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'gap_analysis_evaluations' 
                   AND column_name = 'framework_id') THEN
        ALTER TABLE public.gap_analysis_evaluations 
        ADD COLUMN framework_id uuid;
    END IF;
END $$;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_gap_analysis_evaluations_framework_requirement 
ON public.gap_analysis_evaluations(framework_id, requirement_id);

-- Atualizar constraint única para usar framework_id e requirement_id
ALTER TABLE public.gap_analysis_evaluations 
DROP CONSTRAINT IF EXISTS gap_analysis_evaluations_requirement_id_assessment_id_key;

ALTER TABLE public.gap_analysis_evaluations 
ADD CONSTRAINT gap_analysis_evaluations_framework_requirement_unique 
UNIQUE (framework_id, requirement_id);

-- Adicionar coluna evidence_files se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'gap_analysis_evaluations' 
                   AND column_name = 'evidence_files') THEN
        ALTER TABLE public.gap_analysis_evaluations 
        ADD COLUMN evidence_files jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;