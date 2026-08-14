CREATE TABLE public.controles_requisitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  controle_id uuid NOT NULL REFERENCES public.controles(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.gap_analysis_requirements(id) ON DELETE CASCADE,
  framework_id uuid NOT NULL REFERENCES public.gap_analysis_frameworks(id) ON DELETE CASCADE,
  tipo_cobertura text NOT NULL DEFAULT 'implementa',
  notas text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (controle_id, requirement_id)
);

CREATE INDEX idx_controles_requisitos_empresa ON public.controles_requisitos(empresa_id);
CREATE INDEX idx_controles_requisitos_req ON public.controles_requisitos(requirement_id);
CREATE INDEX idx_controles_requisitos_controle ON public.controles_requisitos(controle_id);
CREATE INDEX idx_controles_requisitos_framework ON public.controles_requisitos(framework_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.controles_requisitos TO authenticated;
GRANT ALL ON public.controles_requisitos TO service_role;

ALTER TABLE public.controles_requisitos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "controles_requisitos_select" ON public.controles_requisitos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "controles_requisitos_insert" ON public.controles_requisitos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "controles_requisitos_update" ON public.controles_requisitos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "controles_requisitos_delete" ON public.controles_requisitos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE TRIGGER set_controles_requisitos_updated_at
  BEFORE UPDATE ON public.controles_requisitos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.auditoria_itens
  ADD COLUMN IF NOT EXISTS requisito_vinculado_id uuid REFERENCES public.gap_analysis_requirements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS framework_vinculado_id uuid REFERENCES public.gap_analysis_frameworks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_auditoria_itens_requisito ON public.auditoria_itens(requisito_vinculado_id);