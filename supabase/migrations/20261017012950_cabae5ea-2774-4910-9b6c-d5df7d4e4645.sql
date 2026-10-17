CREATE TABLE public.gap_evidencia_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.gap_analysis_requirements(id) ON DELETE CASCADE,
  item_index integer NOT NULL,
  item_texto text NOT NULL,
  marcado boolean NOT NULL DEFAULT false,
  nota text,
  prova_nome text,
  ia_status text,
  ia_trecho text,
  ia_motivo text,
  ia_fonte text,
  ia_assinatura text,
  ia_em timestamptz,
  marcado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, requirement_id, item_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gap_evidencia_itens TO authenticated;
GRANT ALL ON public.gap_evidencia_itens TO service_role;
ALTER TABLE public.gap_evidencia_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gap_evid_itens_empresa" ON public.gap_evidencia_itens FOR ALL TO authenticated
  USING (empresa_id = (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK (empresa_id = (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE TRIGGER trg_gap_evid_itens_upd BEFORE UPDATE ON public.gap_evidencia_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_gap_evid_itens_req ON public.gap_evidencia_itens(empresa_id, requirement_id);