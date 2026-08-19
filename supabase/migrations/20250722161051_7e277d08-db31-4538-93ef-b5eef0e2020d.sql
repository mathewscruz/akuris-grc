-- GovernAII Database Schema - Multiempresa GRC Platform

-- Enum para tipos de perfil de usuário
CREATE TYPE public.user_role AS ENUM ('super_admin', 'admin', 'user', 'readonly');

-- Tabela de empresas
CREATE TABLE public.empresas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    logo_url TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de perfis de usuário (estende auth.users)
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de ativos (primeiro módulo)
CREATE TABLE public.ativos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL, -- Ex: servidor, aplicacao, banco_dados, rede, etc
    descricao TEXT,
    proprietario TEXT,
    localizacao TEXT,
    valor_negocio TEXT, -- alto, medio, baixo
    criticidade TEXT DEFAULT 'medio', -- critico, alto, medio, baixo
    status TEXT DEFAULT 'ativo', -- ativo, inativo, descontinuado
    data_aquisicao DATE,
    fornecedor TEXT,
    versao TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS em todas as tabelas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ativos ENABLE ROW LEVEL SECURITY;

-- Função para obter empresa do usuário logado
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Função para verificar se usuário é super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- RLS Policies para empresas
CREATE POLICY "Super admins can view all empresas" 
ON public.empresas FOR SELECT 
USING (public.is_super_admin());

CREATE POLICY "Users can view their own empresa" 
ON public.empresas FOR SELECT 
USING (id = public.get_user_empresa_id());

CREATE POLICY "Super admins can insert empresas" 
ON public.empresas FOR INSERT 
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update empresas" 
ON public.empresas FOR UPDATE 
USING (public.is_super_admin());

-- RLS Policies para profiles
CREATE POLICY "Users can view profiles from their empresa" 
ON public.profiles FOR SELECT 
USING (
  empresa_id = public.get_user_empresa_id() OR 
  public.is_super_admin()
);

CREATE POLICY "Admins can insert profiles in their empresa" 
ON public.profiles FOR INSERT 
WITH CHECK (
  empresa_id = public.get_user_empresa_id() OR 
  public.is_super_admin()
);

CREATE POLICY "Admins can update profiles in their empresa" 
ON public.profiles FOR UPDATE 
USING (
  empresa_id = public.get_user_empresa_id() OR 
  public.is_super_admin()
);

-- RLS Policies para ativos
CREATE POLICY "Users can view ativos from their empresa" 
ON public.ativos FOR SELECT 
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can insert ativos in their empresa" 
ON public.ativos FOR INSERT 
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can update ativos from their empresa" 
ON public.ativos FOR UPDATE 
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can delete ativos from their empresa" 
ON public.ativos FOR DELETE 
USING (empresa_id = public.get_user_empresa_id());

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_empresas_updated_at
    BEFORE UPDATE ON public.empresas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ativos_updated_at
    BEFORE UPDATE ON public.ativos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar profile automático ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    NEW.email,
    CASE 
      WHEN NEW.email = 'admin@governaii.com' THEN 'super_admin'::user_role
      ELSE 'user'::user_role
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Inserir dados iniciais
INSERT INTO public.empresas (nome) VALUES ('GovernAII Demo');

-- Índices para performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_empresa_id ON public.profiles(empresa_id);
CREATE INDEX idx_ativos_empresa_id ON public.ativos(empresa_id);
CREATE INDEX idx_ativos_tipo ON public.ativos(tipo);
CREATE INDEX idx_ativos_status ON public.ativos(status);