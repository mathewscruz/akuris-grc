-- O padrão da coluna ficou fora do vocabulário que a própria restrição exige.
--
-- `20260821110000_escala_de_severidade_unica.sql` normalizou os VALORES das
-- nove colunas de severidade e pôs um CHECK em cada uma —
-- `baixo | medio | alto | critico`. Não tocou nos DEFAULTS.
--
-- Sete colunas continuaram com `DEFAULT 'media'`, o feminino antigo. O efeito
-- não é cosmético: **qualquer INSERT que não preencha a coluna falha**, porque
-- o padrão viola o CHECK. Descoberto ao testar o canal de denúncia público:
--
--   new row for relation "denuncias" violates check constraint
--   "denuncias_severidade_canonica"
--
-- Ou seja, desde que aquela migration subiu, **nenhuma denúncia pública pôde
-- ser registada** — a função de borda devolve 400 e a pessoa vê um erro
-- genérico. O mesmo vale para chaves, licenças, manutenções, achados de
-- auditoria, incidentes e sistemas privilegiados criados sem criticidade
-- explícita.
--
-- A lição, e a razão da verificação no fim: normalizar valores sem normalizar
-- os padrões deixa a tabela num estado onde o passado está certo e o futuro
-- não entra.

DO $$
DECLARE
  v_col record;
  v_ajustadas integer := 0;
BEGIN
  FOR v_col IN
    SELECT c.relname AS tabela,
           a.attname AS coluna,
           pg_get_expr(d.adbin, d.adrelid) AS padrao
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (con.conkey)
    JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE con.conname LIKE '%severidade_canonica%'
  LOOP
    /*
      Traduz o padrão antigo para o canónico. Só mexe no que está fora do
      vocabulário — um padrão já correcto não é reescrito.
    */
    IF v_col.padrao ~ '''(media|média|baixa|alta|critica|crítica)''' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %L',
        v_col.tabela,
        v_col.coluna,
        CASE
          WHEN v_col.padrao ~ '''(media|média)''' THEN 'medio'
          WHEN v_col.padrao ~ '''baixa''' THEN 'baixo'
          WHEN v_col.padrao ~ '''alta''' THEN 'alto'
          ELSE 'critico'
        END
      );
      v_ajustadas := v_ajustadas + 1;
      RAISE NOTICE 'padrão corrigido: %.% (era %)', v_col.tabela, v_col.coluna, v_col.padrao;
    END IF;
  END LOOP;

  RAISE NOTICE 'severidade: % padrões alinhados com a restrição', v_ajustadas;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- A guarda: nenhum padrão pode violar a própria restrição
-- ─────────────────────────────────────────────────────────────────────────
/*
  Fica na migration e não num teste de front porque é uma propriedade do
  ESQUEMA: um teste em TypeScript não alcança o `pg_attrdef`. Qualquer
  migration futura que ponha um padrão fora do vocabulário falha aqui, em vez
  de falhar meses depois no primeiro INSERT de um cliente.
*/
DO $$
DECLARE
  v_col record;
  v_infratores text := '';
BEGIN
  FOR v_col IN
    SELECT c.relname AS tabela,
           a.attname AS coluna,
           pg_get_expr(d.adbin, d.adrelid) AS padrao
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (con.conkey)
    JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE con.conname LIKE '%severidade_canonica%'
  LOOP
    IF v_col.padrao !~ '''(baixo|medio|alto|critico)''' THEN
      v_infratores := v_infratores || format('%s.%s = %s; ', v_col.tabela, v_col.coluna, v_col.padrao);
    END IF;
  END LOOP;

  IF v_infratores <> '' THEN
    RAISE EXCEPTION 'severidade: padrão fora do vocabulário canónico em %', v_infratores;
  END IF;

  RAISE NOTICE 'severidade: todos os padrões cabem na restrição';
END $$;
