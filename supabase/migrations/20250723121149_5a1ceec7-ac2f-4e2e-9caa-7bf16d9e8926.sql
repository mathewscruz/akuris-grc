-- Criação das tabelas para o módulo de incidentes
CREATE TABLE public.incidentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo_incidente TEXT NOT NULL DEFAULT 'seguranca'::TEXT,
  categoria TEXT,
  criticidade TEXT NOT NULL DEFAULT 'media'::TEXT,
  data_ocorrencia TIMESTAMP WITH TIME ZONE,
  data_deteccao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_resolucao TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'aberto'::TEXT,
  origem_deteccao TEXT,
  responsavel_deteccao UUID,
  responsavel_tratamento UUID,
  impacto_estimado TEXT,
  dados_afetados TEXT,
  sistemas_afetados TEXT[],
  ativos_afetados UUID[],
  riscos_relacionados UUID[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Tabela para tratamentos do incidente
CREATE TABLE public.incidentes_tratamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incidente_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  responsavel_id UUID,
  data_prazo DATE,
  status TEXT NOT NULL DEFAULT 'pendente'::TEXT,
  tipo_acao TEXT NOT NULL DEFAULT 'corretiva'::TEXT,
  observacoes TEXT,
  data_conclusao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Tabela para comunicações do incidente
CREATE TABLE public.incidentes_comunicacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incidente_id UUID NOT NULL,
  tipo_comunicacao TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  data_comunicacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  meio_comunicacao TEXT NOT NULL DEFAULT 'email'::TEXT,
  observacoes TEXT,
  template_usado TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Tabela para evidências do incidente
CREATE TABLE public.incidentes_evidencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incidente_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tipo TEXT,
  arquivo_tamanho BIGINT,
  tipo_evidencia TEXT NOT NULL DEFAULT 'documento'::TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.incidentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidentes_tratamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidentes_comunicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidentes_evidencias ENABLE ROW LEVEL SECURITY;

-- Função para verificar se incidente pertence à empresa
CREATE OR REPLACE FUNCTION public.incidente_pertence_empresa(incidente_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM incidentes 
    WHERE id = incidente_id AND empresa_id = get_user_empresa_id()
  );
$function$;

-- Políticas RLS para incidentes
CREATE POLICY "Users can view incidentes from their empresa" 
ON public.incidentes 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert incidentes in their empresa" 
ON public.incidentes 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update incidentes from their empresa" 
ON public.incidentes 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete incidentes from their empresa" 
ON public.incidentes 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Políticas RLS para tratamentos
CREATE POLICY "Users can view tratamentos from their empresa" 
ON public.incidentes_tratamentos 
FOR SELECT 
USING (incidente_pertence_empresa(incidente_id));

CREATE POLICY "Users can insert tratamentos in their empresa" 
ON public.incidentes_tratamentos 
FOR INSERT 
WITH CHECK (incidente_pertence_empresa(incidente_id));

CREATE POLICY "Users can update tratamentos from their empresa" 
ON public.incidentes_tratamentos 
FOR UPDATE 
USING (incidente_pertence_empresa(incidente_id));

CREATE POLICY "Users can delete tratamentos from their empresa" 
ON public.incidentes_tratamentos 
FOR DELETE 
USING (incidente_pertence_empresa(incidente_id));

-- Políticas RLS para comunicações
CREATE POLICY "Users can view comunicacoes from their empresa" 
ON public.incidentes_comunicacoes 
FOR SELECT 
USING (incidente_pertence_empresa(incidente_id));

CREATE POLICY "Users can insert comunicacoes in their empresa" 
ON public.incidentes_comunicacoes 
FOR INSERT 
WITH CHECK (incidente_pertence_empresa(incidente_id));

CREATE POLICY "Users can update comunicacoes from their empresa" 
ON public.incidentes_comunicacoes 
FOR UPDATE 
USING (incidente_pertence_empresa(incidente_id));

CREATE POLICY "Users can delete comunicacoes from their empresa" 
ON public.incidentes_comunicacoes 
FOR DELETE 
USING (incidente_pertence_empresa(incidente_id));

-- Políticas RLS para evidências
CREATE POLICY "Users can view evidencias from their empresa" 
ON public.incidentes_evidencias 
FOR SELECT 
USING (incidente_pertence_empresa(incidente_id));

CREATE POLICY "Users can insert evidencias in their empresa" 
ON public.incidentes_evidencias 
FOR INSERT 
WITH CHECK (incidente_pertence_empresa(incidente_id));

CREATE POLICY "Users can update evidencias from their empresa" 
ON public.incidentes_evidencias 
FOR UPDATE 
USING (incidente_pertence_empresa(incidente_id));

CREATE POLICY "Users can delete evidencias from their empresa" 
ON public.incidentes_evidencias 
FOR DELETE 
USING (incidente_pertence_empresa(incidente_id));

-- Triggers para updated_at
CREATE TRIGGER update_incidentes_updated_at
  BEFORE UPDATE ON public.incidentes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incidentes_tratamentos_updated_at
  BEFORE UPDATE ON public.incidentes_tratamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();