-- Adicionar política RLS para permitir DELETE na tabela profiles
CREATE POLICY "Super admins can delete any user" 
ON public.profiles 
FOR DELETE 
USING (is_super_admin());

CREATE POLICY "Admins can delete users from their empresa" 
ON public.profiles 
FOR DELETE 
USING (
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
  AND empresa_id = get_user_empresa_id()
);