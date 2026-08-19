-- Criar tabela de módulos do sistema
CREATE TABLE public.system_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  route_path TEXT,
  parent_module_id UUID REFERENCES public.system_modules(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de permissões de usuário por módulo
CREATE TABLE public.user_module_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id UUID NOT NULL REFERENCES public.system_modules(id) ON DELETE CASCADE,
  can_access BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_read BOOLEAN DEFAULT false,
  can_update BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.system_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas para system_modules (somente super_admin e admin podem gerenciar)
CREATE POLICY "Admins can manage system modules" 
ON public.system_modules 
FOR ALL 
USING (is_admin_or_super_admin())
WITH CHECK (is_admin_or_super_admin());

-- Política de leitura para todos os usuários autenticados
CREATE POLICY "Users can view active system modules" 
ON public.system_modules 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Políticas para user_module_permissions
CREATE POLICY "Users can view their own permissions" 
ON public.user_module_permissions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all permissions" 
ON public.user_module_permissions 
FOR ALL 
USING (is_admin_or_super_admin())
WITH CHECK (is_admin_or_super_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_system_modules_updated_at
BEFORE UPDATE ON public.system_modules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_module_permissions_updated_at
BEFORE UPDATE ON public.user_module_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Popular módulos iniciais
INSERT INTO public.system_modules (name, display_name, description, icon, route_path, order_index) VALUES
('dashboard', 'Dashboard', 'Painel principal com visão geral do sistema', 'LayoutDashboard', '/dashboard', 1),
('ativos', 'Gestão de Ativos', 'Gerenciamento de ativos da organização', 'Server', '/ativos', 2),
('riscos', 'Gestão de Riscos', 'Identificação e tratamento de riscos', 'AlertTriangle', '/riscos', 3),
('controles', 'Controles Internos', 'Gestão de controles e compliance', 'Shield', '/controles', 4),
('auditorias', 'Auditorias', 'Planejamento e execução de auditorias', 'Search', '/auditorias', 5),
('contratos', 'Gestão de Contratos', 'Controle de contratos e fornecedores', 'FileText', '/contratos', 6),
('documentos', 'Gestão Documental', 'Controle de documentos e versões', 'FolderOpen', '/documentos', 7),
('contas-privilegiadas', 'Contas Privilegiadas', 'Gestão de acessos privilegiados', 'UserCheck', '/contas-privilegiadas', 8),
('incidentes', 'Gestão de Incidentes', 'Registro e tratamento de incidentes', 'AlertCircle', '/incidentes', 9),
('dados', 'Proteção de Dados', 'Compliance com LGPD e proteção de dados', 'Database', '/dados', 10),
('due-diligence', 'Due Diligence', 'Avaliação de terceiros e fornecedores', 'UserSearch', '/due-diligence', 11),
('denuncia', 'Canal de Denúncias', 'Sistema de denúncias e ética', 'MessageSquare', '/denuncia', 12),
('configuracoes', 'Configurações', 'Configurações do sistema e usuários', 'Settings', '/configuracoes', 13);

-- Criar função para aplicar permissões padrão baseadas em roles
CREATE OR REPLACE FUNCTION apply_default_permissions_for_user(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role user_role;
  module_rec RECORD;
BEGIN
  -- Buscar role do usuário
  SELECT role INTO user_role FROM public.profiles WHERE user_id = user_id_param;
  
  -- Para cada módulo ativo, criar permissões baseadas na role
  FOR module_rec IN 
    SELECT id, name FROM public.system_modules WHERE is_active = true
  LOOP
    INSERT INTO public.user_module_permissions (
      user_id, 
      module_id, 
      can_access, 
      can_create, 
      can_read, 
      can_update, 
      can_delete
    ) VALUES (
      user_id_param,
      module_rec.id,
      CASE 
        WHEN user_role = 'super_admin' THEN true
        WHEN user_role = 'admin' THEN true
        WHEN user_role = 'user' THEN module_rec.name != 'configuracoes'
        WHEN user_role = 'readonly' THEN false
        ELSE false
      END,
      CASE 
        WHEN user_role = 'super_admin' THEN true
        WHEN user_role = 'admin' THEN true
        WHEN user_role = 'user' THEN module_rec.name NOT IN ('configuracoes', 'auditorias')
        ELSE false
      END,
      CASE 
        WHEN user_role = 'readonly' THEN module_rec.name != 'configuracoes'
        ELSE true
      END,
      CASE 
        WHEN user_role = 'super_admin' THEN true
        WHEN user_role = 'admin' THEN true
        WHEN user_role = 'user' THEN module_rec.name NOT IN ('configuracoes', 'auditorias')
        ELSE false
      END,
      CASE 
        WHEN user_role = 'super_admin' THEN true
        WHEN user_role = 'admin' THEN module_rec.name != 'configuracoes'
        ELSE false
      END
    ) ON CONFLICT (user_id, module_id) DO NOTHING;
  END LOOP;
END;
$$;