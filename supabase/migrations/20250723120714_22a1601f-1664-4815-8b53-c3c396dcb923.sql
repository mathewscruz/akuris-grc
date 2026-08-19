-- Criar tabela para sistemas privilegiados
CREATE TABLE public.sistemas_privilegiados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  nome_sistema text NOT NULL,
  tipo_sistema text NOT NULL,
  criticidade text NOT NULL DEFAULT 'media',
  responsavel_sistema text,
  url_sistema text,
  categoria text,
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela para contas privilegiadas
CREATE TABLE public.contas_privilegiadas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  sistema_id uuid NOT NULL,
  usuario_beneficiario text NOT NULL,
  email_beneficiario text,
  tipo_acesso text NOT NULL,
  nivel_privilegio text NOT NULL,
  data_concessao date NOT NULL,
  data_expiracao date,
  status text NOT NULL DEFAULT 'ativa',
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

-- Criar tabela para aprovações de contas privilegiadas
CREATE TABLE public.contas_aprovacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id uuid NOT NULL,
  aprovador_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  data_aprovacao timestamp with time zone,
  comentarios text,
  nivel_aprovacao integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now()
);

-- Criar tabela para auditoria de contas privilegiadas
CREATE TABLE public.contas_auditoria (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id uuid NOT NULL,
  acao text NOT NULL,
  usuario_id uuid,
  data_acao timestamp with time zone DEFAULT now(),
  detalhes_alteracao jsonb,
  ip_address inet,
  user_agent text
);

-- Habilitar RLS
ALTER TABLE public.sistemas_privilegiados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_privilegiadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_auditoria ENABLE ROW LEVEL SECURITY;

-- Criar função primeiro, antes das políticas
CREATE OR REPLACE FUNCTION public.conta_privilegiada_pertence_empresa(conta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM contas_privilegiadas 
    WHERE id = conta_id AND empresa_id = get_user_empresa_id()
  );
$$;

-- Políticas RLS para sistemas_privilegiados
CREATE POLICY "Users can view systems from their empresa" ON public.sistemas_privilegiados
FOR SELECT USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert systems in their empresa" ON public.sistemas_privilegiados
FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update systems from their empresa" ON public.sistemas_privilegiados
FOR UPDATE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete systems from their empresa" ON public.sistemas_privilegiados
FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Políticas RLS para contas_privilegiadas
CREATE POLICY "Users can view accounts from their empresa" ON public.contas_privilegiadas
FOR SELECT USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert accounts in their empresa" ON public.contas_privilegiadas
FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update accounts from their empresa" ON public.contas_privilegiadas
FOR UPDATE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete accounts from their empresa" ON public.contas_privilegiadas
FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Políticas RLS para contas_aprovacoes
CREATE POLICY "Users can view approvals from their empresa" ON public.contas_aprovacoes
FOR SELECT USING (conta_privilegiada_pertence_empresa(conta_id));

CREATE POLICY "Users can insert approvals in their empresa" ON public.contas_aprovacoes
FOR INSERT WITH CHECK (conta_privilegiada_pertence_empresa(conta_id));

CREATE POLICY "Users can update approvals from their empresa" ON public.contas_aprovacoes
FOR UPDATE USING (conta_privilegiada_pertence_empresa(conta_id));

CREATE POLICY "Users can delete approvals from their empresa" ON public.contas_aprovacoes
FOR DELETE USING (conta_privilegiada_pertence_empresa(conta_id));

-- Políticas RLS para contas_auditoria
CREATE POLICY "Users can view audit logs from their empresa" ON public.contas_auditoria
FOR SELECT USING (conta_privilegiada_pertence_empresa(conta_id));

-- Triggers para updated_at
CREATE TRIGGER update_sistemas_privilegiados_updated_at
  BEFORE UPDATE ON public.sistemas_privilegiados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contas_privilegiadas_updated_at
  BEFORE UPDATE ON public.contas_privilegiadas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();