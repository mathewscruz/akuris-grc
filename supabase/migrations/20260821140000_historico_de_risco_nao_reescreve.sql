-- Apagar um risco deixa de reescrever o passado do gráfico.
--
-- O sintoma: apagar o primeiro risco, cadastrado em maio, mudava o ponto de
-- MAIO na curva de evolução. Um gráfico de histórico que se reescreve quando
-- se mexe no presente não é um histórico — e é este número que vai ao
-- conselho.
--
-- A causa tem duas metades:
--
--   1. `riscos_historico_avaliacoes.risco_id` tinha `ON DELETE CASCADE`. O
--      livro de registo morria com o risco: não é uma trilha, é um espelho.
--
--   2. Mesmo com o livro intacto, ele estava incompleto. De 83 riscos, só 9
--      tinham alguma linha — as restantes séries eram reconstruídas a partir
--      da tabela `riscos`, que é o presente. Ler o presente para desenhar o
--      passado é a mesma falha por outro caminho.
--
-- A correcção faz do histórico um livro append-only e completo:
--
--   · o `CASCADE` sai — a linha sobrevive ao risco;
--   · todo risco existente ganha o seu ponto de partida (backfill);
--   · todo risco novo escreve-o sozinho, venha do formulário, da API ou de
--     uma importação;
--   · toda reavaliação escreve a sua linha;
--   · a exclusão escreve uma linha `exclusao`, que é o que diz ao gráfico
--     até quando aquele risco contava. Sem ela, um risco apagado contaria
--     para sempre — o erro oposto, e igualmente errado.
--
-- Fica sem chave estrangeira de propósito: `risco_id` passa a apontar para
-- uma linha que pode já não existir. É o que se espera de um livro de
-- registo, e é o preço de ele não poder ser reescrito.

-- ── 1. O livro deixa de morrer com o risco ───────────────────────────────
ALTER TABLE public.riscos_historico_avaliacoes
  DROP CONSTRAINT IF EXISTS riscos_historico_avaliacoes_risco_id_fkey;

COMMENT ON COLUMN public.riscos_historico_avaliacoes.risco_id IS
  'Risco a que a avaliação se refere. SEM chave estrangeira de propósito: o '
  'livro é append-only e sobrevive à exclusão do risco, para que o histórico '
  'do gráfico não se reescreva. Ver a linha tipo=''exclusao''.';

-- ── 2. Todo risco tem um ponto de partida ────────────────────────────────
-- Sem isto, um risco nunca reavaliado não tem uma única linha no livro, e ao
-- ser apagado desaparece de todos os meses em que existiu.
INSERT INTO public.riscos_historico_avaliacoes (
  risco_id, empresa_id, probabilidade, impacto, nivel_risco, tipo, created_at, observacoes
)
SELECT
  r.id,
  r.empresa_id,
  COALESCE(r.probabilidade_inicial, 1),
  COALESCE(r.impacto_inicial, 1),
  COALESCE(r.nivel_risco_inicial, 'Nao avaliado'),
  'inicial',
  r.created_at,
  NULL
FROM public.riscos r
WHERE NOT EXISTS (
  SELECT 1 FROM public.riscos_historico_avaliacoes h WHERE h.risco_id = r.id
);

-- ── 3. O livro escreve-se sozinho ────────────────────────────────────────
/*
  Uma só função para os três momentos.

  Antes, quem escrevia o livro era o formulário (`RiscoFormWizard`). Um risco
  criado pela API, por importação ou por SQL não deixava rasto nenhum — e o
  gráfico não tinha como saber que ele existiu. Com a escrita no banco, a
  origem deixa de importar.
*/
CREATE OR REPLACE FUNCTION public.tg_risco_registar_no_livro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor uuid := auth.uid();
BEGIN
  IF TG_OP = 'DELETE' THEN
    /*
      A linha que fecha a série.

      `probabilidade`/`impacto` são NOT NULL, por isso guardam-se os últimos
      valores conhecidos — não é o que interessa aqui, mas manter a forma da
      tabela é melhor do que abrir excepções nela.
    */
    INSERT INTO public.riscos_historico_avaliacoes (
      risco_id, empresa_id, probabilidade, impacto, nivel_risco, tipo, avaliado_por
    ) VALUES (
      OLD.id,
      OLD.empresa_id,
      COALESCE(OLD.probabilidade_residual, OLD.probabilidade_inicial, 1),
      COALESCE(OLD.impacto_residual, OLD.impacto_inicial, 1),
      COALESCE(OLD.nivel_risco_residual, OLD.nivel_risco_inicial, 'Nao avaliado'),
      'exclusao',
      v_autor
    );
    RETURN OLD;
  END IF;

  -- Avaliação inerente: na criação sempre; na edição só quando muda.
  IF TG_OP = 'INSERT' OR
     NEW.probabilidade_inicial IS DISTINCT FROM OLD.probabilidade_inicial OR
     NEW.impacto_inicial IS DISTINCT FROM OLD.impacto_inicial
  THEN
    INSERT INTO public.riscos_historico_avaliacoes (
      risco_id, empresa_id, probabilidade, impacto, nivel_risco, tipo, avaliado_por
    ) VALUES (
      NEW.id, NEW.empresa_id,
      COALESCE(NEW.probabilidade_inicial, 1),
      COALESCE(NEW.impacto_inicial, 1),
      COALESCE(NEW.nivel_risco_inicial, 'Nao avaliado'),
      'inicial', v_autor
    );
  END IF;

  -- Residual: só quando existe. Um risco sem avaliação residual não tem
  -- linha residual — e não é o mesmo que ter uma a zero.
  IF NEW.probabilidade_residual IS NOT NULL AND NEW.impacto_residual IS NOT NULL AND (
       TG_OP = 'INSERT' OR
       NEW.probabilidade_residual IS DISTINCT FROM OLD.probabilidade_residual OR
       NEW.impacto_residual IS DISTINCT FROM OLD.impacto_residual
     )
  THEN
    INSERT INTO public.riscos_historico_avaliacoes (
      risco_id, empresa_id, probabilidade, impacto, nivel_risco, tipo, avaliado_por
    ) VALUES (
      NEW.id, NEW.empresa_id,
      NEW.probabilidade_residual,
      NEW.impacto_residual,
      COALESCE(NEW.nivel_risco_residual, NEW.nivel_risco_inicial, 'Nao avaliado'),
      'residual', v_autor
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_risco_livro_ins ON public.riscos;
CREATE TRIGGER trg_risco_livro_ins
  AFTER INSERT ON public.riscos
  FOR EACH ROW EXECUTE FUNCTION public.tg_risco_registar_no_livro();

DROP TRIGGER IF EXISTS trg_risco_livro_upd ON public.riscos;
CREATE TRIGGER trg_risco_livro_upd
  AFTER UPDATE OF probabilidade_inicial, impacto_inicial,
                  probabilidade_residual, impacto_residual
  ON public.riscos
  FOR EACH ROW EXECUTE FUNCTION public.tg_risco_registar_no_livro();

DROP TRIGGER IF EXISTS trg_risco_livro_del ON public.riscos;
CREATE TRIGGER trg_risco_livro_del
  AFTER DELETE ON public.riscos
  FOR EACH ROW EXECUTE FUNCTION public.tg_risco_registar_no_livro();

-- ── 4. Rede de segurança ─────────────────────────────────────────────────
DO $$
DECLARE
  v_sem_livro integer;
BEGIN
  SELECT count(*) INTO v_sem_livro
  FROM public.riscos r
  WHERE NOT EXISTS (
    SELECT 1 FROM public.riscos_historico_avaliacoes h WHERE h.risco_id = r.id
  );

  IF v_sem_livro > 0 THEN
    RAISE EXCEPTION 'histórico: % riscos ficaram sem ponto de partida no livro', v_sem_livro;
  END IF;

  RAISE NOTICE 'histórico: % linhas no livro, % riscos cobertos',
    (SELECT count(*) FROM public.riscos_historico_avaliacoes),
    (SELECT count(DISTINCT risco_id) FROM public.riscos_historico_avaliacoes);
END $$;
