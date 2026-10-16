CREATE TABLE public.analise_aderencia_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL UNIQUE REFERENCES public.gap_analysis_adherence_assessments(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'processando',
  etapa text NOT NULL DEFAULT 'lendo',
  trechos jsonb NOT NULL DEFAULT '[]',
  resumos jsonb NOT NULL DEFAULT '[]',
  lotes jsonb NOT NULL DEFAULT '[]',
  resultados jsonb NOT NULL DEFAULT '[]',
  contexto jsonb NOT NULL DEFAULT '{}',
  progresso int NOT NULL DEFAULT 0,
  total int NOT NULL DEFAULT 0,
  erro text,
  saltos_restantes int NOT NULL DEFAULT 500,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.analise_aderencia_jobs TO authenticated;
GRANT ALL ON public.analise_aderencia_jobs TO service_role;
ALTER TABLE public.analise_aderencia_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros leem jobs da propria empresa" ON public.analise_aderencia_jobs
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid() AND p.ativo = true));
CREATE INDEX idx_aderencia_jobs_empresa ON public.analise_aderencia_jobs(empresa_id);