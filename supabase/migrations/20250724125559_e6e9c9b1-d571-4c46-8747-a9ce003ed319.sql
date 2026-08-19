-- Remover TODAS as políticas RLS existentes da tabela profiles
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can delete any user" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their empresa" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their empresa" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in their empresa" ON public.profiles;

-- Criar políticas RLS simples e não conflitantes

-- SELECT: Super admins veem tudo, admins veem sua empresa, usuários veem só seu perfil
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT
USING (
  is_super_admin() OR 
  (is_admin() AND empresa_id = get_user_empresa_id()) OR
  user_id = auth.uid()
);

-- INSERT: Super admins e admins podem criar usuários
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT
WITH CHECK (
  is_super_admin() OR
  (is_admin() AND empresa_id = get_user_empresa_id())
);

-- UPDATE: Super admins atualizam qualquer perfil, admins atualizam em sua empresa, usuários atualizam próprio perfil
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE
USING (
  is_super_admin() OR
  (is_admin() AND empresa_id = get_user_empresa_id()) OR
  user_id = auth.uid()
);

-- DELETE: Super admins excluem qualquer usuário, admins excluem usuários não-admin de sua empresa
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE
USING (
  is_super_admin() OR
  (is_admin() AND empresa_id = get_user_empresa_id() AND role != 'super_admin' AND role != 'admin')
);