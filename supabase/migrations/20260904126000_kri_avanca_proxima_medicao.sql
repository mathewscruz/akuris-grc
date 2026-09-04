/* Cada medição conclui um ciclo e agenda automaticamente o próximo. */
CREATE OR REPLACE FUNCTION public.tg_risco_kri_registrar_medicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM public.riscos_kris WHERE id = NEW.kri_id;
  IF v_empresa_id IS NULL OR v_empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'KRI_FORA_DA_EMPRESA';
  END IF;

  UPDATE public.riscos_kris
     SET valor_atual = NEW.valor,
         ultima_medicao_em = NEW.medido_em,
         proxima_medicao = CASE periodicidade
           WHEN 'semanal' THEN NEW.medido_em::date + 7
           WHEN 'mensal' THEN (NEW.medido_em::date + interval '1 month')::date
           WHEN 'trimestral' THEN (NEW.medido_em::date + interval '3 months')::date
           WHEN 'semestral' THEN (NEW.medido_em::date + interval '6 months')::date
           WHEN 'anual' THEN (NEW.medido_em::date + interval '1 year')::date
           ELSE proxima_medicao
         END,
         updated_at = now()
   WHERE id = NEW.kri_id;
  RETURN NEW;
END;
$$;
