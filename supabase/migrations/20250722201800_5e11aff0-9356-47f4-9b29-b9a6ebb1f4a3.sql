
-- Criar função para verificar se o usuário é admin ou super_admin
CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

-- Atualizar políticas para o bucket empresa-logos
DROP POLICY IF EXISTS "Admins can upload empresa logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update empresa logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete empresa logos" ON storage.objects;

CREATE POLICY "Admins can upload empresa logos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'empresa-logos' AND is_admin_or_super_admin());

CREATE POLICY "Admins can update empresa logos" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'empresa-logos' AND is_admin_or_super_admin());

CREATE POLICY "Admins can delete empresa logos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'empresa-logos' AND is_admin_or_super_admin());

-- Atualizar políticas para o bucket profile-photos para usar a mesma função
DROP POLICY IF EXISTS "Users can upload their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile photos" ON storage.objects;

CREATE POLICY "Users can upload their own profile photos" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'profile-photos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own profile photos" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'profile-photos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own profile photos" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'profile-photos' AND 
  auth.role() = 'authenticated'
);
