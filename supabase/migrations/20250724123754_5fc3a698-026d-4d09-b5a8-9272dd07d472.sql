-- Limpar e recriar políticas RLS mais claras para a tabela profiles

-- Remover políticas existentes para profiles
DROP POLICY IF EXISTS "Admins can delete users from their empresa" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles from their empresa" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update users from their empresa" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert users in their empresa" ON public.profiles;

-- Política SELECT - Super admins veem todos, admins veem da empresa, usuários veem apenas da empresa
CREATE POLICY "Users can view profiles based on role" 
ON public.profiles 
FOR SELECT 
USING (
  CASE 
    WHEN is_super_admin() THEN true
    WHEN is_admin() THEN empresa_id = get_user_empresa_id()
    ELSE empresa_id = get_user_empresa_id()
  END
);

-- Política INSERT - Apenas admins e super admins podem criar usuários
CREATE POLICY "Admins can insert users" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  is_admin() AND (
    is_super_admin() OR empresa_id = get_user_empresa_id()
  )
);

-- Política UPDATE - Admins podem atualizar usuários da empresa, super admins todos
CREATE POLICY "Admins can update users" 
ON public.profiles 
FOR UPDATE 
USING (
  is_admin() AND (
    is_super_admin() OR empresa_id = get_user_empresa_id()
  )
);

-- Política DELETE mais simples e clara
CREATE POLICY "Admins can delete users" 
ON public.profiles 
FOR DELETE 
USING (
  -- Super admins podem deletar qualquer usuário
  is_super_admin() OR 
  -- Admins podem deletar usuários da mesma empresa (exceto outros admins/super admins)
  (is_admin() AND 
   empresa_id = get_user_empresa_id() AND 
   role NOT IN ('admin', 'super_admin'))
);

-- Adicionar função de debug para testar autenticação
CREATE OR REPLACE FUNCTION public.debug_user_context()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'auth_uid', auth.uid(),
    'user_role', (SELECT role FROM profiles WHERE user_id = auth.uid()),
    'user_empresa_id', get_user_empresa_id(),
    'is_admin', is_admin(),
    'is_super_admin', is_super_admin()
  );
$$;