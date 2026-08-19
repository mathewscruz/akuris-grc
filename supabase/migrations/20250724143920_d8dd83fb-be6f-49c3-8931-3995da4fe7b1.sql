-- Criar módulo Gap Analysis no sistema
INSERT INTO public.system_modules (name, display_name, description, icon, is_active, order_index, route_path) 
VALUES ('gap-analysis', 'Gap Analysis', 'Avaliação de maturidade e conformidade com frameworks', 'BarChart3', true, 3.5, '/gap-analysis');

-- Tabela de frameworks
CREATE TABLE public.gap_analysis_frameworks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  versao TEXT,
  tipo_framework TEXT, -- 'seguranca', 'compliance', 'operacional', 'qualidade', etc
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de avaliações (instâncias de avaliação de um framework)
CREATE TABLE public.gap_analysis_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  framework_id UUID NOT NULL REFERENCES public.gap_analysis_frameworks(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  data_inicio DATE,
  data_prevista_conclusao DATE,
  data_conclusao DATE,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluida', 'pausada', 'cancelada')),
  responsavel_geral UUID,
  percentual_conclusao DECIMAL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de requisitos (perguntas/itens do framework)
CREATE TABLE public.gap_analysis_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id UUID NOT NULL REFERENCES public.gap_analysis_frameworks(id) ON DELETE CASCADE,
  codigo TEXT, -- Ex: "1.1", "A.5.1.1"
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT, -- Para agrupar requisitos
  ordem INTEGER DEFAULT 0,
  peso DECIMAL DEFAULT 1, -- Para cálculo ponderado
  obrigatorio BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de avaliações por requisito
CREATE TABLE public.gap_analysis_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.gap_analysis_assessments(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES public.gap_analysis_requirements(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'nao_avaliado' CHECK (status IN ('conforme', 'nao_conforme', 'parcialmente_conforme', 'nao_aplicavel', 'nao_avaliado')),
  observacoes TEXT,
  responsavel_avaliacao UUID,
  data_avaliacao TIMESTAMP WITH TIME ZONE,
  pontuacao DECIMAL, -- 0-10 ou 0-100 dependendo do framework
  plano_acao TEXT,
  prazo_implementacao DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assessment_id, requirement_id)
);

-- Tabela de evidências
CREATE TABLE public.gap_analysis_evidences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id UUID NOT NULL REFERENCES public.gap_analysis_evaluations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'arquivo', -- 'arquivo', 'link', 'observacao'
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tipo TEXT,
  arquivo_tamanho BIGINT,
  link_externo TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de atribuições
CREATE TABLE public.gap_analysis_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.gap_analysis_assessments(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES public.gap_analysis_requirements(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL,
  assigned_by UUID NOT NULL,
  prazo DATE,
  instrucoes TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'rejeitada')),
  data_conclusao TIMESTAMP WITH TIME ZONE,
  observacoes_conclusao TEXT,
  notificado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gap_analysis_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gap_analysis_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gap_analysis_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gap_analysis_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gap_analysis_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gap_analysis_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies para frameworks
CREATE POLICY "Users can view frameworks from their empresa" ON public.gap_analysis_frameworks
  FOR SELECT USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert frameworks in their empresa" ON public.gap_analysis_frameworks
  FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update frameworks from their empresa" ON public.gap_analysis_frameworks
  FOR UPDATE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete frameworks from their empresa" ON public.gap_analysis_frameworks
  FOR DELETE USING (empresa_id = get_user_empresa_id());

-- RLS Policies para assessments
CREATE POLICY "Users can view assessments from their empresa" ON public.gap_analysis_assessments
  FOR SELECT USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert assessments in their empresa" ON public.gap_analysis_assessments
  FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update assessments from their empresa" ON public.gap_analysis_assessments
  FOR UPDATE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete assessments from their empresa" ON public.gap_analysis_assessments
  FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Function helper para verificar se requirement pertence à empresa
CREATE OR REPLACE FUNCTION public.requirement_pertence_empresa(requirement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.gap_analysis_requirements r
    INNER JOIN public.gap_analysis_frameworks f ON r.framework_id = f.id
    WHERE r.id = requirement_id AND f.empresa_id = public.get_user_empresa_id()
  );
$function$;

-- Function helper para verificar se assessment pertence à empresa
CREATE OR REPLACE FUNCTION public.assessment_pertence_empresa(assessment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.gap_analysis_assessments 
    WHERE id = assessment_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;

-- RLS Policies para requirements
CREATE POLICY "Users can view requirements from their empresa" ON public.gap_analysis_requirements
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.gap_analysis_frameworks f 
    WHERE f.id = framework_id AND f.empresa_id = get_user_empresa_id()
  ));

CREATE POLICY "Users can insert requirements in their empresa frameworks" ON public.gap_analysis_requirements
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.gap_analysis_frameworks f 
    WHERE f.id = framework_id AND f.empresa_id = get_user_empresa_id()
  ));

CREATE POLICY "Users can update requirements from their empresa" ON public.gap_analysis_requirements
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.gap_analysis_frameworks f 
    WHERE f.id = framework_id AND f.empresa_id = get_user_empresa_id()
  ));

CREATE POLICY "Users can delete requirements from their empresa" ON public.gap_analysis_requirements
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.gap_analysis_frameworks f 
    WHERE f.id = framework_id AND f.empresa_id = get_user_empresa_id()
  ));

-- RLS Policies para evaluations
CREATE POLICY "Users can view evaluations from their empresa" ON public.gap_analysis_evaluations
  FOR SELECT USING (assessment_pertence_empresa(assessment_id));

CREATE POLICY "Users can insert evaluations in their empresa" ON public.gap_analysis_evaluations
  FOR INSERT WITH CHECK (assessment_pertence_empresa(assessment_id));

CREATE POLICY "Users can update evaluations from their empresa" ON public.gap_analysis_evaluations
  FOR UPDATE USING (assessment_pertence_empresa(assessment_id));

CREATE POLICY "Users can delete evaluations from their empresa" ON public.gap_analysis_evaluations
  FOR DELETE USING (assessment_pertence_empresa(assessment_id));

-- RLS Policies para evidences
CREATE POLICY "Users can view evidences from their empresa" ON public.gap_analysis_evidences
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.gap_analysis_evaluations e
    WHERE e.id = evaluation_id AND assessment_pertence_empresa(e.assessment_id)
  ));

CREATE POLICY "Users can insert evidences in their empresa" ON public.gap_analysis_evidences
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.gap_analysis_evaluations e
    WHERE e.id = evaluation_id AND assessment_pertence_empresa(e.assessment_id)
  ));

CREATE POLICY "Users can update evidences from their empresa" ON public.gap_analysis_evidences
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.gap_analysis_evaluations e
    WHERE e.id = evaluation_id AND assessment_pertence_empresa(e.assessment_id)
  ));

CREATE POLICY "Users can delete evidences from their empresa" ON public.gap_analysis_evidences
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.gap_analysis_evaluations e
    WHERE e.id = evaluation_id AND assessment_pertence_empresa(e.assessment_id)
  ));

-- RLS Policies para assignments
CREATE POLICY "Users can view assignments from their empresa" ON public.gap_analysis_assignments
  FOR SELECT USING (assessment_pertence_empresa(assessment_id));

CREATE POLICY "Users can insert assignments in their empresa" ON public.gap_analysis_assignments
  FOR INSERT WITH CHECK (assessment_pertence_empresa(assessment_id));

CREATE POLICY "Users can update assignments from their empresa" ON public.gap_analysis_assignments
  FOR UPDATE USING (assessment_pertence_empresa(assessment_id));

CREATE POLICY "Users can delete assignments from their empresa" ON public.gap_analysis_assignments
  FOR DELETE USING (assessment_pertence_empresa(assessment_id));

-- Triggers para updated_at
CREATE TRIGGER update_gap_analysis_frameworks_updated_at
  BEFORE UPDATE ON public.gap_analysis_frameworks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gap_analysis_assessments_updated_at
  BEFORE UPDATE ON public.gap_analysis_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gap_analysis_requirements_updated_at
  BEFORE UPDATE ON public.gap_analysis_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gap_analysis_evaluations_updated_at
  BEFORE UPDATE ON public.gap_analysis_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gap_analysis_assignments_updated_at
  BEFORE UPDATE ON public.gap_analysis_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();