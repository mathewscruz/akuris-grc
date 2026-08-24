-- A diligência do fornecedor passa a ter fonte, e data.
--
-- ## O que estava a acontecer
--
-- `fornecedores.cnpj` era texto livre. Ninguém validava o dígito, ninguém
-- conferia se a empresa existia, e a razão social era o que a pessoa escreveu.
-- Uma diligência que começa por dados não verificados não é diligência.
--
-- Pior: não havia como responder à pergunta que a auditoria faz — «quando é
-- que verificaram, e o que é que viram nesse dia?». A resposta hoje seria
-- consultar de novo, que é responder a outra pergunta.
--
-- ## O que passa a existir
--
-- Uma FOTOGRAFIA datada do que a Receita respondeu. Não é cache: é prova. Por
-- isso guarda a data da consulta ao lado, e por isso nunca se apaga sozinha.
-- «A empresa está ativa» não é evidência de nada; «em 24/08/2026 estava ativa,
-- e aqui está o registo que se viu» é.

ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS dados_receita jsonb,
  ADD COLUMN IF NOT EXISTS receita_consultada_em timestamptz,
  /*
    Situação repetida fora do jsonb de propósito.

    A lista de fornecedores precisa de mostrar um selo por linha e de filtrar
    por «só os que não estão ativos». Fazer isso a abrir jsonb em cada linha
    torna a lista lenta e o filtro impossível de indexar.
  */
  ADD COLUMN IF NOT EXISTS receita_situacao text;

COMMENT ON COLUMN public.fornecedores.dados_receita IS
  'Fotografia do que a Receita respondeu na data da consulta: cadastro, quadro '
  'societário, sanções e alertas. É prova de diligência, não cache — não se '
  'reescreve sem repor receita_consultada_em.';
COMMENT ON COLUMN public.fornecedores.receita_consultada_em IS
  'Quando se consultou. Sem isto o snapshot não vale como evidência: a '
  'auditoria pergunta a data, não o conteúdo.';
COMMENT ON COLUMN public.fornecedores.receita_situacao IS
  'Situação cadastral do último snapshot (ATIVA, BAIXADA, SUSPENSA, INAPTA). '
  'Repetida fora do jsonb para a lista poder filtrar e mostrar selo.';

/* Só interessa indexar quem não está ativo — é a minoria, e é o que se procura. */
CREATE INDEX IF NOT EXISTS idx_fornecedores_receita_situacao
  ON public.fornecedores(empresa_id, receita_situacao)
  WHERE receita_situacao IS NOT NULL AND receita_situacao <> 'ATIVA';

/*
  Os dois andam sempre juntos.

  Um snapshot sem data é indistinguível de um snapshot de há três anos, e é
  exactamente a confusão que esta coluna existe para evitar.
*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fornecedores_receita_datada') THEN
    ALTER TABLE public.fornecedores ADD CONSTRAINT fornecedores_receita_datada
      CHECK (
        (dados_receita IS NULL AND receita_consultada_em IS NULL)
        OR (dados_receita IS NOT NULL AND receita_consultada_em IS NOT NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fornecedores'
      AND column_name = 'receita_consultada_em'
  ) THEN
    RAISE EXCEPTION 'due diligence: a consulta à Receita ficou sem data';
  END IF;
  RAISE NOTICE 'due diligence: o cadastro do fornecedor passa a ter fonte e data';
END $$;
