ALTER TABLE public.riscos ADD COLUMN IF NOT EXISTS codigo text;

-- Backfill sequencial por empresa, por ordem de criação
WITH ord AS (
  SELECT id, empresa_id,
         row_number() OVER (PARTITION BY empresa_id ORDER BY created_at, id) AS rn
  FROM public.riscos
  WHERE codigo IS NULL
)
UPDATE public.riscos r
SET codigo = 'R-' || lpad(ord.rn::text, 4, '0')
FROM ord
WHERE r.id = ord.id;

CREATE UNIQUE INDEX IF NOT EXISTS riscos_empresa_codigo_uidx
  ON public.riscos (empresa_id, upper(codigo))
  WHERE codigo IS NOT NULL;

CREATE OR REPLACE FUNCTION public.riscos_set_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  FROM public.riscos
  WHERE empresa_id = NEW.empresa_id
    AND codigo ~ '^R-\d+$';

  NEW.codigo := 'R-' || lpad(proximo::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS riscos_set_codigo_trg ON public.riscos;
CREATE TRIGGER riscos_set_codigo_trg
BEFORE INSERT ON public.riscos
FOR EACH ROW EXECUTE FUNCTION public.riscos_set_codigo();