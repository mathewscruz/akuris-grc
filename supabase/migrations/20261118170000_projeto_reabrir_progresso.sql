CREATE OR REPLACE FUNCTION public.projeto_tarefa_check_conclusao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_concluido boolean;
BEGIN
  IF NEW.coluna_id IS NOT NULL THEN
    SELECT is_concluido INTO v_concluido FROM public.projeto_colunas WHERE id = NEW.coluna_id;
    IF v_concluido AND NEW.concluida_em IS NULL THEN
      NEW.concluida_em = now();
      NEW.progresso_pct = 100;
    ELSIF NOT v_concluido AND NEW.concluida_em IS NOT NULL THEN
      NEW.concluida_em = NULL;
      IF NEW.progresso_pct = 100 THEN
        NEW.progresso_pct = 0;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
