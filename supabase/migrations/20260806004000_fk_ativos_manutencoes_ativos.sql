-- Restore the relationship expected by PostgREST for notification embeds.
-- This migration is intentionally non-destructive: legacy orphan rows are
-- preserved and the constraint remains NOT VALID until data is consistent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ativos_manutencoes_ativo_id_ativos_fkey'
      AND conrelid = 'public.ativos_manutencoes'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE public.ativos_manutencoes
      ADD CONSTRAINT ativos_manutencoes_ativo_id_ativos_fkey
      FOREIGN KEY (ativo_id)
      REFERENCES public.ativos(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

DO $$
DECLARE
  orphan_count bigint;
BEGIN
  SELECT count(*)
    INTO orphan_count
  FROM public.ativos_manutencoes manutencao
  LEFT JOIN public.ativos ativo ON ativo.id = manutencao.ativo_id
  WHERE ativo.id IS NULL;

  IF orphan_count = 0 THEN
    ALTER TABLE public.ativos_manutencoes
      VALIDATE CONSTRAINT ativos_manutencoes_ativo_id_ativos_fkey;
  ELSE
    RAISE NOTICE 'ativos_manutencoes has % orphan row(s); FK created NOT VALID and no data was changed', orphan_count;
  END IF;
END
$$;
