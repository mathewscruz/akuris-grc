-- Criar tabela de fornecedores se não existir
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  email TEXT,
  cnpj TEXT,
  telefone TEXT,
  endereco TEXT,
  contato_principal TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fornecedores
CREATE POLICY "Users can view fornecedores from their empresa" 
ON public.fornecedores 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert fornecedores in their empresa" 
ON public.fornecedores 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update fornecedores from their empresa" 
ON public.fornecedores 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete fornecedores from their empresa" 
ON public.fornecedores 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Trigger para updated_at
CREATE TRIGGER update_fornecedores_updated_at
BEFORE UPDATE ON public.fornecedores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();