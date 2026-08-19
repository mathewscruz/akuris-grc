-- Criar função is_admin para evitar recursão nas políticas RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

-- Atualizar política DELETE para profiles - admins podem deletar usuários da mesma empresa
DROP POLICY IF EXISTS "Admins can delete users from their empresa" ON public.profiles;
CREATE POLICY "Admins can delete users from their empresa" 
ON public.profiles 
FOR DELETE 
USING (
  is_admin() AND 
  (is_super_admin() OR empresa_id = get_user_empresa_id())
);