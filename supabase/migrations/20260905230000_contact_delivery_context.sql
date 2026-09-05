-- Commercial requests stay private under existing super-admin RLS.
ALTER TABLE public.contact_form_submissions
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS request_hash text,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS interest text,
  ADD COLUMN IF NOT EXISTS plan_code text,
  ADD COLUMN IF NOT EXISTS source_path text,
  ADD COLUMN IF NOT EXISTS notification_provider_id text,
  ADD COLUMN IF NOT EXISTS notification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notification_error text;
CREATE UNIQUE INDEX IF NOT EXISTS contact_request_id_unique ON public.contact_form_submissions(request_id) WHERE request_id IS NOT NULL;
COMMENT ON COLUMN public.contact_form_submissions.status IS 'pending: registered, notification not completed; processed: provider accepted notification (not inbox delivery); failed: registered, notification failed. Never means the lead was lost.';
COMMENT ON COLUMN public.contact_form_submissions.notification_error IS 'Operational error code only. No provider payload or contact data.';
