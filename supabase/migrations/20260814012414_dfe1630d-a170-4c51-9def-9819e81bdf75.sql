CREATE TABLE public.riscos_requisitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  risco_id uuid NOT NULL REFERENCES public.riscos(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.gap_analysis_requirements(id) ON DELETE CASCADE,
  framework_id uuid NOT NULL REFERENCES public.gap_analysis_frameworks(id) ON DELETE CASCADE,
  tipo_vinculacao text NOT NULL DEFAULT 'mitiga',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (risco_id, requirement_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.riscos_requisitos TO authenticated;
GRANT ALL ON public.riscos_requisitos TO service_role;

ALTER TABLE public.riscos_requisitos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa pode ver vinculos risco-requisito"
ON public.riscos_requisitos FOR SELECT TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Empresa pode criar vinculos risco-requisito"
ON public.riscos_requisitos FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Empresa pode atualizar vinculos risco-requisito"
ON public.riscos_requisitos FOR UPDATE TO authenticated
USING (empresa_id = public.get_user_empresa_id())
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Empresa pode apagar vinculos risco-requisito"
ON public.riscos_requisitos FOR DELETE TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE INDEX idx_riscos_requisitos_risco ON public.riscos_requisitos(risco_id);
CREATE INDEX idx_riscos_requisitos_req ON public.riscos_requisitos(requirement_id);
CREATE INDEX idx_riscos_requisitos_empresa ON public.riscos_requisitos(empresa_id);

CREATE TRIGGER trg_riscos_requisitos_updated_at
BEFORE UPDATE ON public.riscos_requisitos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.riscos ADD COLUMN IF NOT EXISTS mitigacao_snapshot jsonb;