CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  resumo TEXT NOT NULL,
  conteudo_md TEXT NOT NULL,
  capa_url TEXT,
  autor TEXT NOT NULL DEFAULT 'Equipe Akuris',
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  tags TEXT[] NOT NULL DEFAULT '{}',
  framework_slug TEXT,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blog_posts_published ON public.blog_posts (published, published_at DESC);
CREATE INDEX idx_blog_posts_slug ON public.blog_posts (slug);
CREATE INDEX idx_blog_posts_tags ON public.blog_posts USING GIN (tags);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas dos posts publicados
CREATE POLICY "Posts publicados sao publicos"
  ON public.blog_posts FOR SELECT
  USING (published = true);

-- Super-admins podem ler todos (inclusive rascunhos)
CREATE POLICY "Super admins veem todos os posts"
  ON public.blog_posts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins criam posts"
  ON public.blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins editam posts"
  ON public.blog_posts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins removem posts"
  ON public.blog_posts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();