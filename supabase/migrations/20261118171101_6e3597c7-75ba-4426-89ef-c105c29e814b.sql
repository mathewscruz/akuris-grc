CREATE TABLE public.projeto_automacao_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  automacao_id uuid NOT NULL REFERENCES public.projeto_automacoes(id) ON DELETE CASCADE,
  tarefa_id uuid,
  tarefa_titulo text,
  resultado text NOT NULL DEFAULT 'sucesso',
  acoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_proj_aut_exec_automacao ON public.projeto_automacao_execucoes (automacao_id, created_at DESC);
GRANT SELECT ON public.projeto_automacao_execucoes TO authenticated;
GRANT ALL ON public.projeto_automacao_execucoes TO service_role;
ALTER TABLE public.projeto_automacao_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Require valid MFA session" ON public.projeto_automacao_execucoes AS RESTRICTIVE FOR ALL TO authenticated USING (has_valid_mfa_session());
CREATE POLICY projeto_automacao_execucoes_select ON public.projeto_automacao_execucoes FOR SELECT TO authenticated
USING (
  empresa_id = (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
       OR EXISTS (SELECT 1 FROM public.projeto_membros pm WHERE pm.projeto_id = projeto_automacao_execucoes.projeto_id AND pm.user_id = auth.uid()))
);
ALTER TABLE public.projeto_tarefas ADD COLUMN IF NOT EXISTS automacao_prazo_disparada_em timestamptz;