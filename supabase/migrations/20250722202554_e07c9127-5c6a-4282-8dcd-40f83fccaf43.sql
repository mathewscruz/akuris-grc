
-- Corrigir políticas do storage empresa-logos para permitir admins atualizarem logo da própria empresa
DROP POLICY IF EXISTS "Admins can upload empresa logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update empresa logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete empresa logos" ON storage.objects;

-- Criar políticas mais específicas que verificam se o usuário é admin/super_admin da empresa
CREATE POLICY "Admins can upload empresa logos" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'empresa-logos' AND 
  auth.role() = 'authenticated' AND
  (is_admin_or_super_admin() OR is_super_admin())
);

CREATE POLICY "Admins can update empresa logos" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'empresa-logos' AND 
  auth.role() = 'authenticated' AND
  (is_admin_or_super_admin() OR is_super_admin())
);

CREATE POLICY "Admins can delete empresa logos" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'empresa-logos' AND 
  auth.role() = 'authenticated' AND
  (is_admin_or_super_admin() OR is_super_admin())
);

-- Garantir que admins podem atualizar a logo_url da própria empresa
DROP POLICY IF EXISTS "Admins can update their empresa logo_url" ON public.empresas;

CREATE POLICY "Admins can update their empresa logo_url" 
ON public.empresas FOR UPDATE 
USING (
  id = get_user_empresa_id() AND 
  (is_admin_or_super_admin() OR is_super_admin())
);
