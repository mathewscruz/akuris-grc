-- A versão anterior usava `random()` e ainda era executável pelo papel anon.
-- Senhas temporárias precisam de uma fonte criptográfica e o endpoint não faz
-- parte de nenhum fluxo público do produto.
CREATE OR REPLACE FUNCTION public.generate_temp_password()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  lowercase constant text := 'abcdefghijkmnpqrstuvwxyz';
  uppercase constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  numbers constant text := '23456789';
  specials constant text := '!@#$%&*+-=?';
  pool constant text := lowercase || uppercase || numbers || specials;
  result text := '';
  pos integer;
  temp_char text;
BEGIN
  -- Um carácter de cada grupo e mais doze escolhidos do conjunto completo.
  result := result || substr(lowercase, 1 + get_byte(extensions.gen_random_bytes(1), 0) % length(lowercase), 1);
  result := result || substr(uppercase, 1 + get_byte(extensions.gen_random_bytes(1), 0) % length(uppercase), 1);
  result := result || substr(numbers, 1 + get_byte(extensions.gen_random_bytes(1), 0) % length(numbers), 1);
  result := result || substr(specials, 1 + get_byte(extensions.gen_random_bytes(1), 0) % length(specials), 1);

  FOR idx IN 1..12 LOOP
    result := result || substr(pool, 1 + get_byte(extensions.gen_random_bytes(1), 0) % length(pool), 1);
  END LOOP;

  -- Fisher-Yates com a mesma fonte criptográfica.
  FOR idx IN REVERSE length(result)..2 LOOP
    pos := 1 + get_byte(extensions.gen_random_bytes(1), 0) % idx;
    temp_char := substr(result, idx, 1);
    result := overlay(result placing substr(result, pos, 1) from idx for 1);
    result := overlay(result placing temp_char from pos for 1);
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_temp_password() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_temp_password() TO authenticated, service_role;

COMMENT ON FUNCTION public.generate_temp_password() IS
  'Gera uma senha temporária de 16 caracteres com entropia criptográfica.';
