-- Um período não pode acabar antes de começar.
--
-- ## O que foi medido
--
-- Nenhuma das seis tabelas com par início/fim tinha regra nenhuma:
-- `projetos`, `projeto_sprints`, `ropa_registros`, `contratos`,
-- `contrato_aditivos` e `auditorias`. Consultadas as CHECK de cada uma, só
-- havia regras de `status` e de `tipo` — nada sobre datas.
--
-- E quatro formulários também não validavam: `ProjetoDialog`, `SprintsPanel`,
-- `RopaDialog` e `AditivosDialog`. Os outros dois (`ContratoDialogWizard` e
-- `AuditoriaDialog`) validavam — cada um com o seu código, escrito à mão.
--
-- Inserido um projeto com `data_inicio = 2026-12-30` e
-- `data_fim_prevista = 2026-06-30`, a base aceitou, e o cartão do módulo
-- desenhou-o tal e qual: «29/12/2026 → 29/06/2026». O cálculo de progresso
-- do sprint faz `Math.max(1, fim - início)` — com o intervalo ao contrário, a
-- linha ideal do burndown passa a ser desenhada sobre um único dia.
--
-- ## Já existe uma linha assim
--
-- Na base de desenvolvimento, um aditivo de PRAZO com
-- `data_inicio_nova = 2026-08-20` e `data_fim_nova = 2026-08-10`: uma
-- prorrogação que termina dez dias antes de começar. Não é hipótese, é o que
-- lá está.
--
-- ## Porquê NOT VALID
--
-- A regra vale para tudo o que entrar de agora em diante — que é o que
-- interessa. Validar o passado faria a migração REBENTAR na primeira base que
-- tivesse uma linha destas, e decidir o que fazer com um aditivo já assinado
-- não é decisão de uma migração: é de quem o assinou. O aviso no fim conta
-- quantas linhas ficaram para trás, para que ninguém as descubra por acaso.
--
-- Quem quiser fechar o passado, depois de o corrigir:
--   ALTER TABLE public.<tabela> VALIDATE CONSTRAINT <nome>;

DO $$
DECLARE
  v_por_tratar integer := 0;
  v_parcial integer;
BEGIN
  -- ── projetos ───────────────────────────────────────────────────────────
  ALTER TABLE public.projetos DROP CONSTRAINT IF EXISTS projetos_fim_depois_do_inicio;
  ALTER TABLE public.projetos
    ADD CONSTRAINT projetos_fim_depois_do_inicio
    CHECK (data_inicio IS NULL OR data_fim_prevista IS NULL OR data_fim_prevista >= data_inicio)
    NOT VALID;
  SELECT count(*) INTO v_parcial FROM public.projetos
   WHERE data_inicio IS NOT NULL AND data_fim_prevista IS NOT NULL
     AND data_fim_prevista < data_inicio;
  v_por_tratar := v_por_tratar + v_parcial;

  -- ── projeto_sprints ────────────────────────────────────────────────────
  ALTER TABLE public.projeto_sprints DROP CONSTRAINT IF EXISTS sprints_fim_depois_do_inicio;
  ALTER TABLE public.projeto_sprints
    ADD CONSTRAINT sprints_fim_depois_do_inicio
    CHECK (data_fim >= data_inicio)
    NOT VALID;
  SELECT count(*) INTO v_parcial FROM public.projeto_sprints WHERE data_fim < data_inicio;
  v_por_tratar := v_por_tratar + v_parcial;

  -- ── ropa_registros ─────────────────────────────────────────────────────
  ALTER TABLE public.ropa_registros DROP CONSTRAINT IF EXISTS ropa_fim_depois_do_inicio;
  ALTER TABLE public.ropa_registros
    ADD CONSTRAINT ropa_fim_depois_do_inicio
    CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_fim >= data_inicio)
    NOT VALID;
  SELECT count(*) INTO v_parcial FROM public.ropa_registros
   WHERE data_inicio IS NOT NULL AND data_fim IS NOT NULL AND data_fim < data_inicio;
  v_por_tratar := v_por_tratar + v_parcial;

  -- ── contratos ──────────────────────────────────────────────────────────
  ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_fim_depois_do_inicio;
  ALTER TABLE public.contratos
    ADD CONSTRAINT contratos_fim_depois_do_inicio
    CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_fim >= data_inicio)
    NOT VALID;
  SELECT count(*) INTO v_parcial FROM public.contratos
   WHERE data_inicio IS NOT NULL AND data_fim IS NOT NULL AND data_fim < data_inicio;
  v_por_tratar := v_por_tratar + v_parcial;

  -- ── contrato_aditivos: os dois pares, o anterior e o novo ──────────────
  ALTER TABLE public.contrato_aditivos DROP CONSTRAINT IF EXISTS aditivos_fim_depois_do_inicio;
  ALTER TABLE public.contrato_aditivos
    ADD CONSTRAINT aditivos_fim_depois_do_inicio
    CHECK (
      (data_inicio_nova IS NULL OR data_fim_nova IS NULL OR data_fim_nova >= data_inicio_nova)
      AND
      (data_inicio_anterior IS NULL OR data_fim_anterior IS NULL OR data_fim_anterior >= data_inicio_anterior)
    )
    NOT VALID;
  SELECT count(*) INTO v_parcial FROM public.contrato_aditivos
   WHERE (data_inicio_nova IS NOT NULL AND data_fim_nova IS NOT NULL AND data_fim_nova < data_inicio_nova)
      OR (data_inicio_anterior IS NOT NULL AND data_fim_anterior IS NOT NULL AND data_fim_anterior < data_inicio_anterior);
  v_por_tratar := v_por_tratar + v_parcial;

  -- ── auditorias ─────────────────────────────────────────────────────────
  ALTER TABLE public.auditorias DROP CONSTRAINT IF EXISTS auditorias_fim_depois_do_inicio;
  ALTER TABLE public.auditorias
    ADD CONSTRAINT auditorias_fim_depois_do_inicio
    CHECK (data_inicio IS NULL OR data_fim_prevista IS NULL OR data_fim_prevista >= data_inicio)
    NOT VALID;
  SELECT count(*) INTO v_parcial FROM public.auditorias
   WHERE data_inicio IS NOT NULL AND data_fim_prevista IS NOT NULL
     AND data_fim_prevista < data_inicio;
  v_por_tratar := v_por_tratar + v_parcial;

  IF v_por_tratar > 0 THEN
    RAISE WARNING 'Existem % linha(s) com o período ao contrário, anteriores a esta regra. Ficam como estão: corrigi-las é decisão de quem as criou.', v_por_tratar;
  ELSE
    RAISE NOTICE 'Nenhum período ao contrário nas seis tabelas.';
  END IF;
END $$;

COMMENT ON CONSTRAINT projetos_fim_depois_do_inicio ON public.projetos IS
  'Um período não acaba antes de começar. NOT VALID de propósito: vale para o que entrar, não rebenta com o que já lá está.';
