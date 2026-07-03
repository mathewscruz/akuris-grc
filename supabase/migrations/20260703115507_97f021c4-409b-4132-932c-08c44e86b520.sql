CREATE TABLE IF NOT EXISTS public.empresa_ai_context_cache (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_ai_context_cache TO authenticated;
GRANT ALL ON public.empresa_ai_context_cache TO service_role;
ALTER TABLE public.empresa_ai_context_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cache_by_empresa_read" ON public.empresa_ai_context_cache;
CREATE POLICY "cache_by_empresa_read"
  ON public.empresa_ai_context_cache
  FOR SELECT
  TO authenticated
  USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_ai_context_cache_expires
  ON public.empresa_ai_context_cache(expires_at);