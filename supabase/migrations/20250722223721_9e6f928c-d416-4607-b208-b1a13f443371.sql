
-- Criar tabela principal de auditorias
CREATE TABLE public.auditorias (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL, -- 'interna', 'externa', 'compliance', 'operacional', 'ti'
  status text NOT NULL DEFAULT 'planejamento', -- 'planejamento', 'em_andamento', 'concluida', 'cancelada'
  prioridade text NOT NULL DEFAULT 'media', -- 'baixa', 'media', 'alta', 'critica'
  auditor_responsavel uuid REFERENCES auth.users(id),
  auditor_equipe text[], -- Array de nomes dos auditores
  data_inicio date,
  data_fim_prevista date,
  data_fim_real date,
  escopo text,
  objetivos text,
  metodologia text,
  framework text, -- 'COSO', 'ISO27001', 'SOX', 'Personalizado'
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de trabalhos de auditoria (papéis de trabalho)
CREATE TABLE public.auditoria_trabalhos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  auditoria_id uuid NOT NULL REFERENCES public.auditorias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL, -- 'checklist', 'teste', 'entrevista', 'analise', 'observacao'
  status text NOT NULL DEFAULT 'nao_iniciado', -- 'nao_iniciado', 'em_andamento', 'concluido', 'revisao'
  responsavel uuid REFERENCES auth.users(id),
  data_inicio date,
  data_conclusao date,
  conclusoes text,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de achados de auditoria
CREATE TABLE public.auditoria_achados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  auditoria_id uuid NOT NULL REFERENCES public.auditorias(id) ON DELETE CASCADE,
  trabalho_id uuid REFERENCES public.auditoria_trabalhos(id),
  titulo text NOT NULL,
  descricao text NOT NULL,
  tipo text NOT NULL, -- 'deficiencia', 'oportunidade_melhoria', 'observacao', 'nao_conformidade'
  criticidade text NOT NULL DEFAULT 'media', -- 'baixa', 'media', 'alta', 'critica'
  area_afetada text,
  impacto text,
  causa_raiz text,
  status text NOT NULL DEFAULT 'aberto', -- 'aberto', 'em_tratamento', 'resolvido', 'aceito_risco'
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de recomendações
CREATE TABLE public.auditoria_recomendacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  achado_id uuid NOT NULL REFERENCES public.auditoria_achados(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  prioridade text NOT NULL DEFAULT 'media', -- 'baixa', 'media', 'alta'
  responsavel text,
  prazo_implementacao date,
  status text NOT NULL DEFAULT 'pendente', -- 'pendente', 'em_andamento', 'implementada', 'nao_aplicavel'
  data_implementacao date,
  evidencia_implementacao text,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de evidências de auditoria
CREATE TABLE public.auditoria_evidencias (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  auditoria_id uuid REFERENCES public.auditorias(id) ON DELETE CASCADE,
  trabalho_id uuid REFERENCES public.auditoria_trabalhos(id),
  achado_id uuid REFERENCES public.auditoria_achados(id),
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL, -- 'documento', 'screenshot', 'planilha', 'foto', 'video', 'audio'
  arquivo_url text,
  arquivo_nome text,
  arquivo_tamanho bigint,
  arquivo_tipo text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_trabalhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_achados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_recomendacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_evidencias ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para auditorias
CREATE POLICY "Users can view audits from their empresa" 
ON public.auditorias FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert audits in their empresa" 
ON public.auditorias FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update audits from their empresa" 
ON public.auditorias FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete audits from their empresa" 
ON public.auditorias FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Função para verificar se auditoria pertence à empresa
CREATE OR REPLACE FUNCTION public.auditoria_pertence_empresa(auditoria_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auditorias 
    WHERE id = auditoria_id AND empresa_id = get_user_empresa_id()
  );
$$;

-- Políticas para trabalhos de auditoria
CREATE POLICY "Users can view audit works from their empresa" 
ON public.auditoria_trabalhos FOR SELECT 
USING (auditoria_pertence_empresa(auditoria_id));

CREATE POLICY "Users can insert audit works in their empresa" 
ON public.auditoria_trabalhos FOR INSERT 
WITH CHECK (auditoria_pertence_empresa(auditoria_id));

CREATE POLICY "Users can update audit works from their empresa" 
ON public.auditoria_trabalhos FOR UPDATE 
USING (auditoria_pertence_empresa(auditoria_id));

CREATE POLICY "Users can delete audit works from their empresa" 
ON public.auditoria_trabalhos FOR DELETE 
USING (auditoria_pertence_empresa(auditoria_id));

-- Políticas para achados
CREATE POLICY "Users can view findings from their empresa" 
ON public.auditoria_achados FOR SELECT 
USING (auditoria_pertence_empresa(auditoria_id));

CREATE POLICY "Users can insert findings in their empresa" 
ON public.auditoria_achados FOR INSERT 
WITH CHECK (auditoria_pertence_empresa(auditoria_id));

CREATE POLICY "Users can update findings from their empresa" 
ON public.auditoria_achados FOR UPDATE 
USING (auditoria_pertence_empresa(auditoria_id));

CREATE POLICY "Users can delete findings from their empresa" 
ON public.auditoria_achados FOR DELETE 
USING (auditoria_pertence_empresa(auditoria_id));

-- Políticas para recomendações
CREATE POLICY "Users can view recommendations from their empresa" 
ON public.auditoria_recomendacoes FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM auditoria_achados a 
  WHERE a.id = achado_id AND auditoria_pertence_empresa(a.auditoria_id)
));

CREATE POLICY "Users can insert recommendations in their empresa" 
ON public.auditoria_recomendacoes FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM auditoria_achados a 
  WHERE a.id = achado_id AND auditoria_pertence_empresa(a.auditoria_id)
));

CREATE POLICY "Users can update recommendations from their empresa" 
ON public.auditoria_recomendacoes FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM auditoria_achados a 
  WHERE a.id = achado_id AND auditoria_pertence_empresa(a.auditoria_id)
));

CREATE POLICY "Users can delete recommendations from their empresa" 
ON public.auditoria_recomendacoes FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM auditoria_achados a 
  WHERE a.id = achado_id AND auditoria_pertence_empresa(a.auditoria_id)
));

-- Políticas para evidências
CREATE POLICY "Users can view audit evidences from their empresa" 
ON public.auditoria_evidencias FOR SELECT 
USING (auditoria_pertence_empresa(auditoria_id));

CREATE POLICY "Users can insert audit evidences in their empresa" 
ON public.auditoria_evidencias FOR INSERT 
WITH CHECK (auditoria_pertence_empresa(auditoria_id));

CREATE POLICY "Users can update audit evidences from their empresa" 
ON public.auditoria_evidencias FOR UPDATE 
USING (auditoria_pertence_empresa(auditoria_id));

CREATE POLICY "Users can delete audit evidences from their empresa" 
ON public.auditoria_evidencias FOR DELETE 
USING (auditoria_pertence_empresa(auditoria_id));

-- Criar bucket para evidências de auditoria
INSERT INTO storage.buckets (id, name, public) 
VALUES ('auditoria-evidencias', 'auditoria-evidencias', false);

-- Políticas para o bucket auditoria-evidencias
CREATE POLICY "Authenticated users can view audit evidences" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'auditoria-evidencias' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload audit evidences" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'auditoria-evidencias' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can update audit evidences" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'auditoria-evidencias' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete audit evidences" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'auditoria-evidencias' AND 
  auth.role() = 'authenticated'
);

-- Triggers para updated_at
CREATE TRIGGER update_auditorias_updated_at 
  BEFORE UPDATE ON public.auditorias 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auditoria_trabalhos_updated_at 
  BEFORE UPDATE ON public.auditoria_trabalhos 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auditoria_achados_updated_at 
  BEFORE UPDATE ON public.auditoria_achados 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auditoria_recomendacoes_updated_at 
  BEFORE UPDATE ON public.auditoria_recomendacoes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
