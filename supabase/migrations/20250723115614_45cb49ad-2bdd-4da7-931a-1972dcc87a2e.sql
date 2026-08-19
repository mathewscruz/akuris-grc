
-- Criar tabela para sistemas privilegiados
CREATE TABLE public.sistemas_privilegiados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  nome_sistema text NOT NULL,
  tipo_sistema text NOT NULL DEFAULT 'aplicacao',
  criticidade text NOT NULL DEFAULT 'media',
  responsavel_sistema text,
  url_sistema text,
  categoria text,
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela principal de contas privilegiadas
CREATE TABLE public.contas_privilegiadas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  sistema_id uuid REFERENCES public.sistemas_privilegiados(id) ON DELETE RESTRICT,
  usuario_beneficiario text NOT NULL,
  email_beneficiario text,
  tipo_acesso text NOT NULL DEFAULT 'administrativo',
  nivel_privilegio text NOT NULL DEFAULT 'alto',
  data_concessao date NOT NULL DEFAULT CURRENT_DATE,
  data_expiracao date NOT NULL,
  status text NOT NULL DEFAULT 'pendente_aprovacao',
  justificativa_negocio text NOT NULL,
  aprovado_por uuid,
  concedido_por uuid,
  data_aprovacao timestamp with time zone,
  observacoes text,
  renovavel boolean DEFAULT true,
  alerta_30_dias boolean DEFAULT false,
  alerta_15_dias boolean DEFAULT false,
  alerta_7_dias boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de aprovações
CREATE TABLE public.contas_aprovacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id uuid REFERENCES public.contas_privilegiadas(id) ON DELETE CASCADE,
  aprovador_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  data_aprovacao timestamp with time zone,
  comentarios text,
  nivel_aprovacao integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de auditoria para contas privilegiadas
CREATE TABLE public.contas_auditoria (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id uuid REFERENCES public.contas_privilegiadas(id) ON DELETE CASCADE,
  acao text NOT NULL,
  usuario_id uuid NOT NULL,
  data_acao timestamp with time zone DEFAULT now(),
  detalhes_alteracao jsonb,
  ip_address inet,
  user_agent text
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.sistemas_privilegiados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_privilegiadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para sistemas_privilegiados
CREATE POLICY "Users can view sistemas from their empresa" 
ON public.sistemas_privilegiados 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert sistemas in their empresa" 
ON public.sistemas_privilegiados 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update sistemas from their empresa" 
ON public.sistemas_privilegiados 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete sistemas from their empresa" 
ON public.sistemas_privilegiadas 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Políticas RLS para contas_privilegiadas
CREATE POLICY "Users can view contas from their empresa" 
ON public.contas_privilegiadas 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert contas in their empresa" 
ON public.contas_privilegiadas 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update contas from their empresa" 
ON public.contas_privilegiadas 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete contas from their empresa" 
ON public.contas_privilegiadas 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Políticas RLS para contas_aprovacoes
CREATE POLICY "Users can view aprovacoes from their empresa contas" 
ON public.contas_aprovacoes 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.contas_privilegiadas cp 
  WHERE cp.id = contas_aprovacoes.conta_id 
  AND cp.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can insert aprovacoes for their empresa contas" 
ON public.contas_aprovacoes 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.contas_privilegiadas cp 
  WHERE cp.id = contas_aprovacoes.conta_id 
  AND cp.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can update aprovacoes from their empresa contas" 
ON public.contas_aprovacoes 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.contas_privilegiadas cp 
  WHERE cp.id = contas_aprovacoes.conta_id 
  AND cp.empresa_id = get_user_empresa_id()
));

-- Políticas RLS para contas_auditoria
CREATE POLICY "Users can view auditoria from their empresa contas" 
ON public.contas_auditoria 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.contas_privilegiadas cp 
  WHERE cp.id = contas_auditoria.conta_id 
  AND cp.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can insert auditoria for their empresa contas" 
ON public.contas_auditoria 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.contas_privilegiadas cp 
  WHERE cp.id = contas_auditoria.conta_id 
  AND cp.empresa_id = get_user_empresa_id()
));

-- Trigger para updated_at em sistemas_privilegiados
CREATE TRIGGER update_sistemas_privilegiados_updated_at 
BEFORE UPDATE ON public.sistemas_privilegiados 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at em contas_privilegiadas
CREATE TRIGGER update_contas_privilegiadas_updated_at 
BEFORE UPDATE ON public.contas_privilegiadas 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar auditoria automaticamente
CREATE OR REPLACE FUNCTION public.create_conta_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.contas_auditoria (conta_id, acao, usuario_id, detalhes_alteracao)
    VALUES (NEW.id, 'CREATE', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.contas_auditoria (conta_id, acao, usuario_id, detalhes_alteracao)
    VALUES (NEW.id, 'UPDATE', auth.uid(), jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.contas_auditoria (conta_id, acao, usuario_id, detalhes_alteracao)
    VALUES (OLD.id, 'DELETE', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para auditoria automática
CREATE TRIGGER contas_privilegiadas_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.contas_privilegiadas
FOR EACH ROW EXECUTE FUNCTION public.create_conta_audit_log();

-- Função auxiliar para verificar se conta pertence à empresa
CREATE OR REPLACE FUNCTION public.conta_privilegiada_pertence_empresa(conta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contas_privilegiadas 
    WHERE id = conta_id AND empresa_id = get_user_empresa_id()
  );
$$;
