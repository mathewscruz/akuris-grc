-- Preferências editoriais, descadastro e ciclo real de entrega de campanhas.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS receber_comunicados boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unsubscribe_token_uidx
  ON public.profiles(email_unsubscribe_token);

ALTER TABLE public.contact_form_submissions
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS company_size text;
ALTER TABLE public.contact_form_submissions ALTER COLUMN message DROP NOT NULL;

ALTER TABLE public.email_campanhas
  ADD COLUMN IF NOT EXISTS total_entregues integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_rejeitados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reclamacoes integer NOT NULL DEFAULT 0;

ALTER TABLE public.email_campanha_logs
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.email_campanha_logs
  DROP CONSTRAINT IF EXISTS email_campanha_logs_status_check;

-- A versao anterior registrava como `sent` tudo o que o provedor havia apenas
-- aceitado. Normalizamos os dados antes de aplicar o vocabulario de entrega.
UPDATE public.email_campanha_logs
SET status = 'accepted',
    accepted_at = COALESCE(accepted_at, created_at),
    updated_at = now()
WHERE status = 'sent';

ALTER TABLE public.email_campanha_logs
  ADD CONSTRAINT email_campanha_logs_status_check
  CHECK (status IN ('accepted','delivered','bounced','complained','failed','test_sent','test_failed'));

CREATE UNIQUE INDEX IF NOT EXISTS email_campanha_logs_idempotency_uidx
  ON public.email_campanha_logs(idempotency_key);
CREATE INDEX IF NOT EXISTS email_campanha_logs_provider_idx
  ON public.email_campanha_logs(provider_id)
  WHERE provider_id IS NOT NULL;

DROP POLICY IF EXISTS "Sistema pode inserir logs de campanha" ON public.email_campanha_logs;
REVOKE INSERT, UPDATE, DELETE ON public.email_campanha_logs FROM anon, authenticated;

COMMENT ON COLUMN public.email_campanhas.total_enviados IS
  'Mensagens aceitas pelo provedor; não significa entrega na caixa do destinatário.';
COMMENT ON COLUMN public.email_campanhas.total_entregues IS
  'Mensagens confirmadas como entregues pelo webhook do provedor.';
