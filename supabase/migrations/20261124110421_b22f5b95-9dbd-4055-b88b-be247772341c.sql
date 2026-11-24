CREATE OR REPLACE FUNCTION public.projeto_tarefa_exige_evidencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.concluida_em IS NOT NULL AND OLD.concluida_em IS NULL
     AND EXISTS (SELECT 1 FROM projetos p WHERE p.id = NEW.projeto_id AND p.exigir_evidencia)
     AND NOT EXISTS (SELECT 1 FROM projeto_tarefas c WHERE c.parent_task_id = NEW.id)
     AND NOT EXISTS (SELECT 1 FROM projeto_tarefa_anexos a WHERE a.tarefa_id = NEW.id) THEN
    RAISE EXCEPTION 'EVIDENCIA_OBRIGATORIA' USING HINT = 'Anexe uma evidência para concluir';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.projeto_tarefa_exige_evidencia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.projeto_anexo_valida() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_projeto_tarefa_exige_evidencia ON public.projeto_tarefas;
CREATE TRIGGER trg_projeto_tarefa_exige_evidencia BEFORE UPDATE OF concluida_em ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.projeto_tarefa_exige_evidencia();