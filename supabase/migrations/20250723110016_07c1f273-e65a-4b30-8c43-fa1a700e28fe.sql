-- Criar tabela de fornecedores
CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  contato_responsavel TEXT,
  tipo TEXT NOT NULL DEFAULT 'pessoa_juridica', -- pessoa_juridica, pessoa_fisica
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo, inativo, suspenso
  categoria TEXT, -- tecnologia, consultoria, servicos, produtos, etc
  avaliacao_risco TEXT DEFAULT 'baixo', -- baixo, medio, alto, critico
  data_cadastro DATE DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de contratos
CREATE TABLE public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  fornecedor_id UUID NOT NULL,
  numero_contrato TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- servicos, licenciamento, manutencao, consultoria, produto
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, negociacao, aprovacao, ativo, suspenso, encerrado, cancelado
  valor DECIMAL(15,2),
  moeda TEXT DEFAULT 'BRL',
  data_inicio DATE,
  data_fim DATE,
  data_assinatura DATE,
  renovacao_automatica BOOLEAN DEFAULT false,
  prazo_renovacao INTEGER, -- dias de antecedência para renovação
  gestor_contrato UUID, -- referência ao usuário responsável
  area_solicitante TEXT,
  objeto TEXT, -- descrição do objeto do contrato
  observacoes TEXT,
  clausulas_especiais TEXT,
  penalidades TEXT,
  sla_principal TEXT,
  confidencial BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de documentos contratuais
CREATE TABLE public.contrato_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- contrato_principal, aditivo, anexo, proposta, outros
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tipo TEXT,
  arquivo_tamanho BIGINT,
  versao INTEGER DEFAULT 1,
  is_current_version BOOLEAN DEFAULT true,
  data_upload TIMESTAMP WITH TIME ZONE DEFAULT now(),
  uploaded_by UUID,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de marcos/eventos contratuais
CREATE TABLE public.contrato_marcos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- vencimento, renovacao, pagamento, entrega, revisao
  data_prevista DATE NOT NULL,
  data_realizada DATE,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, concluido, atrasado, cancelado
  responsavel UUID,
  descricao TEXT,
  valor DECIMAL(15,2),
  alerta_antecedencia INTEGER DEFAULT 30, -- dias de antecedência para alerta
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de aditivos contratuais
CREATE TABLE public.contrato_aditivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL,
  numero_aditivo TEXT NOT NULL,
  tipo TEXT NOT NULL, -- prazo, valor, escopo, outros
  motivo TEXT NOT NULL,
  valor_anterior DECIMAL(15,2),
  valor_novo DECIMAL(15,2),
  data_inicio_anterior DATE,
  data_fim_anterior DATE,
  data_inicio_nova DATE,
  data_fim_nova DATE,
  data_assinatura DATE,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, aprovacao, ativo, rejeitado
  justificativa TEXT,
  aprovado_por UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_marcos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_aditivos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fornecedores
CREATE POLICY "Users can view fornecedores from their empresa" 
ON public.fornecedores FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert fornecedores in their empresa" 
ON public.fornecedores FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update fornecedores from their empresa" 
ON public.fornecedores FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete fornecedores from their empresa" 
ON public.fornecedores FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Políticas RLS para contratos
CREATE POLICY "Users can view contratos from their empresa" 
ON public.contratos FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert contratos in their empresa" 
ON public.contratos FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update contratos from their empresa" 
ON public.contratos FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete contratos from their empresa" 
ON public.contratos FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Funções auxiliares para verificação de pertencimento
CREATE OR REPLACE FUNCTION public.contrato_pertence_empresa(contrato_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM contratos 
    WHERE id = contrato_id AND empresa_id = get_user_empresa_id()
  );
$function$;

-- Políticas RLS para documentos
CREATE POLICY "Users can view contrato documents from their empresa" 
ON public.contrato_documentos FOR SELECT 
USING (contrato_pertence_empresa(contrato_id));

CREATE POLICY "Users can insert contrato documents in their empresa" 
ON public.contrato_documentos FOR INSERT 
WITH CHECK (contrato_pertence_empresa(contrato_id));

CREATE POLICY "Users can update contrato documents from their empresa" 
ON public.contrato_documentos FOR UPDATE 
USING (contrato_pertence_empresa(contrato_id));

CREATE POLICY "Users can delete contrato documents from their empresa" 
ON public.contrato_documentos FOR DELETE 
USING (contrato_pertence_empresa(contrato_id));

-- Políticas RLS para marcos
CREATE POLICY "Users can view contrato marcos from their empresa" 
ON public.contrato_marcos FOR SELECT 
USING (contrato_pertence_empresa(contrato_id));

CREATE POLICY "Users can insert contrato marcos in their empresa" 
ON public.contrato_marcos FOR INSERT 
WITH CHECK (contrato_pertence_empresa(contrato_id));

CREATE POLICY "Users can update contrato marcos from their empresa" 
ON public.contrato_marcos FOR UPDATE 
USING (contrato_pertence_empresa(contrato_id));

CREATE POLICY "Users can delete contrato marcos from their empresa" 
ON public.contrato_marcos FOR DELETE 
USING (contrato_pertence_empresa(contrato_id));

-- Políticas RLS para aditivos
CREATE POLICY "Users can view contrato aditivos from their empresa" 
ON public.contrato_aditivos FOR SELECT 
USING (contrato_pertence_empresa(contrato_id));

CREATE POLICY "Users can insert contrato aditivos in their empresa" 
ON public.contrato_aditivos FOR INSERT 
WITH CHECK (contrato_pertence_empresa(contrato_id));

CREATE POLICY "Users can update contrato aditivos from their empresa" 
ON public.contrato_aditivos FOR UPDATE 
USING (contrato_pertence_empresa(contrato_id));

CREATE POLICY "Users can delete contrato aditivos from their empresa" 
ON public.contrato_aditivos FOR DELETE 
USING (contrato_pertence_empresa(contrato_id));

-- Triggers para updated_at
CREATE TRIGGER update_fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contratos_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contrato_marcos_updated_at
  BEFORE UPDATE ON public.contrato_marcos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contrato_aditivos_updated_at
  BEFORE UPDATE ON public.contrato_aditivos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar bucket para documentos contratuais
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contrato-documentos', 'contrato-documentos', false);

-- Políticas para o bucket de documentos
CREATE POLICY "Users can view contrato documents" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'contrato-documentos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload contrato documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'contrato-documentos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update contrato documents" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'contrato-documentos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete contrato documents" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'contrato-documentos' AND auth.role() = 'authenticated');