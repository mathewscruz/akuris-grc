-- Código sequencial do controlo interno (CTRL-0001).
--
-- `controles.codigo` era campo livre: vazio gravava NULL e a coluna Código da
-- listagem ficava inteira a "—". Um auditor referencia o controlo por código no
-- papel de trabalho, por isso tem de existir sempre e ser estável.
--
-- Mesma mecânica de `riscos_set_codigo()` (R-0001), sequência por empresa, com o
-- código escrito pelo utilizador a ter precedência quando existe.

CREATE OR REPLACE FUNCTION public.controles_set_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  proximo integer;
BEGIN
  IF NEW.codigo IS NOT NULL AND btrim(NEW.codigo) <> '' THEN
    NEW.codigo := btrim(NEW.codigo);
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX((regexp_replace(codigo, '^\D*', ''))::integer), 0) + 1
    INTO proximo
  FROM public.controles
  WHERE empresa_id = NEW.empresa_id
    AND codigo ~ '^CTRL-\d+$';

  NEW.codigo := 'CTRL-' || lpad(proximo::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS controles_set_codigo_trg ON public.controles;
CREATE TRIGGER controles_set_codigo_trg
  BEFORE INSERT ON public.controles
  FOR EACH ROW EXECUTE FUNCTION public.controles_set_codigo();

-- Preenche os controlos que já existem, por empresa e por ordem de criação, para
-- que a numeração acompanhe a antiguidade do registo.
WITH numerados AS (
  SELECT id,
         empresa_id,
         'CTRL-' || lpad(ROW_NUMBER() OVER (PARTITION BY empresa_id ORDER BY created_at, id)::text, 4, '0') AS novo_codigo
    FROM public.controles
   WHERE codigo IS NULL OR btrim(codigo) = ''
)
UPDATE public.controles c
   SET codigo = n.novo_codigo
  FROM numerados n
 WHERE c.id = n.id;

-- Dois controlos da mesma empresa não podem partilhar código: é o identificador
-- que sai no relatório e na exportação.
CREATE UNIQUE INDEX IF NOT EXISTS controles_codigo_por_empresa_uidx
  ON public.controles (empresa_id, codigo)
  WHERE codigo IS NOT NULL;

COMMENT ON FUNCTION public.controles_set_codigo() IS
  'Gera CTRL-0001 sequencial por empresa quando o controlo entra sem código.';
