-- Um tratamento pode assentar em mais do que uma base legal.
--
-- `ropa_registros.base_legal` guardava UM valor. Na prática do RGPD e da LGPD,
-- uma operação de tratamento apoia-se com frequência em várias bases, cada uma
-- a legitimar uma parte diferente. O ROPA real de um cliente diz, no mesmo
-- processo:
--
--   Execução de contrato (Art. 7º, V) para comunicações obrigatórias;
--   Legítimo Interesse (Art. 7º, IX) para campanhas de relacionamento;
--   Cumprimento de obrigação legal (Art. 7º, II) para retenção fiscal.
--
-- Em cinco dos sete processos desse cliente há mais de uma base. Guardar só a
-- primeira e deitar fora as outras descaracteriza o registo perante um auditor
-- — e o registo existe precisamente para ser mostrado a um auditor.
--
-- ---------------------------------------------------------------------------
-- Uma fonte de verdade, não duas
-- ---------------------------------------------------------------------------
-- `ropa_registros.base_legal` NÃO desaparece: é lido pelo filtro da lista, pelo
-- gerador de PDF, pela busca global e pelo assistente. Passa a ser DERIVADO —
-- a base de `ordem` mais baixa — e mantido por gatilho. Quem escreve é sempre
-- `ropa_bases_legais`; a coluna antiga é uma projeção, com um único escritor.
--
-- É uma desnormalização deliberada. A alternativa (duas listas que se editam à
-- mão) é exatamente o padrão que já produziu divergência noutros módulos.

CREATE TABLE IF NOT EXISTS public.ropa_bases_legais (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ropa_id       uuid NOT NULL REFERENCES public.ropa_registros(id) ON DELETE CASCADE,
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  base_legal    text NOT NULL,
  -- Por que ESTA base legitima ESTA parte. Na planilha do cliente isto vinha
  -- misturado num parágrafo único; separado, cada base defende-se sozinha.
  justificativa text,
  -- Que parte da operação esta base cobre ("comunicações obrigatórias",
  -- "campanhas de relacionamento"). É o que torna a lista auditável.
  abrangencia   text,
  ordem         integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- A mesma base não se repete no mesmo tratamento: duas linhas "Consentimento"
-- no mesmo processo são erro de digitação, não duas bases.
CREATE UNIQUE INDEX IF NOT EXISTS ropa_base_legal_unica_por_registo
  ON public.ropa_bases_legais (ropa_id, base_legal);

CREATE INDEX IF NOT EXISTS ropa_bases_legais_por_registo
  ON public.ropa_bases_legais (ropa_id, ordem);

CREATE INDEX IF NOT EXISTS ropa_bases_legais_por_empresa
  ON public.ropa_bases_legais (empresa_id);

-- ---------------------------------------------------------------- RLS
-- Mesmo desenho das tabelas irmãs de ROPA: isolamento por empresa nas
-- permissivas, segundo fator na restritiva.
ALTER TABLE public.ropa_bases_legais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa vê as suas bases legais" ON public.ropa_bases_legais;
CREATE POLICY "Empresa vê as suas bases legais"
  ON public.ropa_bases_legais FOR SELECT
  USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "Empresa cria as suas bases legais" ON public.ropa_bases_legais;
CREATE POLICY "Empresa cria as suas bases legais"
  ON public.ropa_bases_legais FOR INSERT
  WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "Empresa altera as suas bases legais" ON public.ropa_bases_legais;
CREATE POLICY "Empresa altera as suas bases legais"
  ON public.ropa_bases_legais FOR UPDATE
  USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "Empresa apaga as suas bases legais" ON public.ropa_bases_legais;
CREATE POLICY "Empresa apaga as suas bases legais"
  ON public.ropa_bases_legais FOR DELETE
  USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "Require valid MFA session" ON public.ropa_bases_legais;
CREATE POLICY "Require valid MFA session"
  ON public.ropa_bases_legais AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_valid_mfa_session())
  WITH CHECK (public.has_valid_mfa_session());

-- ------------------------------------------------- projeção da base primária
CREATE OR REPLACE FUNCTION public.ropa_sincroniza_base_primaria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ropa uuid := COALESCE(NEW.ropa_id, OLD.ropa_id);
BEGIN
  UPDATE public.ropa_registros r
     SET base_legal = COALESCE(
           (SELECT b.base_legal FROM public.ropa_bases_legais b
             WHERE b.ropa_id = v_ropa
             ORDER BY b.ordem, b.created_at
             LIMIT 1),
           r.base_legal),
         justificativa_base_legal = COALESCE(
           (SELECT b.justificativa FROM public.ropa_bases_legais b
             WHERE b.ropa_id = v_ropa
             ORDER BY b.ordem, b.created_at
             LIMIT 1),
           r.justificativa_base_legal),
         updated_at = now()
   WHERE r.id = v_ropa;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ropa_bases_legais_sincroniza ON public.ropa_bases_legais;
CREATE TRIGGER ropa_bases_legais_sincroniza
  AFTER INSERT OR UPDATE OR DELETE ON public.ropa_bases_legais
  FOR EACH ROW EXECUTE FUNCTION public.ropa_sincroniza_base_primaria();

-- ---------------------------------------------------------------- backfill
-- Cada registo existente passa a ter a sua base atual como primeira da lista.
-- `ON CONFLICT DO NOTHING` para a migration poder correr de novo.
INSERT INTO public.ropa_bases_legais (ropa_id, empresa_id, base_legal, justificativa, ordem)
SELECT r.id, r.empresa_id, r.base_legal, r.justificativa_base_legal, 0
  FROM public.ropa_registros r
 WHERE r.base_legal IS NOT NULL AND btrim(r.base_legal) <> ''
ON CONFLICT (ropa_id, base_legal) DO NOTHING;

COMMENT ON TABLE public.ropa_bases_legais IS
  'Bases legais de um tratamento — uma linha por base. ropa_registros.base_legal é a projeção da de menor ordem, mantida por gatilho.';
COMMENT ON COLUMN public.ropa_bases_legais.abrangencia IS
  'Que parte da operação esta base legitima. É o que torna a lista auditável quando há várias.';
