-- Uma escala de severidade para a ferramenta inteira.
--
-- O módulo de Riscos passou a ter um número canónico e uma severidade
-- derivada da matriz da empresa. O resto do produto continuava a classificar
-- por texto solto, e cada tabela escolheu o seu vocabulário:
--
--   ativos, controles              alto / critico / medio / baixo   (masculino)
--   incidentes, denuncias          alta / critica / media / baixa   (feminino)
--   ativos_chaves, ativos_licencas media                            (feminino)
--   sistemas_privilegiados         critico E media                  (os dois!)
--
-- Nenhuma destas colunas tinha CHECK. `severidadeDeFaixas` no front-end
-- conhecia as duas grafias e por isso as contagens funcionavam — mas bastava
-- alguém gravar "Alta" com maiúscula, ou "muito alta", para o registo deixar
-- de contar em qualquer cartão, sem erro nenhum.
--
-- Fica o masculino, que é o que o vocabulário canónico do produto já usa
-- (`severidade_efetiva` em riscos é 'baixo' | 'medio' | 'alto' | 'critico').

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Normalizador partilhado
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.severidade_canonica(p_valor text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE lower(translate(btrim(coalesce(p_valor, '')), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'))
    WHEN 'critico' THEN 'critico'
    WHEN 'critica' THEN 'critico'
    WHEN 'extremo' THEN 'critico'
    WHEN 'extrema' THEN 'critico'
    WHEN 'muito alto' THEN 'critico'
    WHEN 'muito alta' THEN 'critico'
    WHEN 'muito_alto' THEN 'critico'
    WHEN 'muito_alta' THEN 'critico'
    WHEN 'alto' THEN 'alto'
    WHEN 'alta' THEN 'alto'
    WHEN 'elevado' THEN 'alto'
    WHEN 'elevada' THEN 'alto'
    WHEN 'medio' THEN 'medio'
    WHEN 'media' THEN 'medio'
    WHEN 'moderado' THEN 'medio'
    WHEN 'moderada' THEN 'medio'
    WHEN 'baixo' THEN 'baixo'
    WHEN 'baixa' THEN 'baixo'
    WHEN 'muito baixo' THEN 'baixo'
    WHEN 'muito baixa' THEN 'baixo'
    WHEN 'muito_baixo' THEN 'baixo'
    WHEN 'muito_baixa' THEN 'baixo'
    WHEN 'insignificante' THEN 'baixo'
    WHEN '' THEN NULL
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.severidade_canonica(text) IS
  'Normaliza qualquer grafia de criticidade/gravidade para o vocabulário único: baixo | medio | alto | critico. NULL quando não reconhece.';

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Normalização dos dados e guarda contra recaída
-- ══════════════════════════════════════════════════════════════════════════
--
-- O CHECK aceita NULL (nem todo registo é classificado) mas recusa qualquer
-- outra palavra. Valores que a função não reconhece ficam NULL em vez de
-- entrar como texto arbitrário: um registo por classificar é um estado
-- honesto, um registo com severidade que nenhum ecrã sabe ler não é.

DO $$
DECLARE
  alvo record;
BEGIN
  FOR alvo IN
    SELECT * FROM (VALUES
      ('ativos', 'criticidade'),
      ('ativos_chaves_criptograficas', 'criticidade'),
      ('ativos_licencas', 'criticidade'),
      ('ativos_manutencoes', 'criticidade'),
      ('auditoria_achados', 'criticidade'),
      ('controles', 'criticidade'),
      ('incidentes', 'criticidade'),
      ('sistemas_privilegiados', 'criticidade'),
      ('denuncias', 'gravidade')
    ) AS t(tabela, coluna)
  LOOP
    -- Duas destas tabelas já tinham CHECK — a fixar o vocabulário FEMININO
    -- ('baixa','media','alta','critica'). Sem largar a antiga, a normalização
    -- é recusada pela própria constraint que a torna necessária.
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      alvo.tabela, alvo.tabela || '_' || alvo.coluna || '_check');

    EXECUTE format(
      'UPDATE public.%I SET %I = public.severidade_canonica(%I)
        WHERE %I IS DISTINCT FROM public.severidade_canonica(%I)',
      alvo.tabela, alvo.coluna, alvo.coluna, alvo.coluna, alvo.coluna);

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      alvo.tabela, alvo.tabela || '_severidade_canonica');

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%I IS NULL OR %I IN (''baixo'',''medio'',''alto'',''critico''))',
      alvo.tabela, alvo.tabela || '_severidade_canonica', alvo.coluna, alvo.coluna);
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 3. O ROPA passa a usar a matriz da empresa
-- ══════════════════════════════════════════════════════════════════════════
--
-- `ropa_registros` tinha a sua própria avaliação de risco: probabilidade,
-- impacto e nível, os três como selects de texto independentes — o nível era
-- DIGITADO, não calculado. Nos dados reais, todos os registos tinham
-- `nivel = impacto`: a probabilidade estava lá e não entrava em conta nenhuma.
-- Era a nona regra de cálculo de risco do produto.
--
-- Passa a ser a mesma escala, a mesma matriz e o mesmo cálculo do módulo de
-- Riscos. O mapeamento dos valores antigos assume uma escala de 5:
-- baixo → 1, medio → 3, alto → 4, critico → 5.

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'ropa_registros'
         AND column_name = 'risco_probabilidade') <> 'smallint' THEN

    ALTER TABLE public.ropa_registros
      ALTER COLUMN risco_probabilidade TYPE smallint USING (
        CASE public.severidade_canonica(risco_probabilidade)
          WHEN 'baixo' THEN 1 WHEN 'medio' THEN 3
          WHEN 'alto' THEN 4 WHEN 'critico' THEN 5
          ELSE public.risco_escala_numero(risco_probabilidade)
        END),
      ALTER COLUMN risco_impacto TYPE smallint USING (
        CASE public.severidade_canonica(risco_impacto)
          WHEN 'baixo' THEN 1 WHEN 'medio' THEN 3
          WHEN 'alto' THEN 4 WHEN 'critico' THEN 5
          ELSE public.risco_escala_numero(risco_impacto)
        END);
  END IF;
END $$;

ALTER TABLE public.ropa_registros
  ADD COLUMN IF NOT EXISTS risco_score smallint,
  ADD COLUMN IF NOT EXISTS risco_severidade text;

ALTER TABLE public.ropa_registros DROP CONSTRAINT IF EXISTS ropa_severidade_canonica;
ALTER TABLE public.ropa_registros ADD CONSTRAINT ropa_severidade_canonica CHECK (
  risco_severidade IS NULL OR risco_severidade IN ('baixo','medio','alto','critico')
);

CREATE OR REPLACE FUNCTION public.tg_ropa_risco_calcular()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v record;
BEGIN
  SELECT * INTO v FROM public.risco_avaliar(NEW.empresa_id, NEW.risco_probabilidade, NEW.risco_impacto);
  NEW.risco_score      := v.score;
  NEW.risco_nivel      := v.nivel;
  NEW.risco_severidade := v.severidade;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ropa_risco_calcular ON public.ropa_registros;
CREATE TRIGGER trg_ropa_risco_calcular
  BEFORE INSERT OR UPDATE OF risco_probabilidade, risco_impacto, empresa_id
  ON public.ropa_registros
  FOR EACH ROW EXECUTE FUNCTION public.tg_ropa_risco_calcular();

-- Backfill: recalcula o que já lá está.
UPDATE public.ropa_registros r
   SET risco_score = a.score, risco_nivel = a.nivel, risco_severidade = a.severidade
  FROM (
    SELECT x.id, av.score, av.nivel, av.severidade
      FROM public.ropa_registros x
      CROSS JOIN LATERAL public.risco_avaliar(x.empresa_id, x.risco_probabilidade, x.risco_impacto) av
  ) a
 WHERE r.id = a.id
   AND (r.risco_score IS DISTINCT FROM a.score
     OR r.risco_nivel IS DISTINCT FROM a.nivel
     OR r.risco_severidade IS DISTINCT FROM a.severidade);

-- E acompanha a matriz quando ela muda, como os riscos.
CREATE OR REPLACE FUNCTION public.riscos_recalcular_empresa(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_linhas integer;
BEGIN
  UPDATE public.riscos r
     SET score_inicial       = a.score,
         nivel_risco_inicial = a.nivel,
         severidade_inicial  = a.severidade
    FROM (
      SELECT x.id, av.score, av.nivel, av.severidade
        FROM public.riscos x
        CROSS JOIN LATERAL public.risco_avaliar(x.empresa_id, x.probabilidade_inicial, x.impacto_inicial) av
       WHERE x.empresa_id = p_empresa_id
    ) a
   WHERE r.id = a.id
     AND (r.score_inicial IS DISTINCT FROM a.score
       OR r.nivel_risco_inicial IS DISTINCT FROM a.nivel
       OR r.severidade_inicial IS DISTINCT FROM a.severidade);
  GET DIAGNOSTICS v_linhas = ROW_COUNT;

  UPDATE public.riscos r
     SET score_residual       = a.score,
         nivel_risco_residual = a.nivel,
         severidade_residual  = a.severidade
    FROM (
      SELECT x.id, av.score, av.nivel, av.severidade
        FROM public.riscos x
        CROSS JOIN LATERAL public.risco_avaliar(x.empresa_id, x.probabilidade_residual, x.impacto_residual) av
       WHERE x.empresa_id = p_empresa_id
    ) a
   WHERE r.id = a.id
     AND (r.score_residual IS DISTINCT FROM a.score
       OR r.nivel_risco_residual IS DISTINCT FROM a.nivel
       OR r.severidade_residual IS DISTINCT FROM a.severidade);

  UPDATE public.riscos_historico_avaliacoes h
     SET score = a.score, severidade = a.severidade
    FROM (
      SELECT x.id, av.score, av.severidade
        FROM public.riscos_historico_avaliacoes x
        CROSS JOIN LATERAL public.risco_avaliar(x.empresa_id, x.probabilidade, x.impacto) av
       WHERE x.empresa_id = p_empresa_id
    ) a
   WHERE h.id = a.id
     AND (h.score IS DISTINCT FROM a.score OR h.severidade IS DISTINCT FROM a.severidade);

  UPDATE public.ropa_registros r
     SET risco_score = a.score, risco_nivel = a.nivel, risco_severidade = a.severidade
    FROM (
      SELECT x.id, av.score, av.nivel, av.severidade
        FROM public.ropa_registros x
        CROSS JOIN LATERAL public.risco_avaliar(x.empresa_id, x.risco_probabilidade, x.risco_impacto) av
       WHERE x.empresa_id = p_empresa_id
    ) a
   WHERE r.id = a.id
     AND (r.risco_score IS DISTINCT FROM a.score
       OR r.risco_nivel IS DISTINCT FROM a.nivel
       OR r.risco_severidade IS DISTINCT FROM a.severidade);

  RETURN v_linhas;
END $$;

REVOKE ALL ON FUNCTION public.riscos_recalcular_empresa(uuid) FROM PUBLIC, anon, authenticated;
