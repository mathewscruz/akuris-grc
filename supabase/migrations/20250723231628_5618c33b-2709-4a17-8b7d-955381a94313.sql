-- Create table for due diligence integrations
CREATE TABLE public.due_diligence_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo_integracao TEXT NOT NULL, -- 'riscos', 'contratos', 'documentos'
  condicao TEXT NOT NULL, -- 'score_below', 'score_above', 'classification_equals'
  valor_condicao TEXT NOT NULL,
  acao TEXT NOT NULL, -- 'create_risk', 'flag_contract', 'request_document'
  parametros_acao JSONB,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.due_diligence_integrations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view integrations from their empresa" 
ON public.due_diligence_integrations 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert integrations in their empresa" 
ON public.due_diligence_integrations 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update integrations from their empresa" 
ON public.due_diligence_integrations 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete integrations from their empresa" 
ON public.due_diligence_integrations 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Create trigger for updated_at
CREATE TRIGGER update_due_diligence_integrations_updated_at
BEFORE UPDATE ON public.due_diligence_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for integration execution logs
CREATE TABLE public.due_diligence_integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  integration_id UUID NOT NULL,
  assessment_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'executando', -- 'sucesso', 'erro', 'executando'
  resultado JSONB,
  erro_mensagem TEXT,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for logs
ALTER TABLE public.due_diligence_integration_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for logs
CREATE POLICY "Users can view integration logs from their empresa" 
ON public.due_diligence_integration_logs 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());