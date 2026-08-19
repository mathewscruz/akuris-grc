-- Adicionar colunas necessárias à tabela existente gap_analysis_evaluations
ALTER TABLE public.gap_analysis_evaluations 
ADD COLUMN IF NOT EXISTS evidence_implemented TEXT,
ADD COLUMN IF NOT EXISTS responsible_area TEXT,
ADD COLUMN IF NOT EXISTS conformity_status TEXT DEFAULT 'nao_aplicavel',
ADD COLUMN IF NOT EXISTS action_preview TEXT,
ADD COLUMN IF NOT EXISTS evidence_status TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS framework_id UUID,
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT get_user_empresa_id();

-- Atualizar registros existentes com empresa_id se não tiver
UPDATE public.gap_analysis_evaluations 
SET empresa_id = get_user_empresa_id() 
WHERE empresa_id IS NULL;

-- Tornar empresa_id NOT NULL
ALTER TABLE public.gap_analysis_evaluations 
ALTER COLUMN empresa_id SET NOT NULL;

-- Enable RLS se não estiver habilitado
ALTER TABLE public.gap_analysis_evaluations ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view evaluations from their empresa" ON public.gap_analysis_evaluations;
DROP POLICY IF EXISTS "Users can insert evaluations in their empresa" ON public.gap_analysis_evaluations;
DROP POLICY IF EXISTS "Users can update evaluations from their empresa" ON public.gap_analysis_evaluations;
DROP POLICY IF EXISTS "Users can delete evaluations from their empresa" ON public.gap_analysis_evaluations;

-- Create policies for evaluations
CREATE POLICY "Users can view evaluations from their empresa" 
ON public.gap_analysis_evaluations 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert evaluations in their empresa" 
ON public.gap_analysis_evaluations 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update evaluations from their empresa" 
ON public.gap_analysis_evaluations 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete evaluations from their empresa" 
ON public.gap_analysis_evaluations 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());