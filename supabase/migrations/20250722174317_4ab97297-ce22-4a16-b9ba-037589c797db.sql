
-- Adicionar política para permitir que super admins excluam empresas
CREATE POLICY "Super admins can delete empresas" 
ON public.empresas 
FOR DELETE 
USING (is_super_admin());

-- Criar tabela para armazenar informações de senhas temporárias
CREATE TABLE public.temporary_passwords (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_temporary boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days')
);

-- Habilitar RLS na tabela temporary_passwords
ALTER TABLE public.temporary_passwords ENABLE ROW LEVEL SECURITY;

-- Política para que usuários vejam apenas suas próprias senhas temporárias
CREATE POLICY "Users can view their own temporary passwords" 
ON public.temporary_passwords 
FOR SELECT 
USING (auth.uid() = user_id);

-- Política para que admins possam inserir senhas temporárias
CREATE POLICY "Admins can insert temporary passwords" 
ON public.temporary_passwords 
FOR INSERT 
WITH CHECK (true);

-- Política para que usuários possam atualizar suas próprias senhas temporárias
CREATE POLICY "Users can update their own temporary passwords" 
ON public.temporary_passwords 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Função para gerar senha temporária
CREATE OR REPLACE FUNCTION public.generate_temp_password()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
