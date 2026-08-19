-- Um vocabulário só para o estado de conformidade de um requisito.
--
-- `gap_analysis_evaluations` carregava duas colunas para a mesma ideia:
--
--   status            -- com CHECK, usando 'parcialmente_conforme'
--   conformity_status -- SEM restrição nenhuma, usando 'parcial'
--
-- A interface só escreve e só lê a segunda. A primeira ficou de uma versão
-- anterior e ninguém a consulta — mas é ela que tem a validação, o que deixa a
-- coluna que o produto realmente usa aceitando qualquer string. Durante a
-- revisão deste módulo eu próprio gravei 'parcialmente_conforme' em
-- `conformity_status` por engano: o banco aceitou sem reclamar, o requisito
-- deixou de pontuar e o score do framework caiu de 58% para 38% sem erro
-- nenhum em lugar nenhum. Numa plataforma de conformidade, um score errado em
-- silêncio é o pior defeito possível.
--
-- Esta migration inverte a situação: a coluna em uso passa a ser validada, e a
-- que ninguém usa sai.

BEGIN;

-- 1. Normaliza o que porventura tenha entrado com o vocabulário da coluna antiga.
UPDATE gap_analysis_evaluations
   SET conformity_status = 'parcial'
 WHERE conformity_status = 'parcialmente_conforme';

UPDATE gap_analysis_evaluations
   SET conformity_status = 'nao_avaliado'
 WHERE conformity_status IS NULL
    OR conformity_status NOT IN ('conforme', 'parcial', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado');

-- 2. A coluna que o produto usa passa a ter a restrição.
ALTER TABLE gap_analysis_evaluations
  DROP CONSTRAINT IF EXISTS gap_analysis_evaluations_conformity_status_check;

ALTER TABLE gap_analysis_evaluations
  ADD CONSTRAINT gap_analysis_evaluations_conformity_status_check
  CHECK (conformity_status IN ('conforme', 'parcial', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'));

ALTER TABLE gap_analysis_evaluations
  ALTER COLUMN conformity_status SET DEFAULT 'nao_avaliado';

-- 3. A coluna duplicada sai. Nenhum ponto do código a lê ou escreve —
--    confirmado por varredura em `src/` e em `supabase/functions/`.
ALTER TABLE gap_analysis_evaluations DROP COLUMN IF EXISTS status;

COMMENT ON COLUMN gap_analysis_evaluations.conformity_status IS
  'Estado de conformidade do requisito. Vocabulário único do módulo: conforme, parcial, nao_conforme, nao_aplicavel, nao_avaliado.';

COMMIT;
