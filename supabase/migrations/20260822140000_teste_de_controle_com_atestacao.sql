-- O teste do controlo passa a ser atestado por outra pessoa.
--
-- ## Porque isto faltava, e porque importa
--
-- `controles_testes` guarda data, resultado, observações, evidência e quem
-- testou. Falta a metade que faz do registo uma prova: **alguém que ateste**.
--
-- Auditoria interna vive de uma regra simples — quem executa não pode ser quem
-- valida. Sem um segundo par de olhos, o que existe é a palavra de uma pessoa
-- de que o controlo funciona, e é exactamente isso que um auditor externo não
-- aceita. É também o que o cliente pediu: «validar e efetivar se o controle
-- realmente foi atendido para demonstrar isso em futuras auditorias».
--
-- O estado do teste passa a ser explícito:
--
--   rascunho  → quem testou ainda está a trabalhar nele
--   submetido → pronto, à espera de quem ateste
--   atestado  → outra pessoa confirmou; é isto que vai ao relatório
--   devolvido → quem revê pediu mais alguma coisa, com o motivo escrito
--
-- Um teste `atestado` fecha-se: mexer nele obriga a passar por `devolvido`,
-- que deixa rasto. Sem isso, «atestado» seria um carimbo que se pode reescrever
-- depois de dado — que não é carimbo nenhum.

ALTER TABLE public.controles_testes
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS submetido_em timestamptz,
  ADD COLUMN IF NOT EXISTS atestado_por uuid,
  ADD COLUMN IF NOT EXISTS atestado_em timestamptz,
  ADD COLUMN IF NOT EXISTS parecer_atestacao text,
  /*
    Desenho e operação são duas perguntas, não uma.

    Um controlo pode estar bem desenhado e não ser executado, ou ser executado
    à risca e não cobrir o risco. O campo `resultado`, sozinho, obrigava a
    escolher qual das duas se estava a responder.
  */
  ADD COLUMN IF NOT EXISTS eficacia_desenho text,
  ADD COLUMN IF NOT EXISTS eficacia_operacional text,
  /* A amostra: um teste sem população nem excepções não se repete nem se audita. */
  ADD COLUMN IF NOT EXISTS amostra_total integer,
  ADD COLUMN IF NOT EXISTS amostra_excecoes integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'controles_testes_estado_check') THEN
    ALTER TABLE public.controles_testes ADD CONSTRAINT controles_testes_estado_check
      CHECK (estado IN ('rascunho', 'submetido', 'atestado', 'devolvido'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'controles_testes_eficacia_check') THEN
    ALTER TABLE public.controles_testes ADD CONSTRAINT controles_testes_eficacia_check
      CHECK (
        (eficacia_desenho IS NULL OR eficacia_desenho IN ('eficaz', 'deficiente', 'nao_avaliado'))
        AND (eficacia_operacional IS NULL OR eficacia_operacional IN ('eficaz', 'deficiente', 'nao_avaliado'))
      );
  END IF;

  /* A amostra tem de fazer sentido: não se encontram mais excepções do que
     itens testados. */
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'controles_testes_amostra_check') THEN
    ALTER TABLE public.controles_testes ADD CONSTRAINT controles_testes_amostra_check
      CHECK (
        amostra_total IS NULL OR amostra_excecoes IS NULL
        OR (amostra_total >= 0 AND amostra_excecoes >= 0 AND amostra_excecoes <= amostra_total)
      );
  END IF;

  /* Atestado exige atestador e data — as três coisas andam juntas. */
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'controles_testes_atestacao_completa') THEN
    ALTER TABLE public.controles_testes ADD CONSTRAINT controles_testes_atestacao_completa
      CHECK (
        estado <> 'atestado'
        OR (atestado_por IS NOT NULL AND atestado_em IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.controles_testes.estado IS
  'rascunho → submetido → atestado; ou devolvido, com motivo. Um teste só '
  'conta como prova depois de atestado por alguém que não o executou.';
COMMENT ON COLUMN public.controles_testes.atestado_por IS
  'Quem confirmou. Nunca pode ser quem executou o teste — é a segregação que '
  'faz do registo uma prova e não uma declaração.';

/*
  A regra que o CHECK não consegue exprimir.

  «Atestador ≠ executor» compara duas colunas E `auth.uid()`, o que sai fora do
  alcance de um CHECK. Fica em gatilho, que é onde se pode também recusar
  reescrever um teste já atestado.
*/
CREATE OR REPLACE FUNCTION public.tg_teste_controle_atestacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.estado = 'atestado' AND NEW.estado = 'atestado' THEN
    /* Deixa passar mudanças que não tocam no conteúdo do teste. */
    IF (NEW.resultado, NEW.observacoes, NEW.evidencias, NEW.eficacia_desenho,
        NEW.eficacia_operacional, NEW.amostra_total, NEW.amostra_excecoes)
       IS DISTINCT FROM
       (OLD.resultado, OLD.observacoes, OLD.evidencias, OLD.eficacia_desenho,
        OLD.eficacia_operacional, OLD.amostra_total, OLD.amostra_excecoes) THEN
      RAISE EXCEPTION
        'teste já atestado: para o alterar, devolva-o primeiro (estado = devolvido)'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.estado = 'atestado' THEN
    NEW.atestado_por := COALESCE(NEW.atestado_por, auth.uid());
    NEW.atestado_em := COALESCE(NEW.atestado_em, now());

    /*
      Quem executou não atesta.

      `testador_id` é quem fez o teste; `created_by` é quem o registou. Ambos
      contam como executor — registar o teste de outra pessoa e depois atestá-lo
      seria a mesma pessoa dos dois lados da mesa.
    */
    IF NEW.atestado_por IS NOT NULL
       AND (NEW.atestado_por = NEW.testador_id OR NEW.atestado_por = NEW.created_by) THEN
      RAISE EXCEPTION
        'quem executou o teste não pode atestá-lo — a atestação exige outra pessoa'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.estado = 'submetido' AND OLD.estado IS DISTINCT FROM 'submetido' THEN
    NEW.submetido_em := COALESCE(NEW.submetido_em, now());
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_teste_controle_atestacao ON public.controles_testes;
CREATE TRIGGER trg_teste_controle_atestacao
  BEFORE INSERT OR UPDATE ON public.controles_testes
  FOR EACH ROW EXECUTE FUNCTION public.tg_teste_controle_atestacao();

/*
  A eficácia do controlo, calculada de uma vez só.

  O ecrã mostrava «Sem dados» na efetividade porque cada sítio somava à sua
  maneira — e nenhum sabia o que contava. Conta aqui: só teste ATESTADO conta,
  e o mais recente de cada controlo é o que vale.
*/
CREATE OR REPLACE FUNCTION public.eficacia_dos_controles(p_empresa_id uuid)
RETURNS TABLE(
  controle_id uuid,
  ultimo_teste_id uuid,
  data_teste date,
  resultado text,
  eficacia_desenho text,
  eficacia_operacional text,
  amostra_total integer,
  amostra_excecoes integer,
  testador_id uuid,
  atestado_por uuid,
  atestado_em timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT DISTINCT ON (t.controle_id)
    t.controle_id, t.id, t.data_teste, t.resultado,
    t.eficacia_desenho, t.eficacia_operacional,
    t.amostra_total, t.amostra_excecoes,
    t.testador_id, t.atestado_por, t.atestado_em
  FROM public.controles_testes t
  JOIN public.controles c ON c.id = t.controle_id
  WHERE c.empresa_id = p_empresa_id
    AND t.estado = 'atestado'
  ORDER BY t.controle_id, t.data_teste DESC, t.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.eficacia_dos_controles(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_teste_controle_atestacao') THEN
    RAISE EXCEPTION 'controlos: a atestação ficou sem gatilho';
  END IF;
  RAISE NOTICE 'controlos: o teste passa a exigir quem o ateste';
END $$;
