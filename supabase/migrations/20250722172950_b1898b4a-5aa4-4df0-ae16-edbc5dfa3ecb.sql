
-- Adicionar campos CNPJ e contato na tabela empresas
ALTER TABLE public.empresas 
ADD COLUMN cnpj TEXT,
ADD COLUMN contato TEXT;

-- Criar bucket para logos de empresas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('empresa-logos', 'empresa-logos', true);

-- Criar bucket para fotos de perfil
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-photos', 'profile-photos', true);

-- Adicionar campo foto_url na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN foto_url TEXT;

-- Criar políticas para o bucket empresa-logos
CREATE POLICY "Authenticated users can view empresa logos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'empresa-logos');

CREATE POLICY "Admins can upload empresa logos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'empresa-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can update empresa logos" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'empresa-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete empresa logos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'empresa-logos' AND auth.role() = 'authenticated');

-- Criar políticas para o bucket profile-photos
CREATE POLICY "Users can view profile photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'profile-photos');

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
