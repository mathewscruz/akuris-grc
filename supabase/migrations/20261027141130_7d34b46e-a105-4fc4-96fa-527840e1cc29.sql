ALTER TABLE public.continuidade_planos
  ADD COLUMN IF NOT EXISTS sistema_id uuid NULL REFERENCES public.sistemas_privilegiados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS criticidade text NOT NULL DEFAULT 'media';

CREATE OR REPLACE FUNCTION public.continuidade_planos_valida_sistema()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.criticidade NOT IN ('baixa','media','alta','critica') THEN
    RAISE EXCEPTION 'Criticidade inválida: %', NEW.criticidade;
  END IF;
  IF NEW.sistema_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sistemas_privilegiados s WHERE s.id = NEW.sistema_id AND s.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Sistema não pertence à empresa do plano';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_continuidade_planos_valida_sistema ON public.continuidade_planos;
CREATE TRIGGER trg_continuidade_planos_valida_sistema
BEFORE INSERT OR UPDATE OF sistema_id, criticidade, empresa_id ON public.continuidade_planos
FOR EACH ROW EXECUTE FUNCTION public.continuidade_planos_valida_sistema();

CREATE INDEX IF NOT EXISTS idx_continuidade_planos_sistema ON public.continuidade_planos(sistema_id);