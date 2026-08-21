-- O painel deixa de ter botão de atualizar, e por isso tem de se atualizar
-- sozinho.
--
-- O botão "atualizar" e o carimbo "Atualizado às HH:MM" saíram do cabeçalho.
-- Sem eles, um número mexido noutro módulo ficava velho no painel até alguém
-- recarregar a página — e o utilizador não tinha sequer como saber que estava
-- a olhar para um número velho.
--
-- A substituição é o Realtime do Postgres: o painel subscreve as tabelas de
-- onde saem os seus números e invalida as consultas afectadas. Só que nenhuma
-- tabela estava na publicação `supabase_realtime` — a subscrição ligava-se com
-- sucesso e nunca recebia um único evento. Uma actualização automática que
-- falha em silêncio é pior do que o botão que se tirou, portanto a publicação
-- é parte da mesma entrega.
--
-- Não se mexe em REPLICA IDENTITY: ao painel basta saber QUE algo mudou para
-- reconsultar; não lê o payload. `REPLICA IDENTITY FULL` faria o Postgres
-- escrever a linha inteira no WAL a cada UPDATE, e custa caro em tabelas
-- grandes por nenhum ganho aqui.
--
-- O RLS continua a valer: o Realtime entrega a cada subscritor apenas as
-- linhas que a sua política deixa ver.

DO $$
DECLARE
  -- As tabelas de onde saem os números do painel, e mais nenhuma. Publicar
  -- uma tabela que o painel não lê é tráfego para todos os separadores
  -- abertos, sem nada em troca.
  v_tabela text;
  v_tabelas text[] := ARRAY[
    'riscos',
    'riscos_historico_avaliacoes',
    'controles',
    'ativos',
    'incidentes',
    'documentos',
    'contratos',
    'denuncias',
    'planos_acao',
    'due_diligence_assessments',
    'gap_analysis_evaluations',
    'projeto_tarefas'
  ];
BEGIN
  -- Em bases criadas do zero a publicação pode ainda não existir.
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH v_tabela IN ARRAY v_tabelas LOOP
    -- Uma tabela que não exista nesta base não pode abortar a migration:
    -- há instalações sem todos os módulos.
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = v_tabela
    ) THEN
      RAISE NOTICE 'painel ao vivo: tabela %.% não existe, ignorada', 'public', v_tabela;
      CONTINUE;
    END IF;

    -- `ADD TABLE` numa tabela já publicada é erro, não é no-op.
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tabela
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tabela);
  END LOOP;
END $$;

-- Rede de segurança: se nada ficou publicado, o painel nasceria mudo.
DO $$
DECLARE
  v_n integer;
BEGIN
  SELECT count(*) INTO v_n
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND schemaname = 'public';

  IF v_n = 0 THEN
    RAISE EXCEPTION 'painel ao vivo: nenhuma tabela ficou publicada em supabase_realtime';
  END IF;

  RAISE NOTICE 'painel ao vivo: % tabelas publicadas em supabase_realtime', v_n;
END $$;
