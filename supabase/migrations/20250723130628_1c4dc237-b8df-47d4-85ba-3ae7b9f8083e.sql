-- Tabela de categorias de denúncias
CREATE TABLE public.denuncias_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#EF4444',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela principal de denúncias
CREATE TABLE public.denuncias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  token_publico TEXT NOT NULL UNIQUE,
  protocolo TEXT NOT NULL UNIQUE,
  
  -- Dados do denunciante (opcionais)
  nome_denunciante TEXT,
  email_denunciante TEXT,
  anonima BOOLEAN DEFAULT false,
  
  -- Dados da denúncia
  categoria_id UUID REFERENCES public.denuncias_categorias(id),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  gravidade TEXT CHECK (gravidade IN ('baixa', 'media', 'alta', 'critica')) DEFAULT 'media',
  
  -- Status e controle
  status TEXT CHECK (status IN ('nova', 'em_analise', 'em_investigacao', 'resolvida', 'arquivada')) DEFAULT 'nova',
  responsavel_id UUID,
  
  -- Dados de tratamento
  data_atribuicao TIMESTAMP WITH TIME ZONE,
  data_inicio_investigacao TIMESTAMP WITH TIME ZONE,
  data_conclusao TIMESTAMP WITH TIME ZONE,
  parecer_final TEXT,
  
  -- Metadados
  ip_origem INET,
  user_agent TEXT,
  politica_aceita BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de movimentações/histórico
CREATE TABLE public.denuncias_movimentacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  denuncia_id UUID NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  usuario_id UUID,
  acao TEXT NOT NULL,
  status_anterior TEXT,
  status_novo TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de anexos
CREATE TABLE public.denuncias_anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  denuncia_id UUID NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  movimentacao_id UUID REFERENCES public.denuncias_movimentacoes(id),
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL,
  tamanho_arquivo BIGINT,
  arquivo_url TEXT,
  tipo_anexo TEXT CHECK (tipo_anexo IN ('denuncia', 'evidencia', 'investigacao')) DEFAULT 'denuncia',
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Configurações da empresa para canal de denúncia
CREATE TABLE public.denuncias_configuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL UNIQUE,
  ativo BOOLEAN DEFAULT true,
  token_publico TEXT NOT NULL UNIQUE,
  permitir_anonimas BOOLEAN DEFAULT true,
  requerer_email BOOLEAN DEFAULT false,
  texto_apresentacao TEXT,
  politica_privacidade TEXT,
  notificar_administradores BOOLEAN DEFAULT true,
  emails_notificacao TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Storage bucket para anexos de denúncias
INSERT INTO storage.buckets (id, name, public) VALUES ('denuncias-anexos', 'denuncias-anexos', false);

-- RLS para todas as tabelas
ALTER TABLE public.denuncias_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias_configuracoes ENABLE ROW LEVEL SECURITY;

-- Função para verificar se denúncia pertence à empresa
CREATE OR REPLACE FUNCTION public.denuncia_pertence_empresa(denuncia_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM denuncias 
    WHERE id = denuncia_id AND empresa_id = get_user_empresa_id()
  );
$function$;

-- Políticas RLS para denuncias_categorias
CREATE POLICY "Users can manage categories from their empresa" 
ON public.denuncias_categorias FOR ALL 
USING (empresa_id = get_user_empresa_id())
WITH CHECK (empresa_id = get_user_empresa_id());

-- Políticas RLS para denuncias
CREATE POLICY "Users can view denuncias from their empresa" 
ON public.denuncias FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update denuncias from their empresa" 
ON public.denuncias FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Public can insert denuncias via token" 
ON public.denuncias FOR INSERT 
WITH CHECK (true); -- Será controlado por lógica na aplicação

-- Políticas RLS para movimentações
CREATE POLICY "Users can view movimentacoes from their empresa" 
ON public.denuncias_movimentacoes FOR SELECT 
USING (denuncia_pertence_empresa(denuncia_id));

CREATE POLICY "Users can insert movimentacoes in their empresa" 
ON public.denuncias_movimentacoes FOR INSERT 
WITH CHECK (denuncia_pertence_empresa(denuncia_id));

-- Políticas RLS para anexos
CREATE POLICY "Users can view anexos from their empresa" 
ON public.denuncias_anexos FOR SELECT 
USING (denuncia_pertence_empresa(denuncia_id));

CREATE POLICY "Users can insert anexos in their empresa" 
ON public.denuncias_anexos FOR INSERT 
WITH CHECK (denuncia_pertence_empresa(denuncia_id));

CREATE POLICY "Public can insert anexos via denuncia" 
ON public.denuncias_anexos FOR INSERT 
WITH CHECK (true); -- Será controlado por lógica na aplicação

-- Políticas RLS para configurações
CREATE POLICY "Users can manage configs from their empresa" 
ON public.denuncias_configuracoes FOR ALL 
USING (empresa_id = get_user_empresa_id())
WITH CHECK (empresa_id = get_user_empresa_id());

-- Políticas de storage para anexos
CREATE POLICY "Users can view anexos from their empresa"
ON storage.objects FOR SELECT
USING (bucket_id = 'denuncias-anexos' AND 
  EXISTS (
    SELECT 1 FROM denuncias_anexos da 
    JOIN denuncias d ON da.denuncia_id = d.id 
    WHERE da.arquivo_url = name AND d.empresa_id = get_user_empresa_id()
  )
);

CREATE POLICY "Public can upload anexos via valid denuncia"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'denuncias-anexos');

CREATE POLICY "Users can upload anexos for their empresa"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'denuncias-anexos');

-- Função para gerar protocolo único
CREATE OR REPLACE FUNCTION public.gerar_protocolo_denuncia()
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
  protocolo TEXT;
BEGIN
  protocolo := 'DEN' || TO_CHAR(now(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN protocolo;
END;
$function$;

-- Função para gerar token público único
CREATE OR REPLACE FUNCTION public.gerar_token_publico()
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
  token TEXT;
BEGIN
  token := encode(gen_random_bytes(32), 'hex');
  RETURN token;
END;
$function$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_denuncias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_denuncias_updated_at
  BEFORE UPDATE ON public.denuncias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_denuncias_updated_at();

CREATE TRIGGER update_denuncias_categorias_updated_at
  BEFORE UPDATE ON public.denuncias_categorias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_denuncias_updated_at();

CREATE TRIGGER update_denuncias_configuracoes_updated_at
  BEFORE UPDATE ON public.denuncias_configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_denuncias_updated_at();

-- Inserir categorias padrão (será feito por empresa via aplicação)
-- e configuração inicial