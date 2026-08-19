-- Criar trigger para cálculo automático de score quando assessment é concluído
CREATE OR REPLACE FUNCTION trigger_calculate_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só executar se o status mudou para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    -- Chamar a função de cálculo de score
    PERFORM calculate_due_diligence_score(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger na tabela de assessments
DROP TRIGGER IF EXISTS assessment_score_trigger ON public.due_diligence_assessments;
CREATE TRIGGER assessment_score_trigger
  AFTER UPDATE ON public.due_diligence_assessments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_score();