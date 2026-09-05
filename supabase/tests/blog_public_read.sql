-- Run against the local test database only. All fixtures and permission changes roll back.
BEGIN;
INSERT INTO public.blog_posts (slug, titulo, resumo, conteudo_md, published)
VALUES ('qa-public-' || gen_random_uuid(), 'QA', 'QA', 'QA', true),
       ('qa-draft-' || gen_random_uuid(), 'QA', 'QA', 'QA', false);
SELECT set_config('akuris_test.published', (SELECT count(*)::text FROM public.blog_posts WHERE published), true);
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;

-- APPLY_BLOG_POLICY_MIGRATION

SET LOCAL ROLE anon;
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.blog_posts) <> current_setting('akuris_test.published')::int THEN
    RAISE EXCEPTION 'Public reader lost published posts or can read drafts';
  END IF;
  IF EXISTS (SELECT 1 FROM public.blog_posts WHERE NOT published) THEN
    RAISE EXCEPTION 'Anonymous reader can see drafts';
  END IF;
  BEGIN
    INSERT INTO public.blog_posts (slug, titulo, resumo, conteudo_md) VALUES ('qa-denied-' || gen_random_uuid(), 'QA', 'QA', 'QA');
    RAISE EXCEPTION 'Anonymous write unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF has_function_privilege('anon', 'public.is_super_admin()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Test must not rely on granting administrative helper to anon';
  END IF;
  RAISE NOTICE 'PASS: published reads, draft isolation, write denial, no admin helper grant';
END
$test$;
RESET ROLE;
DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blog_posts' AND policyname LIKE 'Super admin %do blog' AND roles <> ARRAY['authenticated']::name[]) THEN
    RAISE EXCEPTION 'Administrative policies not restricted to authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blog_posts' AND policyname='Require valid MFA session') THEN
    RAISE EXCEPTION 'MFA policy was removed';
  END IF;
END
$test$;
ROLLBACK;
