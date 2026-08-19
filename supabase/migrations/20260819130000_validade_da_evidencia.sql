-- Evidência vence.
--
-- É a lacuna que separa o Akuris de Vanta e Drata, e não é de interface: no
-- modelo atual **nenhuma evidência tem prazo**. `evidence_library` guarda nome,
-- ficheiro, hash e etiquetas, e mais nada. Uma política revista há catorze
-- meses, um teste de restauração de backup do ano passado, um relatório de
-- pentest de 2024 — todos continuam a pintar o requisito de verde para sempre.
--
-- Numa auditoria de manutenção ISO 27001, ou numa renovação SOC 2, é
-- exatamente isso que reprova: o controlo existe, mas a prova de que ele
-- continua a operar caducou. O produto dizia "conforme" e o auditor dizia
-- "prove que ainda é".
--
-- Duas colunas, com papéis distintos:
--
--   valido_ate           -- data em que esta prova deixa de servir
--   periodicidade_meses  -- de quanto em quanto tempo ela tem de ser refeita,
--                           usado para propor a próxima data ao renovar
--
-- Nulo em ambas significa "sem prazo definido", que é o estado de tudo o que
-- já existe — não se inventa vencimento retroativo para a base instalada.

BEGIN;

ALTER TABLE public.evidence_library
  ADD COLUMN IF NOT EXISTS valido_ate date,
  ADD COLUMN IF NOT EXISTS periodicidade_meses integer;

ALTER TABLE public.evidence_library
  DROP CONSTRAINT IF EXISTS evidencia_periodicidade_valida;
ALTER TABLE public.evidence_library
  ADD CONSTRAINT evidencia_periodicidade_valida
  CHECK (periodicidade_meses IS NULL OR periodicidade_meses BETWEEN 1 AND 120);

COMMENT ON COLUMN public.evidence_library.valido_ate IS
  'Data em que a evidência deixa de comprovar o requisito. NULL = sem prazo definido.';
COMMENT ON COLUMN public.evidence_library.periodicidade_meses IS
  'De quantos em quantos meses a evidência tem de ser refeita. Serve para propor a próxima data de validade.';

-- A varredura de "o que vence nos próximos N dias" é a consulta que a tela do
-- módulo faz a cada carregamento, por empresa.
CREATE INDEX IF NOT EXISTS evidencia_por_validade
  ON public.evidence_library (empresa_id, valido_ate)
  WHERE valido_ate IS NOT NULL;

COMMIT;
