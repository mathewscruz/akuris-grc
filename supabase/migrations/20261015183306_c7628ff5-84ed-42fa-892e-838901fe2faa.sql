CREATE TABLE public.email_acao_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  plano_id uuid NOT NULL,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_at timestamptz,
  acao_usada text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_acao_tokens TO service_role;
REVOKE ALL ON public.email_acao_tokens FROM anon, authenticated;
ALTER TABLE public.email_acao_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.email_acao_tokens (plano_id);