DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documentos_aprovacoes_documento_id_fkey'
      AND contype = 'f'
      AND conrelid = 'public.documentos_aprovacoes'::regclass
  ) THEN
    ALTER TABLE public.documentos_aprovacoes
      ADD CONSTRAINT documentos_aprovacoes_documento_id_fkey
      FOREIGN KEY (documento_id)
      REFERENCES public.documentos(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
DECLARE
  orfas INT;
BEGIN
  SELECT COUNT(*) INTO orfas
  FROM public.documentos_aprovacoes a
  WHERE NOT EXISTS (
    SELECT 1 FROM public.documentos d WHERE d.id = a.documento_id
  );

  IF orfas = 0 THEN
    EXECUTE 'ALTER TABLE public.documentos_aprovacoes
             VALIDATE CONSTRAINT documentos_aprovacoes_documento_id_fkey';
  ELSE
    RAISE NOTICE
      'documentos_aprovacoes: % aprovacao(oes) sem documento correspondente; FK documento_id mantida NOT VALID (nenhum dado removido)',
      orfas;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documentos_aprovacoes_solicitado_por_profiles_fkey'
      AND contype = 'f'
      AND conrelid = 'public.documentos_aprovacoes'::regclass
  ) THEN
    ALTER TABLE public.documentos_aprovacoes
      ADD CONSTRAINT documentos_aprovacoes_solicitado_por_profiles_fkey
      FOREIGN KEY (solicitado_por)
      REFERENCES public.profiles(user_id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

DO $$
DECLARE
  orfas INT;
BEGIN
  SELECT COUNT(*) INTO orfas
  FROM public.documentos_aprovacoes a
  WHERE a.solicitado_por IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = a.solicitado_por
    );

  IF orfas = 0 THEN
    EXECUTE 'ALTER TABLE public.documentos_aprovacoes
             VALIDATE CONSTRAINT documentos_aprovacoes_solicitado_por_profiles_fkey';
  ELSE
    RAISE NOTICE
      'documentos_aprovacoes: % linha(s) com solicitado_por sem profile; FK mantida NOT VALID (nenhum dado alterado)',
      orfas;
  END IF;
END $$;