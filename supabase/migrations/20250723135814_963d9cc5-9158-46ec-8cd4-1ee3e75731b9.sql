-- Adicionar novos campos na tabela ativos
ALTER TABLE public.ativos 
ADD COLUMN imei TEXT,
ADD COLUMN cliente TEXT,
ADD COLUMN quantidade INTEGER DEFAULT 1;

-- Criar tabela para gerenciar localizações
CREATE TABLE public.ativos_localizacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS para ativos_localizacoes
ALTER TABLE public.ativos_localizacoes ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para ativos_localizacoes
CREATE POLICY "Users can view locations from their empresa" 
ON public.ativos_localizacoes 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert locations in their empresa" 
ON public.ativos_localizacoes 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update locations from their empresa" 
ON public.ativos_localizacoes 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete locations from their empresa" 
ON public.ativos_localizacoes 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_ativos_localizacoes_updated_at
BEFORE UPDATE ON public.ativos_localizacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();