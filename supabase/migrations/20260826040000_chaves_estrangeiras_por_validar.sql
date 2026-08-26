-- As chaves estrangeiras que nunca foram validadas.
--
-- ## O que se mediu
--
-- Dezoito restrições do esquema `public` estão `NOT VALID`. Seis delas são
-- CHAVES ESTRANGEIRAS, e uma chave estrangeira `NOT VALID` faz metade do
-- trabalho: barra o que entrar de novo, e deixa em paz o que já lá estava.
--
-- Na base de desenvolvimento estavam lá **onze órfãos**:
--
--   contrato_aditivos  -> contratos    10
--   contrato_marcos    -> contratos     1
--   contrato_documentos, contratos->empresas,
--   contratos->fornecedores, dd_assessments->fornecedores   0
--
-- Dez aditivos e um marco apontam para contratos que já não existem. Foi
-- assim que apareceu um aditivo de PRAZO com início 20/08 e fim 10/08 sem
-- contrato nenhum por trás: nenhum ecrã lá chega, ninguém o vê, e continua a
-- contar em qualquer consulta que não faça `join`.
--
-- ## O que esta migração faz, e o que NÃO faz
--
-- Valida as que estiverem limpas — e só essas. Uma chave validada passa a
-- valer para o passado também, e a `ON DELETE CASCADE` que já lá está trata
-- do resto daqui para a frente.
--
-- NÃO apaga órfãos. Um aditivo contratual pode ser prova documental, e apagar
-- prova não é decisão de uma migração. Onde houver, avisa e deixa como está —
-- com a consulta pronta para quem quiser olhar.
--
-- E é condicional em vez de directa porque não se sabe o que há nas bases dos
-- clientes: um `VALIDATE CONSTRAINT` directo rebentaria a migração inteira na
-- primeira que tivesse um órfão.

DO $$
DECLARE
  r record;
  v_orfaos bigint;
  v_sql text;
  v_validadas integer := 0;
  v_adiadas integer := 0;
BEGIN
  FOR r IN
    SELECT
      c.conname,
      c.conrelid::regclass::text AS filha,
      c.confrelid::regclass::text AS mae,
      (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
         FROM unnest(c.conkey) WITH ORDINALITY AS k(att, ord)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.att) AS col_filha,
      (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
         FROM unnest(c.confkey) WITH ORDINALITY AS k(att, ord)
         JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.att) AS col_mae
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND NOT c.convalidated
      AND c.connamespace = 'public'::regnamespace
    ORDER BY 1
  LOOP
    -- Quantas linhas violariam a chave se ela fosse validada agora?
    v_sql := format(
      'SELECT count(*) FROM %s f WHERE (%s) IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %s m WHERE (m.%s) = (f.%s))',
      r.filha, r.col_filha, r.mae, r.col_mae, r.col_filha);
    EXECUTE v_sql INTO v_orfaos;

    IF v_orfaos = 0 THEN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', r.filha, r.conname);
      v_validadas := v_validadas + 1;
      RAISE NOTICE 'validada: %.% -> %', r.filha, r.col_filha, r.mae;
    ELSE
      v_adiadas := v_adiadas + 1;
      RAISE WARNING
        '% linha(s) órfã(s) em %.% -> %. A chave fica NOT VALID. Para ver quais: SELECT * FROM % f WHERE NOT EXISTS (SELECT 1 FROM % m WHERE m.% = f.%);',
        v_orfaos, r.filha, r.col_filha, r.mae, r.filha, r.mae, r.col_mae, r.col_filha;
    END IF;
  END LOOP;

  RAISE NOTICE '% chave(s) validada(s), % adiada(s) por terem órfãos.', v_validadas, v_adiadas;
END $$;
