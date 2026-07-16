-- Onda 1.6+: Hardening de segurança
-- Adiciona signing_secret ao api_inbound_webhooks para permitir HMAC signature.

ALTER TABLE public.api_inbound_webhooks
  ADD COLUMN IF NOT EXISTS signing_secret text;

COMMENT ON COLUMN public.api_inbound_webhooks.signing_secret IS
  'Segredo compartilhado para validação HMAC-SHA256 do body (header X-Webhook-Signature=sha256=<hex>). Quando NULL, aceita sem assinatura (compat).';