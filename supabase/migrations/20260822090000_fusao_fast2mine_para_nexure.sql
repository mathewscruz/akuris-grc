-- Fusão: os dados da Fast2Mine passam para dentro da Nexure.
--
-- Operação pontual, pedida para produção. Fica versionada porque é irreversível
-- e alguém vai querer saber, daqui a um ano, o que exactamente aconteceu.
--
-- ## O que se move, e o que não se move
--
-- Move o que é conteúdo de trabalho: riscos e tudo o que lhes está preso,
-- localizações de ativos, conversas do docgen, a pessoa, e o lugar dela no
-- comité de ética.
--
-- NÃO se move três coisas, e cada uma por uma razão:
--
--  · **`audit_logs` (47 linhas).** É o registo do que aconteceu NA FAST2MINE.
--    Reescrevê-lo para a Nexure faria a trilha de auditoria da Nexure afirmar
--    eventos que nunca ocorreram lá. Num produto de GRC isso não se faz — a
--    trilha fica com a empresa onde os factos se deram.
--
--  · **`denuncias_categorias` (9 linhas).** Todas as nove são duplicadas por
--    nome das que a Nexure já tem (Assédio, Fraude, Corrupção…). Movê-las daria
--    ao formulário público da Nexure dezoito categorias com nove nomes
--    repetidos na mesma lista.
--
--  · **`denuncias_configuracoes` (1 linha).** `UNIQUE (empresa_id)`, e a Nexure
--    tem a sua. Não há para onde ir.
--
-- ## Quatro colisões, e o que se fez a cada uma
--
--  1. `riscos_empresa_codigo_uidx` — ambas numeram R-0001, R-0002… Os quinze
--     riscos são renumerados na continuação da sequência da Nexure. O `id`
--     (uuid) não muda: é ele que a trilha e os anexos referenciam.
--  2. `riscos_matrizes_uma_ativa_por_empresa` — ambas têm matriz activa. A da
--     Fast2Mine entra como INACTIVA, para a escala original ficar consultável.
--  3. `riscos_matrizes_empresa_nome_uidx` — nomes diferentes, sem colisão.
--  4. `denuncias_comite_unico` — a Gleisa não está no comité da Nexure.
--
-- ## O efeito que não é colisão nenhuma e é o mais importante
--
-- `trg_risco_calcular` corre em BEFORE UPDATE e recalcula score, nível e
-- severidade a partir da matriz VIGENTE da empresa — e repõe `matriz_id`.
-- Ou seja: os quinze riscos passam a ser lidos na escala da Nexure.
--
-- Isso é o correcto, não um efeito secundário: uma carteira com duas escalas é
-- uma carteira que não se pode somar. Mas significa que um risco «Alto» na
-- Fast2Mine pode aparecer noutro nível na Nexure, e quem gere a carteira tem de
-- saber disso — daí o relatório em NOTICE no fim.

DO $$
DECLARE
  v_fast uuid;
  v_nexure uuid;
  v_proximo integer;
  r record;
  v_riscos integer := 0;
  v_mudaram integer := 0;
BEGIN
  SELECT id INTO v_fast FROM public.empresas WHERE lower(nome) = 'fast2mine';
  SELECT id INTO v_nexure FROM public.empresas WHERE lower(nome) = 'nexure';

  /* Numa base nova nenhuma das duas existe: a migração não tem nada que fazer
     e não pode falhar por isso. */
  IF v_fast IS NULL OR v_nexure IS NULL THEN
    RAISE NOTICE 'fusão: Fast2Mine e/ou Nexure não existem nesta base — nada a fazer';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.riscos WHERE empresa_id = v_fast) THEN
    RAISE NOTICE 'fusão: a Fast2Mine já não tem riscos — migração já aplicada';
    RETURN;
  END IF;

  -- Guarda o estado anterior para poder dizer o que mudou de nível.
  CREATE TEMP TABLE _antes_da_fusao ON COMMIT DROP AS
    SELECT id, codigo, nome, nivel_risco_inicial, nivel_risco_residual
    FROM public.riscos WHERE empresa_id = v_fast;

  -- ------------------------------------------------------------------
  -- 1. A matriz da Fast2Mine, desactivada
  -- ------------------------------------------------------------------
  UPDATE public.riscos_matrizes
  SET empresa_id = v_nexure, ativa = false
  WHERE empresa_id = v_fast;

  -- ------------------------------------------------------------------
  -- 2. Categorias de risco (sem colisão de nome)
  -- ------------------------------------------------------------------
  UPDATE public.riscos_categorias SET empresa_id = v_nexure WHERE empresa_id = v_fast;

  -- ------------------------------------------------------------------
  -- 3. Os riscos, renumerados
  -- ------------------------------------------------------------------
  /*
     Não se pode deixar o `riscos_set_codigo` tratar disto: ele calcula
     MAX(codigo)+1, e num UPDATE de várias linhas todas veriam o mesmo máximo
     — os quinze riscos ficariam com o mesmo código.
  */
  SELECT COALESCE(MAX((regexp_replace(codigo, '^\D*', ''))::integer), 0)
    INTO v_proximo
  FROM public.riscos
  WHERE empresa_id = v_nexure AND codigo ~ '^R-\d+$';

  FOR r IN
    SELECT id, codigo FROM public.riscos WHERE empresa_id = v_fast ORDER BY codigo
  LOOP
    v_proximo := v_proximo + 1;
    UPDATE public.riscos
    SET empresa_id = v_nexure,
        codigo = 'R-' || lpad(v_proximo::text, 4, '0')
    WHERE id = r.id;
    RAISE NOTICE 'fusão: risco % → %', r.codigo, 'R-' || lpad(v_proximo::text, 4, '0');
    v_riscos := v_riscos + 1;
  END LOOP;

  UPDATE public.riscos_historico_avaliacoes SET empresa_id = v_nexure WHERE empresa_id = v_fast;
  UPDATE public.riscos_anexos SET empresa_id = v_nexure WHERE empresa_id = v_fast;

  -- ------------------------------------------------------------------
  -- 4. O resto do conteúdo
  -- ------------------------------------------------------------------
  UPDATE public.ativos_localizacoes SET empresa_id = v_nexure WHERE empresa_id = v_fast;
  UPDATE public.docgen_conversations SET empresa_id = v_nexure WHERE empresa_id = v_fast;

  -- ------------------------------------------------------------------
  -- 5. A pessoa, e o lugar dela no comité
  -- ------------------------------------------------------------------
  /* Mantém o papel de administradora, por decisão de quem pediu a fusão. */
  UPDATE public.profiles SET empresa_id = v_nexure WHERE empresa_id = v_fast;
  UPDATE public.denuncias_comite SET empresa_id = v_nexure WHERE empresa_id = v_fast;

  -- ------------------------------------------------------------------
  -- 6. A Fast2Mine sai de serviço, mas não deixa de existir
  -- ------------------------------------------------------------------
  /*
     Desactivar e não apagar: o slug `fast2mine` continua tomado — um cartaz
     impresso com o QR do canal deixa de aceitar denúncias em vez de passar a
     apontar para a empresa seguinte que escolher esse nome — e os 47
     `audit_logs` continuam presos a uma empresa que existe.
  */
  UPDATE public.empresas SET ativo = false WHERE id = v_fast;
  UPDATE public.denuncias_configuracoes SET ativo = false WHERE empresa_id = v_fast;

  -- ------------------------------------------------------------------
  -- 7. O que a mudança de escala fez aos níveis
  -- ------------------------------------------------------------------
  SELECT count(*) INTO v_mudaram
  FROM _antes_da_fusao a
  JOIN public.riscos d ON d.id = a.id
  WHERE a.nivel_risco_residual IS DISTINCT FROM d.nivel_risco_residual
     OR a.nivel_risco_inicial IS DISTINCT FROM d.nivel_risco_inicial;

  FOR r IN
    SELECT a.codigo, a.nome, a.nivel_risco_residual AS antes, d.nivel_risco_residual AS depois
    FROM _antes_da_fusao a JOIN public.riscos d ON d.id = a.id
    WHERE a.nivel_risco_residual IS DISTINCT FROM d.nivel_risco_residual
  LOOP
    RAISE NOTICE 'fusão: nível residual de % (%) — % → %', r.codigo, left(r.nome, 40), r.antes, r.depois;
  END LOOP;

  RAISE NOTICE 'fusão: % riscos movidos, % com nível diferente na escala da Nexure', v_riscos, v_mudaram;
END $$;

-- ---------------------------------------------------------------------------
-- Guardas
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_fast uuid;
  v_sobrou integer;
  t text;
BEGIN
  SELECT id INTO v_fast FROM public.empresas WHERE lower(nome) = 'fast2mine';
  IF v_fast IS NULL THEN
    RAISE NOTICE 'fusão: nada a verificar';
    RETURN;
  END IF;

  /* O que devia ter saído, saiu. */
  FOREACH t IN ARRAY ARRAY['riscos', 'riscos_categorias', 'riscos_matrizes',
                           'riscos_anexos', 'riscos_historico_avaliacoes',
                           'ativos_localizacoes', 'docgen_conversations',
                           'profiles', 'denuncias_comite']
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE empresa_id = %L', t, v_fast)
      INTO v_sobrou;
    IF v_sobrou > 0 THEN
      RAISE EXCEPTION 'fusão: sobraram % linhas em % na Fast2Mine', v_sobrou, t;
    END IF;
  END LOOP;

  /* E a empresa saiu mesmo de serviço. */
  IF EXISTS (SELECT 1 FROM public.empresas WHERE id = v_fast AND ativo) THEN
    RAISE EXCEPTION 'fusão: a Fast2Mine continua activa';
  END IF;

  /* A invariante que a fusão mais podia partir: uma só matriz vigente. */
  IF EXISTS (
    SELECT empresa_id FROM public.riscos_matrizes WHERE ativa
    GROUP BY empresa_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'fusão: alguma empresa ficou com mais de uma matriz vigente';
  END IF;

  RAISE NOTICE 'fusão: Fast2Mine desactivada e sem dados operacionais';
END $$;
