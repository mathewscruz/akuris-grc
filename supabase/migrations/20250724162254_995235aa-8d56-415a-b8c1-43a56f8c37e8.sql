-- Corrigir estrutura da tabela gap_analysis_evaluations
-- Adicionar campo evidence_files para armazenar metadados dos arquivos
ALTER TABLE public.gap_analysis_evaluations 
ADD COLUMN IF NOT EXISTS evidence_files jsonb DEFAULT '[]'::jsonb;

-- Remover constraint antiga se existir
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'gap_analysis_evaluations_assessment_id_requirement_id_key'
        AND table_name = 'gap_analysis_evaluations'
    ) THEN
        ALTER TABLE public.gap_analysis_evaluations 
        DROP CONSTRAINT gap_analysis_evaluations_assessment_id_requirement_id_key;
    END IF;
END $$;

-- Adicionar nova constraint única usando framework_id em vez de assessment_id
ALTER TABLE public.gap_analysis_evaluations 
ADD CONSTRAINT gap_analysis_evaluations_framework_id_requirement_id_key 
UNIQUE (framework_id, requirement_id);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_gap_analysis_evaluations_framework_id 
ON public.gap_analysis_evaluations (framework_id);

-- Atualizar função para verificar se evaluation pertence à empresa
CREATE OR REPLACE FUNCTION public.evaluation_pertence_empresa(evaluation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.gap_analysis_evaluations e
    INNER JOIN public.gap_analysis_frameworks f ON e.framework_id = f.id
    WHERE e.id = evaluation_id AND f.empresa_id = public.get_user_empresa_id()
  );
$function$;