-- Create Due Diligence Module Tables (Basic Structure)

-- Templates de questionários
CREATE TABLE public.due_diligence_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'geral',
  ativo BOOLEAN NOT NULL DEFAULT true,
  versao INTEGER NOT NULL DEFAULT 1,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Perguntas dos questionários
CREATE TABLE public.due_diligence_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.due_diligence_templates(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('text', 'textarea', 'select', 'checkbox', 'radio', 'file', 'score', 'date')),
  opcoes JSONB,
  obrigatoria BOOLEAN NOT NULL DEFAULT false,
  peso DECIMAL(3,2) DEFAULT 1.0,
  ordem INTEGER NOT NULL DEFAULT 1,
  configuracoes JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Avaliações enviadas aos fornecedores
CREATE TABLE public.due_diligence_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES public.due_diligence_templates(id) ON DELETE RESTRICT,
  fornecedor_nome TEXT NOT NULL,
  fornecedor_email TEXT NOT NULL,
  link_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'em_andamento', 'concluido', 'expirado')),
  data_envio TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_inicio TIMESTAMP WITH TIME ZONE,
  data_conclusao TIMESTAMP WITH TIME ZONE,
  data_expiracao TIMESTAMP WITH TIME ZONE,
  score_final DECIMAL(5,2),
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Respostas dos fornecedores
CREATE TABLE public.due_diligence_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.due_diligence_assessments(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.due_diligence_questions(id) ON DELETE CASCADE,
  resposta TEXT,
  resposta_arquivo_url TEXT,
  resposta_arquivo_nome TEXT,
  pontuacao DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Scores calculados
CREATE TABLE public.due_diligence_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.due_diligence_assessments(id) ON DELETE CASCADE UNIQUE,
  categoria TEXT,
  pontuacao_obtida DECIMAL(5,2) NOT NULL DEFAULT 0,
  pontuacao_maxima DECIMAL(5,2) NOT NULL DEFAULT 0,
  percentual DECIMAL(5,2) NOT NULL DEFAULT 0,
  classificacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.due_diligence_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_diligence_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_diligence_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_diligence_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_diligence_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage templates from their empresa" 
ON public.due_diligence_templates 
FOR ALL 
USING (empresa_id = get_user_empresa_id())
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can manage questions from their empresa templates" 
ON public.due_diligence_questions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM due_diligence_templates t 
  WHERE t.id = template_id AND t.empresa_id = get_user_empresa_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM due_diligence_templates t 
  WHERE t.id = template_id AND t.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can manage assessments from their empresa" 
ON public.due_diligence_assessments 
FOR ALL 
USING (empresa_id = get_user_empresa_id())
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can view responses from their empresa assessments" 
ON public.due_diligence_responses 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Public can insert responses via valid assessment" 
ON public.due_diligence_responses 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.status IN ('enviado', 'em_andamento')
));

CREATE POLICY "Users can manage scores from their empresa assessments" 
ON public.due_diligence_scores 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

-- Triggers
CREATE TRIGGER update_due_diligence_templates_updated_at
  BEFORE UPDATE ON public.due_diligence_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_due_diligence_assessments_updated_at
  BEFORE UPDATE ON public.due_diligence_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_due_diligence_responses_updated_at
  BEFORE UPDATE ON public.due_diligence_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('due-diligence-docs', 'due-diligence-docs', false);