DROP TRIGGER IF EXISTS trg_projeto_tarefa_exige_evidencia ON public.projeto_tarefas;
CREATE TRIGGER trg_projeto_tarefa_exige_evidencia BEFORE UPDATE ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.projeto_tarefa_exige_evidencia();