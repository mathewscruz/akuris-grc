-- Duas funcionalidades que fingiam funcionar passam a ter onde gravar.
--
-- ## 1. Templates de contrato
--
-- O ecrã de templates mostrava três modelos com cláusulas jurídicas, SLA e
-- penalidades — todos literais no código («como não temos tabela de templates
-- ainda, vamos simular com dados locais»). Criar e apagar mostravam um toast
-- verde e não gravavam nada: o template criado desaparecia ao reabrir, o
-- apagado voltava. E havia um botão que exportava o JSON fictício.
--
-- Num produto de compliance isto é pior do que uma funcionalidade em falta: a
-- pessoa acredita que tem um modelo aprovado e não tem.
--
-- ## 2. Lembrete de expiração de due diligence
--
-- O painel de automações tinha um interruptor «Lembrete de Expiração» com
-- `defaultChecked` — aparecia LIGADO de origem. A empresa acreditava receber
-- aviso antes de uma avaliação de fornecedor expirar. Não recebia: o
-- interruptor não tinha estado nem gravava nada.
--
-- A função `process-due-diligence-reminders` existe e funciona; faltava-lhe
-- quem a chamasse e uma definição que dissesse se a empresa a quer.

-- ── Templates de contrato ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contratos_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'servicos',
  descricao text NOT NULL DEFAULT '',
  objeto_padrao text NOT NULL DEFAULT '',
  clausulas_padrao text NOT NULL DEFAULT '',
  sla_padrao text,
  penalidades_padrao text,
  prazo_pagamento_padrao integer,
  valor_estimado numeric,
  -- Lista de campos que quem usa o template tem de preencher.
  campos_obrigatorios text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_templates_empresa
  ON public.contratos_templates(empresa_id);

-- Dois templates não podem ter o mesmo nome dentro da mesma empresa: era assim
-- que nasciam duplicados sem ninguém dar por isso.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contratos_templates_nome_por_empresa
  ON public.contratos_templates(empresa_id, lower(btrim(nome)));

ALTER TABLE public.contratos_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates de contrato da propria empresa" ON public.contratos_templates;
CREATE POLICY "templates de contrato da propria empresa"
  ON public.contratos_templates
  FOR ALL
  TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP TRIGGER IF EXISTS trg_contratos_templates_updated_at ON public.contratos_templates;
CREATE TRIGGER trg_contratos_templates_updated_at
  BEFORE UPDATE ON public.contratos_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Lembrete de expiração de due diligence ─────────────────────────────────

ALTER TABLE public.empresa_reminder_settings
  ADD COLUMN IF NOT EXISTS due_diligence_expiracao_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS due_diligence_expiracao_dias integer NOT NULL DEFAULT 7;

COMMENT ON COLUMN public.empresa_reminder_settings.due_diligence_expiracao_ativo IS
  'Avisar por e-mail antes de uma avaliação de fornecedor expirar. Nasce DESLIGADO de propósito: o interruptor antigo aparecia ligado sem nunca enviar nada, e ligar por omissão repetiria a promessa falsa.';

COMMENT ON COLUMN public.empresa_reminder_settings.due_diligence_expiracao_dias IS
  'Quantos dias antes da expiração avisar.';

DO $$
BEGIN
  RAISE NOTICE 'contratos_templates criada; lembrete de due diligence passa a ter definição (desligado por omissão)';
END $$;
