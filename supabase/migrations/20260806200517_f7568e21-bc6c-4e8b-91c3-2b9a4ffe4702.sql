DROP POLICY IF EXISTS "Admins can manage system modules" ON public.system_modules;

CREATE POLICY "Super admins can manage system modules"
ON public.system_modules
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());