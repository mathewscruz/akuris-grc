CREATE TABLE IF NOT EXISTS public.riscos_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risco_id uuid NOT NULL REFERENCES public.riscos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  comentario text NOT NULL,
  mencoes text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.riscos_comentarios TO authenticated;
GRANT ALL ON public.riscos_comentarios TO service_role;

CREATE INDEX IF NOT EXISTS idx_riscos_comentarios_risco ON public.riscos_comentarios(risco_id);
CREATE INDEX IF NOT EXISTS idx_riscos_comentarios_user ON public.riscos_comentarios(user_id);

ALTER TABLE public.riscos_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios podem ver comentarios de riscos da empresa" ON public.riscos_comentarios;
CREATE POLICY "Usuarios podem ver comentarios de riscos da empresa"
ON public.riscos_comentarios FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.riscos r WHERE r.id = risco_id AND r.empresa_id = public.get_user_empresa_id()));

DROP POLICY IF EXISTS "Usuarios podem criar comentarios em riscos da empresa" ON public.riscos_comentarios;
CREATE POLICY "Usuarios podem criar comentarios em riscos da empresa"
ON public.riscos_comentarios FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.riscos r WHERE r.id = risco_id AND r.empresa_id = public.get_user_empresa_id()));

DROP POLICY IF EXISTS "Usuarios podem deletar proprios comentarios de risco" ON public.riscos_comentarios;
CREATE POLICY "Usuarios podem deletar proprios comentarios de risco"
ON public.riscos_comentarios FOR DELETE TO authenticated
USING (auth.uid() = user_id);