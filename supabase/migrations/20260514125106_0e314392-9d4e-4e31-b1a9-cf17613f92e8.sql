-- 1) user_module_permissions
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_module_permissions;

CREATE POLICY "Super admins can manage all permissions"
ON public.user_module_permissions
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Admins can manage permissions in own empresa"
ON public.user_module_permissions
FOR ALL
TO authenticated
USING (
  public.is_admin()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_module_permissions.user_id
      AND p.empresa_id = public.get_user_empresa_id()
  )
)
WITH CHECK (
  public.is_admin()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_module_permissions.user_id
      AND p.empresa_id = public.get_user_empresa_id()
  )
);

-- 2) email_campanha_logs: insert apenas para autenticados da mesma empresa do criador
DROP POLICY IF EXISTS "Sistema pode inserir logs de campanha" ON public.email_campanha_logs;

CREATE POLICY "Authenticated can insert logs for own empresa campaigns"
ON public.email_campanha_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.email_campanhas c
    JOIN public.profiles p ON p.user_id = c.criado_por
    WHERE c.id = email_campanha_logs.campanha_id
      AND p.empresa_id = public.get_user_empresa_id()
  )
);

-- 3) profile-photos bucket
DROP POLICY IF EXISTS "Profile photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Profile photos publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated users can view profile photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'profile-photos');