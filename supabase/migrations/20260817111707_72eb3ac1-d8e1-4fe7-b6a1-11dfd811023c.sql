CREATE POLICY "Super admins can view all permission profiles"
ON public.permission_profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));