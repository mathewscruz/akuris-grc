CREATE OR REPLACE FUNCTION public.generate_temp_password()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  lowercase TEXT := 'abcdefghijkmnpqrstuvwxyz';
  uppercase TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  numbers TEXT := '23456789';
  specials TEXT := '!@#$%&*+-=?';
  result TEXT := '';
  i INTEGER := 0;
  remaining_length INTEGER := 8; -- 12 total - 4 guaranteed chars
BEGIN
  -- Garantir pelo menos um de cada tipo
  result := result || substr(lowercase, floor(random() * length(lowercase) + 1)::integer, 1);
  result := result || substr(uppercase, floor(random() * length(uppercase) + 1)::integer, 1);
  result := result || substr(numbers, floor(random() * length(numbers) + 1)::integer, 1);
  result := result || substr(specials, floor(random() * length(specials) + 1)::integer, 1);
  
  -- Completar com caracteres aleatórios dos 4 tipos
  FOR i IN 1..remaining_length LOOP
    CASE floor(random() * 4)::integer
      WHEN 0 THEN
        result := result || substr(lowercase, floor(random() * length(lowercase) + 1)::integer, 1);
      WHEN 1 THEN
        result := result || substr(uppercase, floor(random() * length(uppercase) + 1)::integer, 1);
      WHEN 2 THEN
        result := result || substr(numbers, floor(random() * length(numbers) + 1)::integer, 1);
      ELSE
        result := result || substr(specials, floor(random() * length(specials) + 1)::integer, 1);
    END CASE;
  END LOOP;
  
  -- Embaralhar o resultado final para randomizar a posição dos caracteres garantidos
  -- Usar uma abordagem simples de swap aleatório
  DECLARE
    temp_char CHAR(1);
    pos1 INTEGER;
    pos2 INTEGER;
    shuffle_count INTEGER := 20;
  BEGIN
    FOR i IN 1..shuffle_count LOOP
      pos1 := floor(random() * length(result) + 1)::integer;
      pos2 := floor(random() * length(result) + 1)::integer;
      
      temp_char := substr(result, pos1, 1);
      result := overlay(result placing substr(result, pos2, 1) from pos1 for 1);
      result := overlay(result placing temp_char from pos2 for 1);
    END LOOP;
  END;
  
  RETURN result;
END;
$function$