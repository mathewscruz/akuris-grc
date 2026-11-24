ALTER TABLE public.projeto_tarefa_anexos
  ADD COLUMN IF NOT EXISTS tipo_origem text NOT NULL DEFAULT 'arquivo',
  ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.projeto_tarefa_anexos ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS exigir_evidencia boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.projeto_anexo_valida()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tipo_origem NOT IN ('arquivo','link') THEN RAISE EXCEPTION 'tipo_origem inválido'; END IF;
  IF NEW.tipo_origem = 'link' AND (NEW.url IS NULL OR NEW.url !~* '^https://') THEN
    RAISE EXCEPTION 'O link da evidência precisa começar com https://';
  END IF;
  IF NEW.tipo_origem = 'arquivo' AND NEW.storage_path IS NULL THEN RAISE EXCEPTION 'Arquivo ausente'; END IF;
  NEW.uploaded_by := COALESCE(NEW.uploaded_by, auth.uid());
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_projeto_anexo_valida ON public.projeto_tarefa_anexos;
CREATE TRIGGER trg_projeto_anexo_valida BEFORE INSERT OR UPDATE ON public.projeto_tarefa_anexos
FOR EACH ROW EXECUTE FUNCTION public.projeto_anexo_valida();

CREATE OR REPLACE FUNCTION public.projeto_tarefa_exige_evidencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.concluida_em IS NOT NULL AND OLD.concluida_em IS NULL
     AND EXISTS (SELECT 1 FROM projetos p WHERE p.id = NEW.projeto_id AND p.exigir_evidencia)
     AND NOT EXISTS (SELECT 1 FROM projeto_tarefa_tarefas_filhas_dummy WHERE false) IS NULL THEN
    NULL;
  END IF;
  IF NEW.concluida_em IS NOT NULL AND OLD.concluida_em IS NULL
     AND EXISTS (SELECT 1 FROM projetos p WHERE p.id = NEW.projeto_id AND p.exigir_evidencia)
     AND NOT EXISTS (SELECT 1 FROM projeto_tarefas c WHERE c.parent_task_id = NEW.id)
     AND NOT EXISTS (SELECT 1 FROM projeto_tarefa_anexos a WHERE a.tarefa_id = NEW.id) THEN
    RAISE EXCEPTION 'EVIDENCIA_OBRIGATORIA' USING HINT = 'Anexe uma evidência para concluir';
  END IF;
  RETURN NEW;
END $$;