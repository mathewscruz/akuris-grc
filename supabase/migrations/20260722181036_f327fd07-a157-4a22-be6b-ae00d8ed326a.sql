
-- 1) Storage bucket 'documentos': SELECT policy must scope by empresa (first folder segment)
DROP POLICY IF EXISTS "Users can view documents from their empresa" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents to their empresa" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents from their empresa" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents from their empresa" ON storage.objects;

CREATE POLICY "Users can view documentos from their empresa"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Users can upload documentos to their empresa"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Users can update documentos from their empresa"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
)
WITH CHECK (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Users can delete documentos from their empresa"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

-- 2) Riscos: enforce that only the designated approver can change approval / acceptance fields
CREATE OR REPLACE FUNCTION public.enforce_risco_aprovacao_aprovador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status_aprovacao IS DISTINCT FROM OLD.status_aprovacao THEN
    IF NEW.status_aprovacao IN ('aprovado', 'rejeitado') THEN
      IF OLD.aprovador_id IS NULL OR caller <> OLD.aprovador_id THEN
        RAISE EXCEPTION 'Somente o aprovador designado pode aprovar ou rejeitar o risco'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  IF NEW.status_aceite IS DISTINCT FROM OLD.status_aceite THEN
    IF NEW.status_aceite IN ('aprovado', 'rejeitado') THEN
      IF OLD.aprovador_aceite IS NULL OR caller <> OLD.aprovador_aceite THEN
        RAISE EXCEPTION 'Somente o aprovador de aceite designado pode decidir sobre o aceite do risco'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_risco_aprovacao ON public.riscos;
CREATE TRIGGER trg_enforce_risco_aprovacao
  BEFORE UPDATE ON public.riscos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_risco_aprovacao_aprovador();
