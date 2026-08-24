-- O acesso passa a saber de onde veio.
--
-- ## O que estava a acontecer
--
-- Em Revisão de Acessos, TODO o `sistemas_usuarios` era digitado à mão. Não há
-- importação, não há ligação a directório nenhum: alguém abre o Entra ID num
-- separador e copia nome a nome. Numa empresa de duzentas pessoas isso não se
-- faz uma vez por trimestre — faz-se uma vez, e nunca mais.
--
-- E o que se revê passa a ser a lista de há um ano, não quem tem acesso hoje.
-- Uma revisão de acessos sobre dados velhos é pior do que nenhuma: dá o carimbo
-- sem dar a garantia.
--
-- ## O que muda
--
-- Três colunas que dizem a proveniência de cada linha. `origem` NULL continua a
-- significar «alguém escreveu isto», que é o que todas as linhas existentes são.
--
-- Importa para lá do sincronismo: numa revisão, «este acesso veio do directório
-- esta manhã» e «este acesso foi escrito por alguém há catorze meses» merecem
-- confiança diferente, e até hoje eram indistinguíveis.

ALTER TABLE public.sistemas_usuarios
  /* De onde veio a linha: 'entra_id', 'google_workspace'… NULL = manual. */
  ADD COLUMN IF NOT EXISTS origem text,
  /*
    O identificador do lado de lá.

    Casar por e-mail seria o óbvio e está errado: o e-mail muda quando a pessoa
    casa, quando o domínio é migrado, quando o cargo muda o alias. O objecto no
    directório não muda — e é a diferença entre reconhecer a pessoa e criar-lhe
    uma segunda linha.
  */
  ADD COLUMN IF NOT EXISTS origem_id text,
  ADD COLUMN IF NOT EXISTS sincronizado_em timestamptz;

COMMENT ON COLUMN public.sistemas_usuarios.origem IS
  'De onde veio este acesso: entra_id, google_workspace, ou NULL para o que foi '
  'digitado. Numa revisão, dado do directório e dado escrito à mão não merecem '
  'a mesma confiança.';
COMMENT ON COLUMN public.sistemas_usuarios.origem_id IS
  'Identificador do objecto no directório de origem. Casa-se por aqui e não '
  'pelo e-mail, que muda.';

/*
  Unicidade só para o que é sincronizado.

  Um índice único sobre (sistema_id, email) partiria em qualquer base que já
  tenha duplicados manuais — e partir a migração de um cliente para arrumar
  dados que ele escolheu escrever assim seria decidir por ele. Parcial, só
  morde nas linhas que o sincronismo cria, onde duplicado é sempre defeito.
*/
CREATE UNIQUE INDEX IF NOT EXISTS uidx_sistemas_usuarios_origem
  ON public.sistemas_usuarios(sistema_id, origem, origem_id)
  WHERE origem IS NOT NULL AND origem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sistemas_usuarios_sincronizado
  ON public.sistemas_usuarios(empresa_id, sincronizado_em DESC)
  WHERE origem IS NOT NULL;

/*
  O sistema que representa o directório.

  Devolve o id, criando-o na primeira sincronização. Fica em função e não no
  código da borda porque tem de ser atómica: duas sincronizações a arrancar ao
  mesmo tempo criariam dois «Microsoft Entra ID» e dividiriam os utilizadores
  entre eles.
*/
CREATE OR REPLACE FUNCTION public.sistema_do_diretorio(
  p_empresa_id uuid,
  p_nome text,
  p_categoria text DEFAULT 'identidade'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
    FROM public.sistemas_privilegiados
   WHERE empresa_id = p_empresa_id AND nome_sistema = p_nome
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.sistemas_privilegiados
    (empresa_id, nome_sistema, tipo_sistema, criticidade, categoria, ativo, observacoes)
  VALUES (
    p_empresa_id, p_nome, 'identidade', 'critico', p_categoria, true,
    'Criado automaticamente na primeira sincronização com o diretório.'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $function$;

REVOKE ALL ON FUNCTION public.sistema_do_diretorio(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sistema_do_diretorio(uuid, text, text) FROM anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uidx_sistemas_usuarios_origem') THEN
    RAISE EXCEPTION 'acessos: o índice de proveniência não ficou criado';
  END IF;
  RAISE NOTICE 'acessos: cada linha passa a dizer de onde veio';
END $$;
