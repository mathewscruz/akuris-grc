DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN SELECT id, nome FROM public.empresas WHERE slug IS NULL OR btrim(slug) = '' LOOP
    base := lower(regexp_replace(translate(coalesce(r.nome,'empresa'),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
      'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'),
      '[^a-zA-Z0-9]+', '-', 'g'));
    base := btrim(base, '-');
    base := left(base, 40);
    IF base IS NULL OR length(base) < 3 THEN
      base := 'empresa-' || left(replace(r.id::text, '-', ''), 6);
    END IF;
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.empresas WHERE lower(slug) = candidate) LOOP
      n := n + 1;
      candidate := left(base, 36) || '-' || n::text;
    END LOOP;
    UPDATE public.empresas SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS empresas_slug_lower_unique_idx ON public.empresas (lower(slug)) WHERE slug IS NOT NULL;