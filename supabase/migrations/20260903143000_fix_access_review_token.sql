-- A extensão pgcrypto vive no schema `extensions` na instalação do Supabase.
-- A função anterior limitava o search_path a `public`, por isso a criação de
-- uma revisão de acessos falhava ao tentar resolver gen_random_bytes().
CREATE OR REPLACE FUNCTION public.gerar_token_revisao()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  token text;
BEGIN
  token := encode(extensions.gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_token_revisao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_token_revisao() TO authenticated;

COMMENT ON FUNCTION public.gerar_token_revisao() IS
  'Gera um token criptograficamente seguro para o link externo de revisão de acessos.';
