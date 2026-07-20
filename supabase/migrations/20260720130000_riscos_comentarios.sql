-- Comentários / atividade em riscos (espelha controles_comentarios).
CREATE TABLE IF NOT EXISTS public.riscos_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risco_id UUID NOT NULL REFERENCES public.riscos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comentario TEXT NOT NULL,
  mencoes UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_riscos_comentarios_risco ON public.riscos_comentarios(risco_id);
CREATE INDEX IF NOT EXISTS idx_riscos_comentarios_user ON public.riscos_comentarios(user_id);

ALTER TABLE public.riscos_comentarios ENABLE ROW LEVEL SECURITY;

-- Leitura: comentários de riscos da mesma empresa
CREATE POLICY "Usuarios podem ver comentarios de riscos da empresa"
ON public.riscos_comentarios
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.riscos r
    WHERE r.id = risco_id
    AND r.empresa_id = public.get_user_empresa_id()
  )
);

-- Inserção: apenas o próprio autor, em riscos da empresa
CREATE POLICY "Usuarios podem criar comentarios em riscos da empresa"
ON public.riscos_comentarios
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.riscos r
    WHERE r.id = risco_id
    AND r.empresa_id = public.get_user_empresa_id()
  )
);

-- Deleção: apenas o autor
CREATE POLICY "Usuarios podem deletar proprios comentarios de risco"
ON public.riscos_comentarios
FOR DELETE
USING (auth.uid() = user_id);
