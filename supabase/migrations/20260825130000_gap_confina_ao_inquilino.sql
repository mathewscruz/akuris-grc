-- As três funções de Gap Analysis deixam de confiar no `empresa_id` que recebem.
--
-- ## O mesmo buraco do eficacia_dos_controles, três vezes
--
-- `gap_calcula_score_framework`, `gap_reuso_do_framework` e
-- `gap_propostas_de_heranca` são `SECURITY DEFINER` — saltam o RLS — e filtram
-- os dados da empresa SÓ pelo parâmetro `p_empresa_id`, sem verificar que quem
-- chama pertence a ela.
--
-- Provado por impersonação: um utilizador da empresa B passou o `empresa_id`
-- da empresa A e leu:
--
--   · o score de conformidade da A num framework (6%);
--   · quantos requisitos tem e quantos reaproveita (61 / 3);
--   · TÍTULOS e CÓDIGOS de requisitos da A, via `gap_propostas_de_heranca`.
--
-- O último é o pior: não é agregado, é texto de negócio — o que a empresa
-- vizinha está a avaliar, requisito a requisito.
--
-- ## A correcção, mínima e sem mudar assinaturas
--
-- Uma função-guarda resolve o `empresa_id` efectivo a partir da SESSÃO. As três
-- passam a chamá-la em vez de usar o parâmetro cru: quem pede a própria empresa
-- (ou super_admin a pedir qualquer uma) continua igual; quem pede uma empresa
-- que não é a sua recebe zero linhas, como se não houvesse dados.
--
-- A assinatura de cada função fica intacta, por isso o front-end — que passa
-- sempre o empresa_id do próprio utilizador — não muda de comportamento.

/*
  O inquilino efectivo de um pedido de Gap.

  Devolve NULL quando o pedido é para uma empresa que não é a de quem chama —
  e um filtro `= NULL` não casa com nada, que é exactamente o silêncio que se
  quer. super_admin pode pedir qualquer uma.
*/
CREATE OR REPLACE FUNCTION public.gap_empresa_autorizada(p_empresa_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN public.is_super_admin() THEN p_empresa_id
    WHEN p_empresa_id = public.get_user_empresa_id() THEN p_empresa_id
    ELSE NULL
  END;
$function$;

REVOKE EXECUTE ON FUNCTION public.gap_empresa_autorizada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gap_empresa_autorizada(uuid) TO authenticated;

-- ─────────────────────────── score ───────────────────────────
CREATE OR REPLACE FUNCTION public.gap_calcula_score_framework(p_framework_id uuid, p_empresa_id uuid)
RETURNS TABLE(score numeric, total_requisitos integer, avaliados integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH quem AS (SELECT public.gap_empresa_autorizada(p_empresa_id) AS empresa_id),
  no_escopo AS (
    SELECT
      r.id,
      COALESCE(r.peso, 1) AS peso,
      COALESCE(e.conformity_status, 'nao_avaliado') AS estado
    FROM gap_analysis_requirements r
    LEFT JOIN gap_analysis_evaluations e
      ON e.requirement_id = r.id
     AND e.empresa_id = (SELECT empresa_id FROM quem)
    LEFT JOIN gap_analysis_soa s
      ON s.requirement_id = r.id
     AND s.empresa_id = (SELECT empresa_id FROM quem)
    WHERE r.framework_id = p_framework_id
      AND COALESCE(s.aplicavel, true) IS TRUE
      AND COALESCE(e.conformity_status, 'nao_avaliado') <> 'nao_aplicavel'
  )
  SELECT
    COALESCE(
      ROUND(
        SUM(
          CASE estado
            WHEN 'conforme' THEN 100
            WHEN 'parcial'  THEN 50
            ELSE 0
          END * peso
        ) / NULLIF(SUM(peso), 0)
      ),
      0
    )::numeric,
    (SELECT COUNT(*)::integer FROM gap_analysis_requirements WHERE framework_id = p_framework_id),
    COUNT(*) FILTER (WHERE estado IN ('conforme', 'parcial', 'nao_conforme'))::integer
  FROM no_escopo;
$function$;

-- ─────────────────────────── reuso ───────────────────────────
CREATE OR REPLACE FUNCTION public.gap_reuso_do_framework(p_framework_alvo uuid, p_empresa_id uuid)
RETURNS TABLE(requisitos integer, com_equivalente integer, percentagem integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH quem AS (SELECT public.gap_empresa_autorizada(p_empresa_id) AS empresa_id),
  alvo AS (
    SELECT id FROM gap_analysis_requirements WHERE framework_id = p_framework_alvo
  ),
  cobertos AS (
    SELECT DISTINCT a.id
    FROM alvo a
    JOIN gap_analysis_requirement_crosswalk c
      ON c.requisito_a = a.id OR c.requisito_b = a.id
    JOIN gap_analysis_evaluations e
      ON e.requirement_id = CASE WHEN c.requisito_a = a.id THEN c.requisito_b ELSE c.requisito_a END
     AND e.empresa_id = (SELECT empresa_id FROM quem)
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
$function$;

-- ────────────────────── propostas de herança ──────────────────────
CREATE OR REPLACE FUNCTION public.gap_propostas_de_heranca(p_framework_alvo uuid, p_empresa_id uuid)
RETURNS TABLE(requisito_id uuid, requisito_codigo text, requisito_titulo text, origem_id uuid, origem_codigo text, origem_framework text, origem_status text, relacao text, status_proposto text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH quem AS (SELECT public.gap_empresa_autorizada(p_empresa_id) AS empresa_id)
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
   AND e.empresa_id = (SELECT empresa_id FROM quem)
   AND e.conformity_status IN ('conforme', 'parcial')
  LEFT JOIN gap_analysis_evaluations ja
    ON ja.requirement_id = alvo.id
   AND ja.empresa_id = (SELECT empresa_id FROM quem)
   AND ja.conformity_status IN ('conforme', 'parcial', 'nao_conforme')
  WHERE alvo.framework_id = p_framework_alvo
    AND ja.id IS NULL
  ORDER BY alvo.id,
           CASE WHEN c.relacao = 'equivalente' THEN 0 ELSE 1 END,
           CASE WHEN e.conformity_status = 'conforme' THEN 0 ELSE 1 END;
$function$;

DO $$
BEGIN
  RAISE NOTICE 'gap: score, reuso e heranca passam a confinar-se ao inquilino da sessao';
END $$;
