
-- Criar tabela principal de documentos
CREATE TABLE public.documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'documento',
  categoria TEXT,
  tags TEXT[],
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tipo TEXT,
  arquivo_tamanho BIGINT,
  versao INTEGER DEFAULT 1,
  is_current_version BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'ativo',
  confidencial BOOLEAN DEFAULT false,
  data_vencimento DATE,
  data_aprovacao DATE,
  aprovado_por UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de categorias de documentos
CREATE TABLE public.documentos_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de vinculações de documentos
CREATE TABLE public.documentos_vinculacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID NOT NULL,
  modulo TEXT NOT NULL, -- 'contrato', 'auditoria', 'risco', 'controle', 'ativo'
  vinculo_id UUID NOT NULL,
  tipo_vinculacao TEXT DEFAULT 'relacionado',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de aprovações de documentos
CREATE TABLE public.documentos_aprovacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID NOT NULL,
  aprovador_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'aprovado', 'rejeitado'
  comentarios TEXT,
  data_aprovacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de comentários em documentos
CREATE TABLE public.documentos_comentarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID NOT NULL,
  user_id UUID NOT NULL,
  comentario TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar bucket para documentos gerais
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos', 'documentos', false);

-- Habilitar RLS nas tabelas
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_vinculacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_comentarios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para documentos
CREATE POLICY "Users can view documents from their empresa" 
ON public.documentos FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert documents in their empresa" 
ON public.documentos FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update documents from their empresa" 
ON public.documentos FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete documents from their empresa" 
ON public.documentos FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Políticas RLS para categorias
CREATE POLICY "Users can view document categories from their empresa" 
ON public.documentos_categorias FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert document categories in their empresa" 
ON public.documentos_categorias FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update document categories from their empresa" 
ON public.documentos_categorias FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete document categories from their empresa" 
ON public.documentos_categorias FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Função para verificar se documento pertence à empresa
CREATE OR REPLACE FUNCTION public.documento_pertence_empresa(documento_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM documentos 
    WHERE id = documento_id AND empresa_id = get_user_empresa_id()
  );
$function$;

-- Políticas RLS para vinculações
CREATE POLICY "Users can view document links from their empresa" 
ON public.documentos_vinculacoes FOR SELECT 
USING (documento_pertence_empresa(documento_id));

CREATE POLICY "Users can insert document links in their empresa" 
ON public.documentos_vinculacoes FOR INSERT 
WITH CHECK (documento_pertence_empresa(documento_id));

CREATE POLICY "Users can update document links from their empresa" 
ON public.documentos_vinculacoes FOR UPDATE 
USING (documento_pertence_empresa(documento_id));

CREATE POLICY "Users can delete document links from their empresa" 
ON public.documentos_vinculacoes FOR DELETE 
USING (documento_pertence_empresa(documento_id));

-- Políticas RLS para aprovações
CREATE POLICY "Users can view document approvals from their empresa" 
ON public.documentos_aprovacoes FOR SELECT 
USING (documento_pertence_empresa(documento_id));

CREATE POLICY "Users can insert document approvals in their empresa" 
ON public.documentos_aprovacoes FOR INSERT 
WITH CHECK (documento_pertence_empresa(documento_id));

CREATE POLICY "Users can update document approvals from their empresa" 
ON public.documentos_aprovacoes FOR UPDATE 
USING (documento_pertence_empresa(documento_id));

-- Políticas RLS para comentários
CREATE POLICY "Users can view document comments from their empresa" 
ON public.documentos_comentarios FOR SELECT 
USING (documento_pertence_empresa(documento_id));

CREATE POLICY "Users can insert document comments in their empresa" 
ON public.documentos_comentarios FOR INSERT 
WITH CHECK (documento_pertence_empresa(documento_id));

CREATE POLICY "Users can update their own document comments" 
ON public.documentos_comentarios FOR UPDATE 
USING (documento_pertence_empresa(documento_id) AND user_id = auth.uid());

CREATE POLICY "Users can delete their own document comments" 
ON public.documentos_comentarios FOR DELETE 
USING (documento_pertence_empresa(documento_id) AND user_id = auth.uid());

-- Políticas para storage bucket documentos
CREATE POLICY "Users can view documents from their empresa" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'documentos');

CREATE POLICY "Authenticated users can upload documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'documentos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update documents" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'documentos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete documents" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'documentos' AND auth.role() = 'authenticated');

-- Trigger para atualizar updated_at
CREATE TRIGGER update_documentos_updated_at
  BEFORE UPDATE ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documentos_categorias_updated_at
  BEFORE UPDATE ON public.documentos_categorias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
