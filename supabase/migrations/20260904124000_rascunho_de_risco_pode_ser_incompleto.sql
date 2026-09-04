/* Rascunho pode ser salvo antes de a avaliação P×I estar completa. */
ALTER TABLE public.riscos
  ALTER COLUMN probabilidade_inicial DROP NOT NULL,
  ALTER COLUMN impacto_inicial DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_risco_registar_no_livro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_autor uuid := auth.uid();
  v_por_omissao boolean;
BEGIN
  IF NEW.probabilidade_inicial IS NOT NULL
     AND NEW.impacto_inicial IS NOT NULL
     AND (TG_OP = 'INSERT'
       OR NEW.probabilidade_inicial IS DISTINCT FROM OLD.probabilidade_inicial
       OR NEW.impacto_inicial IS DISTINCT FROM OLD.impacto_inicial) THEN
    INSERT INTO public.riscos_historico_avaliacoes (
      risco_id, empresa_id, matriz_id, probabilidade, impacto,
      nivel_risco, tipo, avaliado_por, observacoes
    ) VALUES (
      NEW.id, NEW.empresa_id, NEW.matriz_id,
      NEW.probabilidade_inicial, NEW.impacto_inicial,
      COALESCE(NEW.nivel_risco_inicial, 'Não avaliado'), 'inicial', v_autor,
      nullif(btrim(NEW.ultima_observacao_avaliacao), '')
    );
  END IF;

  v_por_omissao :=
    NEW.probabilidade_residual = NEW.probabilidade_inicial
    AND NEW.impacto_residual = NEW.impacto_inicial
    AND (TG_OP = 'INSERT' OR OLD.probabilidade_residual IS NULL OR OLD.impacto_residual IS NULL);

  IF NEW.probabilidade_residual IS NOT NULL
     AND NEW.impacto_residual IS NOT NULL
     AND NOT COALESCE(v_por_omissao, false)
     AND (TG_OP = 'INSERT'
       OR NEW.probabilidade_residual IS DISTINCT FROM OLD.probabilidade_residual
       OR NEW.impacto_residual IS DISTINCT FROM OLD.impacto_residual) THEN
    INSERT INTO public.riscos_historico_avaliacoes (
      risco_id, empresa_id, matriz_id, probabilidade, impacto,
      nivel_risco, tipo, avaliado_por, observacoes
    ) VALUES (
      NEW.id, NEW.empresa_id, NEW.matriz_id,
      NEW.probabilidade_residual, NEW.impacto_residual,
      COALESCE(NEW.nivel_risco_residual, NEW.nivel_risco_inicial, 'Não avaliado'),
      'residual', v_autor, nullif(btrim(NEW.ultima_observacao_avaliacao), '')
    );
  END IF;
  RETURN NEW;
END;
$$;
