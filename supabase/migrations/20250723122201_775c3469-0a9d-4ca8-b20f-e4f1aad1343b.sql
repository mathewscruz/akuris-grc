-- Criar tabelas para o módulo de Dados (mapeamento de dados e ROPA)

-- Tabela para catálogo de dados pessoais
CREATE TABLE public.dados_pessoais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria_dados TEXT NOT NULL, -- identificacao, contato, localizacao, financeiro, saude, etc
  tipo_dados TEXT NOT NULL, -- comum, sensivel, infantil
  sensibilidade TEXT NOT NULL DEFAULT 'comum', -- comum, sensivel, muito_sensivel
  origem_coleta TEXT, -- formulario_web, sistema_interno, terceiros, etc
  finalidade_tratamento TEXT NOT NULL,
  base_legal TEXT NOT NULL, -- consentimento, legitimo_interesse, execucao_contrato, etc
  prazo_retencao TEXT, -- em meses/anos ou até evento específico
  forma_coleta TEXT, -- automatica, manual, importacao
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Tabela para mapeamento de dados com ativos
CREATE TABLE public.dados_mapeamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dados_pessoais_id UUID NOT NULL,
  ativo_id UUID NOT NULL,
  tipo_armazenamento TEXT NOT NULL DEFAULT 'primario', -- primario, backup, temporario, cache
  localizacao_dados TEXT, -- servidor, cloud, local
  criptografia_aplicada BOOLEAN DEFAULT false,
  controles_acesso TEXT, -- descricao dos controles aplicados
  volume_aproximado TEXT, -- pequeno, medio, grande
  frequencia_acesso TEXT, -- diaria, semanal, mensal, eventual
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para registros ROPA (Registro de Operações de Tratamento)
CREATE TABLE public.ropa_registros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome_tratamento TEXT NOT NULL,
  finalidade TEXT NOT NULL,
  base_legal TEXT NOT NULL,
  categoria_titulares TEXT NOT NULL, -- clientes, funcionarios, fornecedores, etc
  origem_dados TEXT, -- diretamente_titular, terceiros, publico
  compartilhamento_dados TEXT, -- interno, terceiros, nao_compartilha
  transferencia_internacional BOOLEAN DEFAULT false,
  pais_destino TEXT,
  adequacao_destino TEXT, -- adequado, garantias, autorizacao_anpd
  prazo_retencao TEXT NOT NULL,
  medidas_seguranca TEXT,
  responsavel_tratamento UUID,
  encarregado_dados UUID,
  controlador_conjunto UUID,
  operador_dados UUID,
  data_inicio DATE,
  data_fim DATE,
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo, suspenso, encerrado
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Tabela para vincular dados pessoais aos registros ROPA
CREATE TABLE public.ropa_dados_vinculados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ropa_id UUID NOT NULL,
  dados_pessoais_id UUID NOT NULL,
  finalidade_especifica TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para fluxos de dados
CREATE TABLE public.dados_fluxos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_fluxo TEXT NOT NULL,
  empresa_id UUID NOT NULL,
  dados_pessoais_id UUID NOT NULL,
  sistema_origem TEXT NOT NULL,
  sistema_destino TEXT NOT NULL,
  tipo_transferencia TEXT NOT NULL, -- api, arquivo, manual, automatico
  frequencia TEXT, -- tempo_real, diaria, semanal, mensal, eventual
  volume_aproximado TEXT, -- registros por periodo
  criptografia_transit BOOLEAN DEFAULT false,
  aprovacao_necessaria BOOLEAN DEFAULT false,
  responsavel_fluxo UUID,
  mapeamento_campos JSONB, -- mapeamento detalhado dos campos
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo, inativo, suspenso
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para solicitações de direitos dos titulares
CREATE TABLE public.dados_solicitacoes_titular (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  tipo_solicitacao TEXT NOT NULL, -- acesso, correcao, exclusao, portabilidade, oposicao
  dados_titular JSONB NOT NULL, -- nome, email, documento, etc
  dados_solicitados TEXT, -- quais dados específicos
  justificativa TEXT,
  canal_solicitacao TEXT, -- email, portal, presencial, telefone
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, em_analise, atendida, rejeitada
  data_solicitacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_resposta TIMESTAMP WITH TIME ZONE,
  prazo_resposta DATE NOT NULL, -- calculado automaticamente (15 dias úteis)
  responsavel_analise UUID,
  observacoes_internas TEXT,
  resposta_titular TEXT,
  evidencias_atendimento TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS para todas as tabelas
ALTER TABLE public.dados_pessoais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dados_mapeamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ropa_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ropa_dados_vinculados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dados_fluxos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dados_solicitacoes_titular ENABLE ROW LEVEL SECURITY;

-- Função para verificar se dados pessoais pertencem à empresa do usuário
CREATE OR REPLACE FUNCTION public.dados_pessoais_pertence_empresa(dados_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM dados_pessoais 
    WHERE id = dados_id AND empresa_id = get_user_empresa_id()
  );
$function$;

-- Função para verificar se ROPA pertence à empresa do usuário
CREATE OR REPLACE FUNCTION public.ropa_pertence_empresa(ropa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM ropa_registros 
    WHERE id = ropa_id AND empresa_id = get_user_empresa_id()
  );
$function$;

-- Políticas RLS para dados_pessoais
CREATE POLICY "Users can view dados pessoais from their empresa" 
ON public.dados_pessoais FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert dados pessoais in their empresa" 
ON public.dados_pessoais FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update dados pessoais from their empresa" 
ON public.dados_pessoais FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete dados pessoais from their empresa" 
ON public.dados_pessoais FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Políticas RLS para dados_mapeamento
CREATE POLICY "Users can view dados mapeamento from their empresa" 
ON public.dados_mapeamento FOR SELECT 
USING (dados_pessoais_pertence_empresa(dados_pessoais_id));

CREATE POLICY "Users can insert dados mapeamento in their empresa" 
ON public.dados_mapeamento FOR INSERT 
WITH CHECK (dados_pessoais_pertence_empresa(dados_pessoais_id));

CREATE POLICY "Users can update dados mapeamento from their empresa" 
ON public.dados_mapeamento FOR UPDATE 
USING (dados_pessoais_pertence_empresa(dados_pessoais_id));

CREATE POLICY "Users can delete dados mapeamento from their empresa" 
ON public.dados_mapeamento FOR DELETE 
USING (dados_pessoais_pertence_empresa(dados_pessoais_id));

-- Políticas RLS para ropa_registros
CREATE POLICY "Users can view ROPA from their empresa" 
ON public.ropa_registros FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert ROPA in their empresa" 
ON public.ropa_registros FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update ROPA from their empresa" 
ON public.ropa_registros FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete ROPA from their empresa" 
ON public.ropa_registros FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Políticas RLS para ropa_dados_vinculados
CREATE POLICY "Users can view ROPA dados vinculados from their empresa" 
ON public.ropa_dados_vinculados FOR SELECT 
USING (ropa_pertence_empresa(ropa_id));

CREATE POLICY "Users can insert ROPA dados vinculados in their empresa" 
ON public.ropa_dados_vinculados FOR INSERT 
WITH CHECK (ropa_pertence_empresa(ropa_id));

CREATE POLICY "Users can update ROPA dados vinculados from their empresa" 
ON public.ropa_dados_vinculados FOR UPDATE 
USING (ropa_pertence_empresa(ropa_id));

CREATE POLICY "Users can delete ROPA dados vinculados from their empresa" 
ON public.ropa_dados_vinculados FOR DELETE 
USING (ropa_pertence_empresa(ropa_id));

-- Políticas RLS para dados_fluxos
CREATE POLICY "Users can view dados fluxos from their empresa" 
ON public.dados_fluxos FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert dados fluxos in their empresa" 
ON public.dados_fluxos FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update dados fluxos from their empresa" 
ON public.dados_fluxos FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete dados fluxos from their empresa" 
ON public.dados_fluxos FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Políticas RLS para dados_solicitacoes_titular
CREATE POLICY "Users can view solicitacoes titular from their empresa" 
ON public.dados_solicitacoes_titular FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert solicitacoes titular in their empresa" 
ON public.dados_solicitacoes_titular FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update solicitacoes titular from their empresa" 
ON public.dados_solicitacoes_titular FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete solicitacoes titular from their empresa" 
ON public.dados_solicitacoes_titular FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Triggers para updated_at
CREATE TRIGGER update_dados_pessoais_updated_at
  BEFORE UPDATE ON public.dados_pessoais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dados_mapeamento_updated_at
  BEFORE UPDATE ON public.dados_mapeamento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ropa_registros_updated_at
  BEFORE UPDATE ON public.ropa_registros
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dados_fluxos_updated_at
  BEFORE UPDATE ON public.dados_fluxos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dados_solicitacoes_titular_updated_at
  BEFORE UPDATE ON public.dados_solicitacoes_titular
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir bucket para documentos relacionados a dados
INSERT INTO storage.buckets (id, name, public) VALUES ('dados-documentos', 'dados-documentos', false);

-- Políticas para storage de documentos relacionados a dados
CREATE POLICY "Users can view dados documents from their empresa" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'dados-documentos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload dados documents in their empresa" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'dados-documentos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update dados documents from their empresa" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'dados-documentos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete dados documents from their empresa" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'dados-documentos' AND auth.uid()::text = (storage.foldername(name))[1]);