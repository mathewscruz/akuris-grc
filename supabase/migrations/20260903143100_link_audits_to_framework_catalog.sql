-- Auditorias guardavam apenas um texto livre/fixo em `framework`. A ligação
-- por UUID permite rastrear o referencial real do catálogo sem quebrar
-- relatórios antigos que ainda leem o nome textual.
ALTER TABLE public.auditorias
  ADD COLUMN IF NOT EXISTS framework_id uuid
  REFERENCES public.gap_analysis_frameworks(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_auditorias_framework_id
  ON public.auditorias(framework_id)
  WHERE framework_id IS NOT NULL;

UPDATE public.auditorias AS a
SET framework_id = (
  SELECT f.id
  FROM public.gap_analysis_frameworks AS f
  WHERE lower(btrim(f.nome)) = lower(btrim(a.framework))
    AND (f.empresa_id IS NULL OR f.empresa_id = a.empresa_id)
  ORDER BY (f.empresa_id = a.empresa_id) DESC, f.is_template DESC
  LIMIT 1
)
WHERE a.framework_id IS NULL
  AND nullif(btrim(a.framework), '') IS NOT NULL;

COMMENT ON COLUMN public.auditorias.framework_id IS
  'Referencial do catálogo usado como escopo da auditoria; framework mantém o nome para compatibilidade.';
