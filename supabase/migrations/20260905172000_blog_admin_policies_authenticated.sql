-- Public readers must not evaluate administrative predicates. These policies
-- used TO public, so an anonymous sitemap request could invoke is_super_admin
-- even though the separate published-post SELECT policy already allowed it.
-- Narrow the administrative policies; do not grant anon any helper execution,
-- expose drafts, remove MFA, or change the published-post policy.
ALTER POLICY "Super admin vê rascunhos do blog" ON public.blog_posts TO authenticated;
ALTER POLICY "Super admin escreve no blog" ON public.blog_posts TO authenticated;
ALTER POLICY "Super admin altera o blog" ON public.blog_posts TO authenticated;
ALTER POLICY "Super admin apaga do blog" ON public.blog_posts TO authenticated;
