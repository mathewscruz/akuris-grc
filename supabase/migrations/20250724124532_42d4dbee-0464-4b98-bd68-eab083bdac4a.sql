-- Remover TODAS as políticas RLS conflitantes da tabela profiles
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in their empresa" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their empresa" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete users from their empresa" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can delete any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON public.profiles;

-- Criar conjunto limpo e simples de políticas RLS para profiles

-- SELECT: Super admins veem tudo, admins veem sua empresa, usuários veem próprio perfil
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (
  is_super_admin() OR 
  (is_admin() AND empresa_id = get_user_empresa_id()) OR
  user_id = auth.uid()
);

-- INSERT: Permitir criação durante signup + admins inserem em sua empresa
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT WITH CHECK (
  user_id = auth.uid() OR
  (is_admin() AND empresa_id = get_user_empresa_id())
);

-- UPDATE: Super admins atualizam tudo, admins atualizam em sua empresa, usuários próprio perfil
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (
  is_super_admin() OR
  (is_admin() AND empresa_id = get_user_empresa_id()) OR
  user_id = auth.uid()
);

-- DELETE: Super admins deletam qualquer um, admins deletam usuários não-admin de sua empresa
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE USING (
  is_super_admin() OR
  (is_admin() AND empresa_id = get_user_empresa_id() AND role NOT IN ('admin', 'super_admin'))
);