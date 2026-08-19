-- Criar a tabela gap_analysis_evaluations caso não exista
CREATE TABLE IF NOT EXISTS public.gap_analysis_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL,
  framework_id UUID NOT NULL,
  assessment_id UUID NULL,
  evidence_implemented TEXT,
  responsible_area TEXT,
  conformity_status TEXT NOT NULL DEFAULT 'nao_aplicavel',
  action_preview TEXT,
  evidence_status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  empresa_id UUID NOT NULL DEFAULT get_user_empresa_id()
);

-- Enable RLS
ALTER TABLE public.gap_analysis_evaluations ENABLE ROW LEVEL SECURITY;

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

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_gap_analysis_evaluations_updated_at
BEFORE UPDATE ON public.gap_analysis_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();