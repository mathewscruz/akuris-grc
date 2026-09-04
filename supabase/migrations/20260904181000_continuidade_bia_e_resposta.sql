-- Completa o plano de continuidade com a preparação operacional necessária
-- para sair de uma lista de tarefas e formar um BIA + plano de resposta.
ALTER TABLE public.continuidade_planos
  ADD COLUMN IF NOT EXISTS processos_criticos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipe_crise jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS criterios_ativacao text,
  ADD COLUMN IF NOT EXISTS estrategia_recuperacao text,
  ADD COLUMN IF NOT EXISTS plano_comunicacao text,
  ADD COLUMN IF NOT EXISTS runbook text,
  ADD COLUMN IF NOT EXISTS bia_revisada_em timestamptz;

ALTER TABLE public.continuidade_planos
  DROP CONSTRAINT IF EXISTS continuidade_processos_array,
  ADD CONSTRAINT continuidade_processos_array CHECK (jsonb_typeof(processos_criticos) = 'array'),
  DROP CONSTRAINT IF EXISTS continuidade_equipe_array,
  ADD CONSTRAINT continuidade_equipe_array CHECK (jsonb_typeof(equipe_crise) = 'array');

COMMENT ON COLUMN public.continuidade_planos.processos_criticos IS
  'BIA operacional: processo, impacto, MTPD, RTO, RPO, dependências e operação mínima.';
COMMENT ON COLUMN public.continuidade_planos.equipe_crise IS
  'Equipe acionável de crise com papel, contato e substituto.';
