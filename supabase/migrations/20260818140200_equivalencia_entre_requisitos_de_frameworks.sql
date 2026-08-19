-- Equivalência entre requisitos de frameworks diferentes.
--
-- É o que falta para o Akuris competir com Vanta e Drata no que elas vendem
-- como principal: avaliar ISO 27001 uma vez e ver o SOC 2 já meio preenchido.
-- Hoje cada framework é uma ilha — quem certifica ISO e depois começa NIST CSF
-- responde de novo às mesmas perguntas, com as mesmas evidências, para o mesmo
-- controlo. É o trabalho mais caro e mais desmotivante do processo.
--
-- A falta disto tinha inclusive produzido um defeito: a tela de recomendação
-- mostrava um "reuso estimado" que era `Math.random()`, porque não havia dado
-- nenhum com que calcular. Agora há.
--
-- Modelo: par ordenado com grau de relação. A consulta é feita nos dois
-- sentidos, portanto basta registrar cada par uma vez.
--
--   equivalente -- o mesmo controlo dito noutras palavras; herda o estado
--   parcial     -- cobre parte do requisito; herda no máximo 'parcial'
--
-- Não existe herança automática silenciosa: a proposta é registrada e a pessoa
-- aceita. Conformidade herdada sem revisão humana é conformidade que não se
-- sustenta numa auditoria.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gap_analysis_requirement_crosswalk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisito_a uuid NOT NULL REFERENCES gap_analysis_requirements(id) ON DELETE CASCADE,
  requisito_b uuid NOT NULL REFERENCES gap_analysis_requirements(id) ON DELETE CASCADE,
  relacao text NOT NULL DEFAULT 'equivalente',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crosswalk_relacao_check CHECK (relacao IN ('equivalente', 'parcial')),
  -- Um requisito não é equivalente a si próprio, e o par não se repete.
  CONSTRAINT crosswalk_sem_auto_referencia CHECK (requisito_a <> requisito_b)
);

-- Par sem direção: (A,B) e (B,A) são o mesmo vínculo.
CREATE UNIQUE INDEX IF NOT EXISTS crosswalk_par_unico
  ON public.gap_analysis_requirement_crosswalk (
    LEAST(requisito_a, requisito_b),
    GREATEST(requisito_a, requisito_b)
  );

CREATE INDEX IF NOT EXISTS crosswalk_por_a ON public.gap_analysis_requirement_crosswalk (requisito_a);
CREATE INDEX IF NOT EXISTS crosswalk_por_b ON public.gap_analysis_requirement_crosswalk (requisito_b);

COMMENT ON TABLE public.gap_analysis_requirement_crosswalk IS
  'Equivalência entre requisitos de frameworks distintos. Global (sem empresa_id), como os próprios requisitos.';

ALTER TABLE public.gap_analysis_requirement_crosswalk ENABLE ROW LEVEL SECURITY;

-- Catálogo global: qualquer utilizador autenticado lê; só o serviço escreve,
-- tal como acontece com `gap_analysis_requirements`.
DROP POLICY IF EXISTS crosswalk_leitura ON public.gap_analysis_requirement_crosswalk;
CREATE POLICY crosswalk_leitura
  ON public.gap_analysis_requirement_crosswalk
  FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Reuso real de um framework candidato, para a empresa
-- ---------------------------------------------------------------------------
-- Percentagem dos requisitos do framework alvo que já têm equivalente avaliado
-- noutro framework da empresa. É o número que a tela de recomendação mostra —
-- agora calculado, não sorteado.
CREATE OR REPLACE FUNCTION public.gap_reuso_do_framework(
  p_framework_alvo uuid,
  p_empresa_id uuid
)
RETURNS TABLE (requisitos integer, com_equivalente integer, percentagem integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH alvo AS (
    SELECT id FROM gap_analysis_requirements WHERE framework_id = p_framework_alvo
  ),
  cobertos AS (
    SELECT DISTINCT a.id
    FROM alvo a
    JOIN gap_analysis_requirement_crosswalk c
      ON c.requisito_a = a.id OR c.requisito_b = a.id
    JOIN gap_analysis_evaluations e
      ON e.requirement_id = CASE WHEN c.requisito_a = a.id THEN c.requisito_b ELSE c.requisito_a END
     AND e.empresa_id = p_empresa_id
     AND e.conformity_status IN ('conforme', 'parcial')
  )
  SELECT
    (SELECT COUNT(*)::integer FROM alvo),
    (SELECT COUNT(*)::integer FROM cobertos),
    CASE
      WHEN (SELECT COUNT(*) FROM alvo) = 0 THEN 0
      ELSE ROUND(
        (SELECT COUNT(*) FROM cobertos)::numeric * 100 / (SELECT COUNT(*) FROM alvo)
      )::integer
    END;
$$;

COMMENT ON FUNCTION public.gap_reuso_do_framework IS
  'Percentagem de requisitos do framework alvo com equivalente já avaliado noutro framework da empresa.';

-- ---------------------------------------------------------------------------
-- Propostas de herança para um framework
-- ---------------------------------------------------------------------------
-- Lista o que dá para aproveitar, com a origem, para a pessoa aceitar item a
-- item ou em massa. `parcial` nunca promove: um vínculo parcial só propõe
-- 'parcial', mesmo que a origem esteja conforme.
CREATE OR REPLACE FUNCTION public.gap_propostas_de_heranca(
  p_framework_alvo uuid,
  p_empresa_id uuid
)
RETURNS TABLE (
  requisito_id uuid,
  requisito_codigo text,
  requisito_titulo text,
  origem_id uuid,
  origem_codigo text,
  origem_framework text,
  origem_status text,
  relacao text,
  status_proposto text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (alvo.id)
    alvo.id,
    alvo.codigo,
    alvo.titulo,
    origem.id,
    origem.codigo,
    fw_origem.nome,
    e.conformity_status,
    c.relacao,
    CASE
      WHEN c.relacao = 'parcial' THEN 'parcial'
      ELSE e.conformity_status
    END
  FROM gap_analysis_requirements alvo
  JOIN gap_analysis_requirement_crosswalk c
    ON c.requisito_a = alvo.id OR c.requisito_b = alvo.id
  JOIN gap_analysis_requirements origem
    ON origem.id = CASE WHEN c.requisito_a = alvo.id THEN c.requisito_b ELSE c.requisito_a END
  JOIN gap_analysis_frameworks fw_origem
    ON fw_origem.id = origem.framework_id
  JOIN gap_analysis_evaluations e
    ON e.requirement_id = origem.id
   AND e.empresa_id = p_empresa_id
   AND e.conformity_status IN ('conforme', 'parcial')
  LEFT JOIN gap_analysis_evaluations ja
    ON ja.requirement_id = alvo.id
   AND ja.empresa_id = p_empresa_id
   AND ja.conformity_status IN ('conforme', 'parcial', 'nao_conforme')
  WHERE alvo.framework_id = p_framework_alvo
    -- Não propõe para o que a pessoa já decidiu.
    AND ja.id IS NULL
  -- Entre vários caminhos possíveis, o mais forte primeiro.
  ORDER BY alvo.id,
           CASE WHEN c.relacao = 'equivalente' THEN 0 ELSE 1 END,
           CASE WHEN e.conformity_status = 'conforme' THEN 0 ELSE 1 END;
$$;

COMMENT ON FUNCTION public.gap_propostas_de_heranca IS
  'Requisitos do framework alvo que podem herdar estado de um equivalente já avaliado. Não aplica nada: apenas propõe.';

COMMIT;
