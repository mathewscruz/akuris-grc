
-- Criar tabela de categorias de controles
CREATE TABLE public.controles_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#3B82F6',
  empresa_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela principal de controles
CREATE TABLE public.controles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'preventivo', -- preventivo, detectivo, corretivo
  categoria_id UUID REFERENCES public.controles_categorias(id),
  processo TEXT,
  area TEXT,
  responsavel TEXT,
  frequencia TEXT, -- diaria, semanal, mensal, trimestral, anual
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo, inativo, em_revisao, descontinuado
  criticidade TEXT NOT NULL DEFAULT 'medio', -- baixo, medio, alto, critico
  data_implementacao DATE,
  proxima_avaliacao DATE,
  empresa_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de testes de controles
CREATE TABLE public.controles_testes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  controle_id UUID NOT NULL REFERENCES public.controles(id) ON DELETE CASCADE,
  data_teste DATE NOT NULL,
  resultado TEXT NOT NULL, -- eficaz, ineficaz, parcialmente_eficaz
  observacoes TEXT,
  evidencias TEXT, -- URLs dos arquivos de evidência
  testador TEXT,
  proxima_avaliacao DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de vinculação controles-riscos
CREATE TABLE public.controles_riscos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  controle_id UUID NOT NULL REFERENCES public.controles(id) ON DELETE CASCADE,
  risco_id UUID NOT NULL REFERENCES public.riscos(id) ON DELETE CASCADE,
  tipo_vinculacao TEXT NOT NULL DEFAULT 'mitiga', -- mitiga, monitora, previne
  eficacia_estimada TEXT, -- alta, media, baixa
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de vinculação controles-ativos
CREATE TABLE public.controles_ativos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  controle_id UUID NOT NULL REFERENCES public.controles(id) ON DELETE CASCADE,
  ativo_id UUID NOT NULL REFERENCES public.ativos(id) ON DELETE CASCADE,
  tipo_protecao TEXT NOT NULL DEFAULT 'protege', -- protege, monitora, controla_acesso
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar RLS em todas as tabelas
ALTER TABLE public.controles_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controles_testes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controles_riscos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controles_ativos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para controles_categorias
CREATE POLICY "Users can view control categories from their empresa" 
  ON public.controles_categorias FOR SELECT 
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert control categories in their empresa" 
  ON public.controles_categorias FOR INSERT 
  WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update control categories from their empresa" 
  ON public.controles_categorias FOR UPDATE 
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete control categories from their empresa" 
  ON public.controles_categorias FOR DELETE 
  USING (empresa_id = get_user_empresa_id());

-- Políticas RLS para controles
CREATE POLICY "Users can view controls from their empresa" 
  ON public.controles FOR SELECT 
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert controls in their empresa" 
  ON public.controles FOR INSERT 
  WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update controls from their empresa" 
  ON public.controles FOR UPDATE 
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete controls from their empresa" 
  ON public.controles FOR DELETE 
  USING (empresa_id = get_user_empresa_id());

-- Função auxiliar para verificar se controle pertence à empresa
CREATE OR REPLACE FUNCTION public.controle_pertence_empresa(controle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM controles 
    WHERE id = controle_id AND empresa_id = get_user_empresa_id()
  );
$function$;

-- Políticas RLS para controles_testes
CREATE POLICY "Users can view control tests from their empresa" 
  ON public.controles_testes FOR SELECT 
  USING (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can insert control tests in their empresa" 
  ON public.controles_testes FOR INSERT 
  WITH CHECK (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can update control tests from their empresa" 
  ON public.controles_testes FOR UPDATE 
  USING (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can delete control tests from their empresa" 
  ON public.controles_testes FOR DELETE 
  USING (controle_pertence_empresa(controle_id));

-- Políticas RLS para controles_riscos
CREATE POLICY "Users can view control-risk links from their empresa" 
  ON public.controles_riscos FOR SELECT 
  USING (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can insert control-risk links in their empresa" 
  ON public.controles_riscos FOR INSERT 
  WITH CHECK (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can update control-risk links from their empresa" 
  ON public.controles_riscos FOR UPDATE 
  USING (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can delete control-risk links from their empresa" 
  ON public.controles_riscos FOR DELETE 
  USING (controle_pertence_empresa(controle_id));

-- Políticas RLS para controles_ativos
CREATE POLICY "Users can view control-asset links from their empresa" 
  ON public.controles_ativos FOR SELECT 
  USING (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can insert control-asset links in their empresa" 
  ON public.controles_ativos FOR INSERT 
  WITH CHECK (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can update control-asset links from their empresa" 
  ON public.controles_ativos FOR UPDATE 
  USING (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can delete control-asset links from their empresa" 
  ON public.controles_ativos FOR DELETE 
  USING (controle_pertence_empresa(controle_id));

-- Adicionar triggers para updated_at
CREATE TRIGGER update_controles_categorias_updated_at 
  BEFORE UPDATE ON public.controles_categorias 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_controles_updated_at 
  BEFORE UPDATE ON public.controles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_controles_testes_updated_at 
  BEFORE UPDATE ON public.controles_testes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
