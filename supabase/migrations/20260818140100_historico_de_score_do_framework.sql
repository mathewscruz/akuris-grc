-- O histórico de score passa a existir de facto.
--
-- `gap_analysis_score_history` estava criada, com RLS, com hook de leitura e com
-- três telas a consumi-la — a aba Histórico, o gráfico de evolução e o "Δ 30D"
-- do card de conformidade. Só que **nada nunca a escrevia**: nem o aplicativo,
-- nem trigger, nem edge function. Confirmado por varredura no código e por
-- `pg_proc`. O resultado é que a aba Histórico dizia "avalie alguns requisitos
-- para começar a registrar a evolução do seu score" e isso jamais acontecia,
-- por mais requisitos que se avaliasse.
--
-- A escrita fica no banco, e não no aplicativo, de propósito: a avaliação de um
-- requisito é alterada de vários pontos (diálogo de triagem, ação em massa no
-- SoA, importação, edge function de diagnóstico). Registrar no cliente daria
-- histórico com buracos conforme o caminho usado.
--
-- O score gravado é o mesmo que a interface mostra, e é a única definição:
-- média ponderada pelo peso, `conforme` = 100 e `parcial` = 50, restrita aos
-- requisitos dentro do escopo da Declaração de Aplicabilidade.

BEGIN;

CREATE OR REPLACE FUNCTION public.gap_calcula_score_framework(
  p_framework_id uuid,
  p_empresa_id uuid
)
RETURNS TABLE (score numeric, total_requisitos integer, avaliados integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH no_escopo AS (
    SELECT
      r.id,
      COALESCE(r.peso, 1) AS peso,
      COALESCE(e.conformity_status, 'nao_avaliado') AS estado
    FROM gap_analysis_requirements r
    LEFT JOIN gap_analysis_evaluations e
      ON e.requirement_id = r.id
     AND e.empresa_id = p_empresa_id
    LEFT JOIN gap_analysis_soa s
      ON s.requirement_id = r.id
     AND s.empresa_id = p_empresa_id
    WHERE r.framework_id = p_framework_id
      -- Fora do escopo pelo SoA não é lacuna: sai da conta inteira.
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
$$;

COMMENT ON FUNCTION public.gap_calcula_score_framework IS
  'Score de aderência do framework: média ponderada pelo peso, restrita ao escopo do SoA. Mesma definição de src/lib/gap-score.ts.';

-- Um ponto por dia por framework: o gráfico é de evolução, não de auditoria.
-- Sem isto, uma sessão de triagem de trinta requisitos deixaria trinta pontos
-- no mesmo dia e achataria a linha.
--
-- E é isso que já está gravado. Num ensaio contra uma cópia da base real,
-- este índice recusou-se a nascer:
--
--   ERROR: could not create unique index "gap_score_history_um_por_dia"
--   DETAIL: Key (framework_id, empresa_id, ...2025-11-25) is duplicated.
--
-- 175 linhas para 9 dias distintos — o score era gravado a cada alteração de
-- requisito, com registos separados por segundos e o mesmo valor. A limpeza
-- guarda o ÚLTIMO de cada dia: é o valor com que o dia fechou, e é o que o
-- gráfico de evolução deve mostrar.
DELETE FROM gap_analysis_score_history h
 WHERE EXISTS (
   SELECT 1 FROM gap_analysis_score_history mais_recente
    WHERE mais_recente.framework_id = h.framework_id
      AND mais_recente.empresa_id  = h.empresa_id
      AND (mais_recente.recorded_at AT TIME ZONE 'UTC')::date
          = (h.recorded_at AT TIME ZONE 'UTC')::date
      AND (mais_recente.recorded_at, mais_recente.id) > (h.recorded_at, h.id)
 );

CREATE UNIQUE INDEX IF NOT EXISTS gap_score_history_um_por_dia
  -- O cast direto para date depende do fuso da sessão e o Postgres recusa-o
  -- num índice. Ancorado em UTC ele é imutável, e o dia passa a ser o mesmo
  -- para qualquer cliente.
  ON gap_analysis_score_history (framework_id, empresa_id, ((recorded_at AT TIME ZONE 'UTC')::date));

CREATE OR REPLACE FUNCTION public.gap_registra_score_do_dia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_framework_id uuid;
  v_empresa_id uuid;
  v_score numeric;
  v_total integer;
  v_avaliados integer;
BEGIN
  v_framework_id := COALESCE(NEW.framework_id, OLD.framework_id);
  v_empresa_id := COALESCE(NEW.empresa_id, OLD.empresa_id);

  IF v_framework_id IS NULL OR v_empresa_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT s.score, s.total_requisitos, s.avaliados
    INTO v_score, v_total, v_avaliados
    FROM public.gap_calcula_score_framework(v_framework_id, v_empresa_id) s;

  INSERT INTO gap_analysis_score_history
    (framework_id, empresa_id, score, total_requirements, evaluated_requirements, recorded_at)
  VALUES
    (v_framework_id, v_empresa_id, v_score, v_total, v_avaliados, now())
  ON CONFLICT (framework_id, empresa_id, ((recorded_at AT TIME ZONE 'UTC')::date))
  DO UPDATE SET
    score = EXCLUDED.score,
    total_requirements = EXCLUDED.total_requirements,
    evaluated_requirements = EXCLUDED.evaluated_requirements,
    recorded_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_gap_registra_score ON gap_analysis_evaluations;
CREATE TRIGGER trg_gap_registra_score
  AFTER INSERT OR UPDATE OF conformity_status OR DELETE
  ON gap_analysis_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.gap_registra_score_do_dia();

-- A Declaração de Aplicabilidade também move o score: tirar um requisito do
-- escopo muda o denominador.
DROP TRIGGER IF EXISTS trg_gap_registra_score_soa ON gap_analysis_soa;
CREATE TRIGGER trg_gap_registra_score_soa
  AFTER INSERT OR UPDATE OF aplicavel OR DELETE
  ON gap_analysis_soa
  FOR EACH ROW
  EXECUTE FUNCTION public.gap_registra_score_do_dia();

-- Ponto inicial para quem já tem avaliação feita, senão a linha começa vazia
-- para toda a base existente.
INSERT INTO gap_analysis_score_history
  (framework_id, empresa_id, score, total_requirements, evaluated_requirements, recorded_at)
SELECT DISTINCT ON (e.framework_id, e.empresa_id)
  e.framework_id, e.empresa_id, s.score, s.total_requisitos, s.avaliados, now()
FROM gap_analysis_evaluations e
CROSS JOIN LATERAL public.gap_calcula_score_framework(e.framework_id, e.empresa_id) s
WHERE e.framework_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
