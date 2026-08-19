
-- Create risk matrices table
CREATE TABLE public.riscos_matrizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create risk categories table
CREATE TABLE public.riscos_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create matrix configuration table
CREATE TABLE public.riscos_matriz_configuracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matriz_id UUID NOT NULL REFERENCES riscos_matrizes(id) ON DELETE CASCADE,
  escala_probabilidade JSONB NOT NULL,
  escala_impacto JSONB NOT NULL,
  niveis_risco JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create risks table
CREATE TABLE public.riscos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  matriz_id UUID REFERENCES riscos_matrizes(id),
  categoria_id UUID REFERENCES riscos_categorias(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  probabilidade_inicial TEXT NOT NULL,
  impacto_inicial TEXT NOT NULL,
  nivel_risco_inicial TEXT NOT NULL,
  probabilidade_residual TEXT,
  impacto_residual TEXT,
  nivel_risco_residual TEXT,
  status TEXT NOT NULL DEFAULT 'identificado',
  data_identificacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_avaliacao DATE,
  responsavel TEXT,
  controles_existentes TEXT,
  causas TEXT,
  consequencias TEXT,
  aceito BOOLEAN DEFAULT FALSE,
  justificativa_aceite TEXT,
  aprovador_aceite UUID REFERENCES profiles(user_id),
  data_aceite TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create risk treatments table
CREATE TABLE public.riscos_tratamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risco_id UUID NOT NULL REFERENCES riscos(id) ON DELETE CASCADE,
  tipo_tratamento TEXT NOT NULL,
  descricao TEXT NOT NULL,
  responsavel TEXT,
  custo NUMERIC,
  prazo DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_inicio DATE,
  data_conclusao DATE,
  eficacia TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create risk-assets link table
CREATE TABLE public.riscos_ativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risco_id UUID NOT NULL REFERENCES riscos(id) ON DELETE CASCADE,
  ativo_id UUID NOT NULL REFERENCES ativos(id) ON DELETE CASCADE,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(risco_id, ativo_id)
);

-- Create helper functions
CREATE OR REPLACE FUNCTION public.matriz_pertence_empresa(matriz_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM riscos_matrizes 
    WHERE id = matriz_id AND empresa_id = get_user_empresa_id()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.risco_pertence_empresa(risco_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM riscos 
    WHERE id = risco_id AND empresa_id = get_user_empresa_id()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Enable RLS and create policies
ALTER TABLE public.riscos_matrizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riscos_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riscos_matriz_configuracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riscos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riscos_tratamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riscos_ativos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for riscos_matrizes
CREATE POLICY "Users can view matrices from their empresa" 
  ON public.riscos_matrizes FOR SELECT 
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert matrices in their empresa" 
  ON public.riscos_matrizes FOR INSERT 
  WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update matrices from their empresa" 
  ON public.riscos_matrizes FOR UPDATE 
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete matrices from their empresa" 
  ON public.riscos_matrizes FOR DELETE 
  USING (empresa_id = get_user_empresa_id());

-- RLS Policies for riscos_categorias
CREATE POLICY "Users can view risk categories from their empresa" 
  ON public.riscos_categorias FOR SELECT 
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert risk categories in their empresa" 
  ON public.riscos_categorias FOR INSERT 
  WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update risk categories from their empresa" 
  ON public.riscos_categorias FOR UPDATE 
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete risk categories from their empresa" 
  ON public.riscos_categorias FOR DELETE 
  USING (empresa_id = get_user_empresa_id());

-- RLS Policies for riscos_matriz_configuracao
CREATE POLICY "Users can view matrix config from their empresa" 
  ON public.riscos_matriz_configuracao FOR SELECT 
  USING (matriz_pertence_empresa(matriz_id));

CREATE POLICY "Users can insert matrix config in their empresa" 
  ON public.riscos_matriz_configuracao FOR INSERT 
  WITH CHECK (matriz_pertence_empresa(matriz_id));

CREATE POLICY "Users can update matrix config from their empresa" 
  ON public.riscos_matriz_configuracao FOR UPDATE 
  USING (matriz_pertence_empresa(matriz_id));

CREATE POLICY "Users can delete matrix config from their empresa" 
  ON public.riscos_matriz_configuracao FOR DELETE 
  USING (matriz_pertence_empresa(matriz_id));

-- RLS Policies for riscos
CREATE POLICY "Users can view risks from their empresa" 
  ON public.riscos FOR SELECT 
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert risks in their empresa" 
  ON public.riscos FOR INSERT 
  WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update risks from their empresa" 
  ON public.riscos FOR UPDATE 
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete risks from their empresa" 
  ON public.riscos FOR DELETE 
  USING (empresa_id = get_user_empresa_id());

-- RLS Policies for riscos_tratamentos
CREATE POLICY "Users can view risk treatments from their empresa" 
  ON public.riscos_tratamentos FOR SELECT 
  USING (risco_pertence_empresa(risco_id));

CREATE POLICY "Users can insert risk treatments in their empresa" 
  ON public.riscos_tratamentos FOR INSERT 
  WITH CHECK (risco_pertence_empresa(risco_id));

CREATE POLICY "Users can update risk treatments from their empresa" 
  ON public.riscos_tratamentos FOR UPDATE 
  USING (risco_pertence_empresa(risco_id));

CREATE POLICY "Users can delete risk treatments from their empresa" 
  ON public.riscos_tratamentos FOR DELETE 
  USING (risco_pertence_empresa(risco_id));

-- RLS Policies for riscos_ativos
CREATE POLICY "Users can view risk-asset links from their empresa" 
  ON public.riscos_ativos FOR SELECT 
  USING (risco_pertence_empresa(risco_id));

CREATE POLICY "Users can insert risk-asset links in their empresa" 
  ON public.riscos_ativos FOR INSERT 
  WITH CHECK (risco_pertence_empresa(risco_id));

CREATE POLICY "Users can update risk-asset links from their empresa" 
  ON public.riscos_ativos FOR UPDATE 
  USING (risco_pertence_empresa(risco_id));

CREATE POLICY "Users can delete risk-asset links from their empresa" 
  ON public.riscos_ativos FOR DELETE 
  USING (risco_pertence_empresa(risco_id));

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_riscos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_riscos_matrizes_updated_at
  BEFORE UPDATE ON public.riscos_matrizes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_riscos_updated_at();

CREATE TRIGGER update_riscos_categorias_updated_at
  BEFORE UPDATE ON public.riscos_categorias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_riscos_updated_at();

CREATE TRIGGER update_riscos_matriz_configuracao_updated_at
  BEFORE UPDATE ON public.riscos_matriz_configuracao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_riscos_updated_at();

CREATE TRIGGER update_riscos_updated_at
  BEFORE UPDATE ON public.riscos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_riscos_updated_at();

CREATE TRIGGER update_riscos_tratamentos_updated_at
  BEFORE UPDATE ON public.riscos_tratamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_riscos_updated_at();
