-- Pré-voo das migrations pendentes contra uma base REAL.
--
-- Corre só SELECT. Não altera nada, não copia dados para fora: devolve
-- contagens. A intenção é responder, antes do push, à única pergunta que
-- importa — "isto quebra para algum cliente?".
--
-- Como correr (basta acesso de leitura):
--
--   psql "$URL_DE_PRODUCAO" -f scripts/pre-voo-migrations.sql
--
-- `bloqueia` = quantas linhas reais impedem a migration de aplicar. Zero em
-- todas = seguro para subir. `n/a` = o alvo ainda não existe nessa base, que é
-- o esperado para o que as próprias migrations criam.
--
-- Só entram aqui as restrições que VALIDAM DADOS EXISTENTES. As de Contratos e
-- a FK de Due Diligence são `NOT VALID` de propósito: aplicam-se apenas a
-- escritas novas e nunca falham no push, por isso não constam.
--
-- ---------------------------------------------------------------------------
-- Por que as verificações são DADOS e não SQL escrito à mão
-- ---------------------------------------------------------------------------
-- Metade delas fala de tabelas e colunas que as próprias migrations criam — e
-- que, por definição, ainda NÃO existem onde este script corre. Um
-- `WHERE to_regclass(...) IS NOT NULL` não chega: o Postgres resolve os nomes
-- das colunas ao ANALISAR a consulta, muito antes de avaliar o WHERE, e o
-- script inteiro rebenta na primeira tabela em falta. Guardando cada
-- verificação como texto e correndo-a com `EXECUTE`, só é analisada se o alvo
-- existir.

\pset format aligned
\pset border 2

-- Tudo numa transação: as tabelas temporárias são `ON COMMIT DROP` e o psql,
-- em autocommit, apagava-as logo a seguir a criá-las. E, sendo transação,
-- não fica resto nenhum na base mesmo que algo falhe a meio.
BEGIN;

CREATE TEMP TABLE pre_voo_defs (
  ordem     int,
  descricao text,
  consulta  text,
  migration text,
  -- `esquema.tabela` ou `esquema.tabela.coluna`. Guardar a COLUNA e nao so a
  -- tabela e necessario: metade das verificacoes fala de colunas que as
  -- proprias migrations acrescentam a tabelas que ja existem.
  exige     text[]
) ON COMMIT DROP;

CREATE TEMP TABLE pre_voo (
  ordem       int,
  verificacao text,
  bloqueia    bigint,
  migration   text
) ON COMMIT DROP;

INSERT INTO pre_voo_defs VALUES
-- ------------------------------------------------------------------ bloqueios
(1, 'controles: código repetido na mesma empresa',
 'SELECT count(*) FROM (SELECT empresa_id, codigo FROM public.controles
    WHERE codigo IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1) d',
 '20260817140100_codigo_sequencial_do_controle', ARRAY['public.controles']),

(2, 'evidence_library_links: mesmo ficheiro ligado 2x ao mesmo registo',
 'SELECT count(*) FROM (SELECT evidence_id, modulo, registro_id
    FROM public.evidence_library_links WHERE registro_id IS NOT NULL
    GROUP BY 1,2,3 HAVING count(*) > 1) d',
 '20260817140300_evidencia_de_controle_na_biblioteca', ARRAY['public.evidence_library_links']),

-- CHECK sem NOT VALID: valida TODAS as linhas ao aplicar. É a que tem maior
-- probabilidade de bloquear, porque o vocabulário anterior era livre.
(3, 'gap_analysis_evaluations: conformity_status fora do vocabulário',
 $q$SELECT count(*) FROM public.gap_analysis_evaluations
     WHERE conformity_status IS NOT NULL
       AND conformity_status NOT IN
           ('conforme','parcial','nao_conforme','nao_aplicavel','nao_avaliado')$q$,
 '20260818140000_estado_de_conformidade_com_vocabulario_unico',
 ARRAY['public.gap_analysis_evaluations']),

-- Esta verificacao NAO estava aqui na primeira versao, e foi o ensaio contra a
-- copia da base real que apanhou o problema — 175 linhas para 9 dias, e o
-- indice unico recusou-se a nascer. Ficou como lembrete de que o pre-voo e um
-- procurador barato: quem decide e aplicar as migrations sobre os dados.
(4, 'gap_analysis_score_history: mais de um score no mesmo dia (a migration limpa)',
 $q$SELECT count(*) FROM (
      SELECT framework_id, empresa_id, (recorded_at AT TIME ZONE 'UTC')::date
        FROM public.gap_analysis_score_history GROUP BY 1,2,3 HAVING count(*) > 1) d$q$,
 '20260818140100 — a migration deduplica, guarda o ultimo de cada dia',
 ARRAY['public.gap_analysis_score_history']),

(5, 'gap_analysis_marcos: mais de um marco em aberto por framework',
 'SELECT count(*) FROM (SELECT empresa_id, framework_id FROM public.gap_analysis_marcos
    WHERE concluido_em IS NULL GROUP BY 1,2 HAVING count(*) > 1) d',
 '20260819120000_marco_de_certificacao', ARRAY['public.gap_analysis_marcos']),

(6, 'evidence_library: periodicidade_meses fora de 1..120',
 'SELECT count(*) FROM public.evidence_library
   WHERE periodicidade_meses IS NOT NULL AND periodicidade_meses NOT BETWEEN 1 AND 120',
 '20260819130000_validade_da_evidencia',
 ARRAY['public.evidence_library.periodicidade_meses']),

-- ------------------------------------------- alterações intencionais de dados
(7, 'profiles: contas BR que passam de português de Portugal para pt-BR',
 $q$SELECT count(*) FROM public.profiles p JOIN public.empresas e ON e.id = p.empresa_id
     WHERE e.jurisdicao = 'BR' AND p.preferred_locale = 'pt'$q$,
 '20260817140000 — alteração intencional', ARRAY['public.profiles','public.empresas']),

(8, 'controles: linhas que vão receber código CTRL-#### gerado',
 'SELECT count(*) FROM public.controles WHERE codigo IS NULL',
 '20260817140100 — alteração intencional', ARRAY['public.controles']),

(9, 'due_diligence_assessments: avaliações que o backfill NÃO consegue ligar',
 $q$SELECT count(*) FROM public.due_diligence_assessments a
     WHERE NOT EXISTS (SELECT 1 FROM public.fornecedores f
                        WHERE f.empresa_id = a.empresa_id AND f.email IS NOT NULL
                          AND lower(btrim(f.email)) = lower(btrim(a.fornecedor_email)))$q$,
 '20260819161000 — fica NULL', ARRAY['public.due_diligence_assessments','public.fornecedores']),

(10, 'ropa_registros: sem base legal — não geram linha no backfill',
 $q$SELECT count(*) FROM public.ropa_registros
     WHERE base_legal IS NULL OR btrim(base_legal) = ''$q$,
 '20260819200000 — fica sem base', ARRAY['public.ropa_registros']),

-- ---------------------------------------------------------------- informativos
(11, 'due_diligence: políticas de escrita que já existem',
 $q$SELECT count(*) FROM pg_policies WHERE schemaname='public'
     AND tablename IN ('due_diligence_templates','due_diligence_questions')
     AND cmd IN ('INSERT','UPDATE','DELETE')$q$,
 '20260819160000 — informativo', ARRAY[]::text[]),

(12, 'criar_notificacao: função já existe',
 $q$SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='criar_notificacao'$q$,
 '20260819170000 — informativo', ARRAY[]::text[]),

(13, 'tabelas que já exigem segundo fator',
 $q$SELECT count(*) FROM pg_policies WHERE schemaname='public' AND permissive='RESTRICTIVE'
     AND (qual ILIKE '%has_valid_mfa_session%' OR with_check ILIKE '%has_valid_mfa_session%')$q$,
 '20260819180000 — informativo', ARRAY[]::text[]);

DO $$
DECLARE
  d      record;
  alvo   text;
  falta  boolean;
  total  bigint;
BEGIN
  FOR d IN SELECT * FROM pre_voo_defs ORDER BY ordem LOOP
    falta := false;
    FOREACH alvo IN ARRAY d.exige LOOP
      IF array_length(string_to_array(alvo, '.'), 1) = 3 THEN
        -- esquema.tabela.coluna
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = split_part(alvo, '.', 1)
             AND table_name   = split_part(alvo, '.', 2)
             AND column_name  = split_part(alvo, '.', 3)
        ) THEN falta := true; EXIT; END IF;
      ELSIF to_regclass(alvo) IS NULL THEN
        falta := true; EXIT;
      END IF;
    END LOOP;

    IF falta THEN
      INSERT INTO pre_voo VALUES (d.ordem, d.descricao, -1,
        d.migration || ' — alvo ainda não existe nesta base');
    ELSE
      EXECUTE d.consulta INTO total;
      INSERT INTO pre_voo VALUES (d.ordem, d.descricao, COALESCE(total, 0), d.migration);
    END IF;
  END LOOP;

  -- A coluna `status` de gap_analysis_evaluations vai ser APAGADA pela
  -- migration. Não bloqueia; interessa saber se leva informação consigo.
  IF to_regclass('public.gap_analysis_evaluations') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='gap_analysis_evaluations'
                    AND column_name='status') THEN
    EXECUTE $q$SELECT count(*) FROM public.gap_analysis_evaluations g
                WHERE to_jsonb(g)->>'status' IS NOT NULL
                  AND to_jsonb(g)->>'status' IS DISTINCT FROM g.conformity_status$q$ INTO total;
    INSERT INTO pre_voo VALUES (4,
      'gap_analysis_evaluations: coluna `status` (será APAGADA) diverge de conformity_status',
      total, '20260818140000 — perda de dados, não bloqueio');
  ELSE
    INSERT INTO pre_voo VALUES (4,
      'gap_analysis_evaluations: coluna `status` (será APAGADA) diverge de conformity_status',
      -1, '20260818140000 — coluna já não existe');
  END IF;
END $$;

SELECT verificacao,
       CASE WHEN bloqueia < 0 THEN 'n/a' ELSE bloqueia::text END AS bloqueia,
       migration
  FROM pre_voo
 ORDER BY (bloqueia > 0) DESC, ordem;

COMMIT;
