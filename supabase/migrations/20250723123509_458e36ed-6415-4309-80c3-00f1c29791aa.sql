-- Create Due Diligence Module Tables

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
  template_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('text', 'textarea', 'select', 'checkbox', 'radio', 'file', 'score', 'date')),
  opcoes JSONB, -- Para select, checkbox, radio
  obrigatoria BOOLEAN NOT NULL DEFAULT false,
  peso DECIMAL(3,2) DEFAULT 1.0,
  ordem INTEGER NOT NULL DEFAULT 1,
  condicao_parent_id UUID, -- Para perguntas condicionais
  condicao_valor TEXT, -- Valor que ativa a pergunta
  configuracoes JSONB DEFAULT '{}', -- Configurações específicas do tipo
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Avaliações enviadas aos fornecedores
CREATE TABLE public.due_diligence_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  template_id UUID NOT NULL,
  fornecedor_id UUID,
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
  assessment_id UUID NOT NULL,
  question_id UUID NOT NULL,
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
  assessment_id UUID NOT NULL,
  categoria TEXT,
  pontuacao_obtida DECIMAL(5,2) NOT NULL DEFAULT 0,
  pontuacao_maxima DECIMAL(5,2) NOT NULL DEFAULT 0,
  percentual DECIMAL(5,2) NOT NULL DEFAULT 0,
  classificacao TEXT, -- 'excelente', 'bom', 'regular', 'ruim'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Documentos anexados
CREATE TABLE public.due_diligence_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL,
  response_id UUID,
  nome TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  arquivo_tipo TEXT,
  arquivo_tamanho BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.due_diligence_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_diligence_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_diligence_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_diligence_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_diligence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_diligence_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for templates
CREATE POLICY "Users can view templates from their empresa" 
ON public.due_diligence_templates 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert templates in their empresa" 
ON public.due_diligence_templates 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update templates from their empresa" 
ON public.due_diligence_templates 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete templates from their empresa" 
ON public.due_diligence_templates 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- RLS Policies for questions (via template)
CREATE POLICY "Users can view questions from their empresa templates" 
ON public.due_diligence_questions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM due_diligence_templates t 
  WHERE t.id = template_id AND t.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can insert questions in their empresa templates" 
ON public.due_diligence_questions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM due_diligence_templates t 
  WHERE t.id = template_id AND t.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can update questions from their empresa templates" 
ON public.due_diligence_questions 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM due_diligence_templates t 
  WHERE t.id = template_id AND t.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can delete questions from their empresa templates" 
ON public.due_diligence_questions 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM due_diligence_templates t 
  WHERE t.id = template_id AND t.empresa_id = get_user_empresa_id()
));

-- RLS Policies for assessments
CREATE POLICY "Users can view assessments from their empresa" 
ON public.due_diligence_assessments 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert assessments in their empresa" 
ON public.due_diligence_assessments 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update assessments from their empresa" 
ON public.due_diligence_assessments 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete assessments from their empresa" 
ON public.due_diligence_assessments 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- RLS Policies for responses (via assessment)
CREATE POLICY "Users can view responses from their empresa assessments" 
ON public.due_diligence_responses 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Public can insert responses via valid token" 
ON public.due_diligence_responses 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.status IN ('enviado', 'em_andamento')
));

CREATE POLICY "Users can update responses from their empresa assessments" 
ON public.due_diligence_responses 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can delete responses from their empresa assessments" 
ON public.due_diligence_responses 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

-- RLS Policies for scores (via assessment)
CREATE POLICY "Users can view scores from their empresa assessments" 
ON public.due_diligence_scores 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can insert scores in their empresa assessments" 
ON public.due_diligence_scores 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can update scores from their empresa assessments" 
ON public.due_diligence_scores 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can delete scores from their empresa assessments" 
ON public.due_diligence_scores 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

-- RLS Policies for documents (via assessment)
CREATE POLICY "Users can view documents from their empresa assessments" 
ON public.due_diligence_documents 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Public can insert documents via valid assessment" 
ON public.due_diligence_documents 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.status IN ('enviado', 'em_andamento')
));

CREATE POLICY "Users can update documents from their empresa assessments" 
ON public.due_diligence_documents 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can delete documents from their empresa assessments" 
ON public.due_diligence_documents 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM due_diligence_assessments a 
  WHERE a.id = assessment_id AND a.empresa_id = get_user_empresa_id()
));

-- Foreign Keys
ALTER TABLE public.due_diligence_questions 
ADD CONSTRAINT fk_questions_template 
FOREIGN KEY (template_id) REFERENCES public.due_diligence_templates(id) ON DELETE CASCADE;

ALTER TABLE public.due_diligence_questions 
ADD CONSTRAINT fk_questions_parent 
FOREIGN KEY (condicao_parent_id) REFERENCES public.due_diligence_questions(id) ON DELETE SET NULL;

ALTER TABLE public.due_diligence_assessments 
ADD CONSTRAINT fk_assessments_template 
FOREIGN KEY (template_id) REFERENCES public.due_diligence_templates(id) ON DELETE RESTRICT;

ALTER TABLE public.due_diligence_responses 
ADD CONSTRAINT fk_responses_assessment 
FOREIGN KEY (assessment_id) REFERENCES public.due_diligence_assessments(id) ON DELETE CASCADE;

ALTER TABLE public.due_diligence_responses 
ADD CONSTRAINT fk_responses_question 
FOREIGN KEY (question_id) REFERENCES public.due_diligence_questions(id) ON DELETE CASCADE;

ALTER TABLE public.due_diligence_scores 
ADD CONSTRAINT fk_scores_assessment 
FOREIGN KEY (assessment_id) REFERENCES public.due_diligence_assessments(id) ON DELETE CASCADE;

ALTER TABLE public.due_diligence_documents 
ADD CONSTRAINT fk_documents_assessment 
FOREIGN KEY (assessment_id) REFERENCES public.due_diligence_assessments(id) ON DELETE CASCADE;

ALTER TABLE public.due_diligence_documents 
ADD CONSTRAINT fk_documents_response 
FOREIGN KEY (response_id) REFERENCES public.due_diligence_responses(id) ON DELETE SET NULL;

-- Triggers for updated_at
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

-- Function to calculate assessment score
CREATE OR REPLACE FUNCTION public.calculate_due_diligence_score(assessment_id_param UUID)
RETURNS VOID AS $$
DECLARE
  total_peso DECIMAL(10,2) := 0;
  pontuacao_obtida DECIMAL(10,2) := 0;
  pontuacao_maxima DECIMAL(10,2) := 0;
  percentual DECIMAL(5,2);
  classificacao TEXT;
BEGIN
  -- Calcular pontuação total
  SELECT 
    COALESCE(SUM(q.peso * COALESCE(r.pontuacao, 0)), 0),
    COALESCE(SUM(q.peso * 10), 0) -- Assumindo pontuação máxima de 10 por pergunta
  INTO pontuacao_obtida, pontuacao_maxima
  FROM due_diligence_questions q
  INNER JOIN due_diligence_assessments a ON q.template_id = a.template_id
  LEFT JOIN due_diligence_responses r ON r.question_id = q.id AND r.assessment_id = a.id
  WHERE a.id = assessment_id_param;

  -- Calcular percentual
  IF pontuacao_maxima > 0 THEN
    percentual := (pontuacao_obtida / pontuacao_maxima) * 100;
  ELSE
    percentual := 0;
  END IF;

  -- Determinar classificação
  IF percentual >= 90 THEN
    classificacao := 'excelente';
  ELSIF percentual >= 70 THEN
    classificacao := 'bom';
  ELSIF percentual >= 50 THEN
    classificacao := 'regular';
  ELSE
    classificacao := 'ruim';
  END IF;

  -- Inserir ou atualizar score
  INSERT INTO due_diligence_scores (assessment_id, pontuacao_obtida, pontuacao_maxima, percentual, classificacao)
  VALUES (assessment_id_param, pontuacao_obtida, pontuacao_maxima, percentual, classificacao)
  ON CONFLICT (assessment_id) DO UPDATE SET
    pontuacao_obtida = EXCLUDED.pontuacao_obtida,
    pontuacao_maxima = EXCLUDED.pontuacao_maxima,
    percentual = EXCLUDED.percentual,
    classificacao = EXCLUDED.classificacao;

  -- Atualizar score final na assessment
  UPDATE due_diligence_assessments 
  SET score_final = percentual 
  WHERE id = assessment_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create storage bucket for due diligence documents
INSERT INTO storage.buckets (id, name, public) VALUES ('due-diligence-docs', 'due-diligence-docs', false);

-- Storage policies
CREATE POLICY "Users can view due diligence documents from their empresa"
ON storage.objects FOR SELECT
USING (bucket_id = 'due-diligence-docs' AND 
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.empresa_id = get_user_empresa_id() 
    AND storage.foldername(name)[1] = a.id::text
  )
);

CREATE POLICY "Public can upload due diligence documents via valid assessment"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'due-diligence-docs' AND 
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.status IN ('enviado', 'em_andamento')
    AND storage.foldername(name)[1] = a.id::text
  )
);

CREATE POLICY "Users can update due diligence documents from their empresa"
ON storage.objects FOR UPDATE
USING (bucket_id = 'due-diligence-docs' AND 
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.empresa_id = get_user_empresa_id() 
    AND storage.foldername(name)[1] = a.id::text
  )
);

CREATE POLICY "Users can delete due diligence documents from their empresa"
ON storage.objects FOR DELETE
USING (bucket_id = 'due-diligence-docs' AND 
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.empresa_id = get_user_empresa_id() 
    AND storage.foldername(name)[1] = a.id::text
  )
);