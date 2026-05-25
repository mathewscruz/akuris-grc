
-- 1) Revoke EXECUTE from anon on all SECURITY DEFINER functions in public,
--    then re-grant only those needed by unauthenticated public flows.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE') = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon;', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Re-grant EXECUTE to anon ONLY for functions explicitly used by public flows.
GRANT EXECUTE ON FUNCTION public.get_assessment_empresa_info(text) TO anon;
GRANT EXECUTE ON FUNCTION public.can_update_assessment_via_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_empresa_by_slug(text) TO anon;

-- Best-effort grants (only if signatures exist); ignore if not present.
DO $$
BEGIN
  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_denuncia_config_publica(text) TO anon';
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.validate_denuncia_token(text) TO anon';
  EXCEPTION WHEN undefined_function THEN NULL; END;
END $$;

-- 2) Restrict broad listing on public asset buckets (keep public READ-by-URL).
--    Drop overly permissive SELECT policies that allow `LIST` over the whole bucket.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND qual ILIKE '%bucket_id%'
      AND (
        qual ILIKE '%empresa-logos%'
        OR qual ILIKE '%profile-photos%'
        OR qual ILIKE '%public-assets%'
        OR qual ILIKE '%sistema-logos%'
        OR qual ILIKE '%email-assets%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', pol.policyname);
  END LOOP;
END $$;

-- Recreate read access restricted to authenticated users for these buckets.
-- Public read by URL continues to work via the bucket's `public = true` flag
-- (Supabase Storage serves public URLs without invoking RLS for object retrieval).
CREATE POLICY "Authenticated can read public asset buckets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN ('empresa-logos','profile-photos','public-assets','sistema-logos','email-assets')
);
