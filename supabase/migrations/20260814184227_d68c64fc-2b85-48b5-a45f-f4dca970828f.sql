
-- PARTE A: testes de controlo
ALTER TABLE public.controles_testes
  ADD COLUMN IF NOT EXISTS testador_id uuid,
  ADD COLUMN IF NOT EXISTS evidencia_url text,
  ADD COLUMN IF NOT EXISTS evidencia_nome text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_controles_testes_controle ON public.controles_testes(controle_id, data_teste DESC);

CREATE OR REPLACE FUNCTION public.proxima_data_por_frequencia(_base date, _freq text)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_freq, ''))
    WHEN 'diaria' THEN _base + INTERVAL '1 day'
    WHEN 'diario' THEN _base + INTERVAL '1 day'
    WHEN 'semanal' THEN _base + INTERVAL '7 days'
    WHEN 'quinzenal' THEN _base + INTERVAL '15 days'
    WHEN 'mensal' THEN _base + INTERVAL '1 month'
    WHEN 'bimestral' THEN _base + INTERVAL '2 months'
    WHEN 'trimestral' THEN _base + INTERVAL '3 months'
    WHEN 'quadrimestral' THEN _base + INTERVAL '4 months'
    WHEN 'semestral' THEN _base + INTERVAL '6 months'
    WHEN 'anual' THEN _base + INTERVAL '1 year'
    WHEN 'bianual' THEN _base + INTERVAL '2 years'
    ELSE NULL
  END::date
$$;

CREATE OR REPLACE FUNCTION public.sync_controle_proxima_avaliacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _freq text;
  _controle uuid;
  _ultima record;
BEGIN
  _controle := COALESCE(NEW.controle_id, OLD.controle_id);
  SELECT frequencia INTO _freq FROM public.controles WHERE id = _controle;

  IF TG_OP <> 'DELETE' AND NEW.proxima_avaliacao IS NULL THEN
    NEW.proxima_avaliacao := public.proxima_data_por_frequencia(NEW.data_teste, _freq);
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT data_teste, proxima_avaliacao INTO _ultima
      FROM public.controles_testes
      WHERE controle_id = _controle
      ORDER BY data_teste DESC, created_at DESC
      LIMIT 1;
    UPDATE public.controles
      SET proxima_avaliacao = _ultima.proxima_avaliacao
      WHERE id = _controle;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_controles_testes_proxima ON public.controles_testes;
CREATE TRIGGER trg_controles_testes_proxima
  BEFORE INSERT OR UPDATE ON public.controles_testes
  FOR EACH ROW EXECUTE FUNCTION public.sync_controle_proxima_avaliacao();

CREATE OR REPLACE FUNCTION public.apply_controle_proxima_avaliacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ultima record;
BEGIN
  SELECT proxima_avaliacao INTO _ultima
    FROM public.controles_testes
    WHERE controle_id = NEW.controle_id
    ORDER BY data_teste DESC, created_at DESC
    LIMIT 1;
  IF _ultima.proxima_avaliacao IS NOT NULL THEN
    UPDATE public.controles
      SET proxima_avaliacao = _ultima.proxima_avaliacao
      WHERE id = NEW.controle_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_controles_testes_apply ON public.controles_testes;
CREATE TRIGGER trg_controles_testes_apply
  AFTER INSERT OR UPDATE ON public.controles_testes
  FOR EACH ROW EXECUTE FUNCTION public.apply_controle_proxima_avaliacao();

DROP TRIGGER IF EXISTS trg_controles_testes_delete ON public.controles_testes;
CREATE TRIGGER trg_controles_testes_delete
  AFTER DELETE ON public.controles_testes
  FOR EACH ROW EXECUTE FUNCTION public.sync_controle_proxima_avaliacao();

-- Preencher proxima_avaliacao em testes existentes e refletir nos controlos
UPDATE public.controles_testes ct
   SET proxima_avaliacao = public.proxima_data_por_frequencia(ct.data_teste, c.frequencia)
  FROM public.controles c
 WHERE c.id = ct.controle_id
   AND ct.proxima_avaliacao IS NULL;

-- PARTE B: constatacoes de auditoria
ALTER TABLE public.auditoria_achados
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.auditoria_itens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classificacao text NOT NULL DEFAULT 'observacao',
  ADD COLUMN IF NOT EXISTS evidencia_objetiva text,
  ADD COLUMN IF NOT EXISTS requisito_ref_id uuid,
  ADD COLUMN IF NOT EXISTS controle_ref_id uuid REFERENCES public.controles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_auditoria_achados_item ON public.auditoria_achados(item_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_achados_auditoria ON public.auditoria_achados(auditoria_id);

-- PARTE C: gates
ALTER TABLE public.auditoria_itens
  ADD COLUMN IF NOT EXISTS justificativa_sem_evidencia text;

ALTER TABLE public.auditorias
  ADD COLUMN IF NOT EXISTS conclusao_justificativa text,
  ADD COLUMN IF NOT EXISTS conclusao_forcada boolean NOT NULL DEFAULT false;
