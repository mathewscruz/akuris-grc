/* Uma configuração publicada nunca muda; alterações são uma nova versão. */
CREATE OR REPLACE FUNCTION public.tg_matriz_publicada_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.riscos_matrizes m
     WHERE m.id = OLD.matriz_id AND m.publicada_em IS NOT NULL
  ) AND (
    NEW.escala_probabilidade IS DISTINCT FROM OLD.escala_probabilidade
    OR NEW.escala_impacto IS DISTINCT FROM OLD.escala_impacto
    OR NEW.niveis_risco IS DISTINCT FROM OLD.niveis_risco
    OR NEW.metodo_calculo IS DISTINCT FROM OLD.metodo_calculo
    OR NEW.apetite_score IS DISTINCT FROM OLD.apetite_score
  ) THEN
    RAISE EXCEPTION 'MATRIZ_PUBLICADA_IMUTAVEL_USE_NOVA_VERSAO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matriz_publicada_imutavel ON public.riscos_matriz_configuracao;
CREATE TRIGGER trg_matriz_publicada_imutavel
  BEFORE UPDATE ON public.riscos_matriz_configuracao
  FOR EACH ROW EXECUTE FUNCTION public.tg_matriz_publicada_imutavel();
