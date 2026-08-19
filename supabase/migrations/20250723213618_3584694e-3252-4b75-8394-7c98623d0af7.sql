-- Adicionar trigger para calcular score automaticamente quando assessment é concluído
CREATE OR REPLACE FUNCTION public.trigger_calculate_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Só executar se o status mudou para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    -- Chamar a função de cálculo de score de forma assíncrona
    PERFORM pg_notify('calculate_score', NEW.id::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar o trigger
DROP TRIGGER IF EXISTS assessment_score_trigger ON public.due_diligence_assessments;
CREATE TRIGGER assessment_score_trigger
  AFTER UPDATE ON public.due_diligence_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_calculate_score();

-- Atualizar a função de cálculo de score para ser mais robusta
CREATE OR REPLACE FUNCTION public.calculate_due_diligence_score(assessment_id_param uuid)
RETURNS void AS $$
DECLARE
  total_weight INTEGER := 0;
  weighted_score DECIMAL := 0;
  final_score DECIMAL := 0;
  classification TEXT := 'ruim';
  question_record RECORD;
  response_record RECORD;
  score_breakdown JSONB := '{}';
  category_scores JSONB := '{}';
  category_weights JSONB := '{}';
BEGIN
  -- Verificar se o assessment existe e está concluído
  IF NOT EXISTS (
    SELECT 1 FROM public.due_diligence_assessments 
    WHERE id = assessment_id_param AND status = 'concluido'
  ) THEN
    RAISE EXCEPTION 'Assessment não encontrado ou não concluído: %', assessment_id_param;
  END IF;

  -- Calcular score por categoria
  FOR question_record IN
    SELECT 
      q.categoria,
      q.peso,
      COALESCE(r.pontuacao, 
        CASE 
          WHEN q.tipo = 'booleano' AND r.resposta = 'sim' THEN 10
          WHEN q.tipo = 'booleano' AND r.resposta = 'nao' THEN 0
          WHEN q.tipo = 'numerico' AND r.resposta ~ '^[0-9]+$' THEN LEAST(10, r.resposta::INTEGER)
          WHEN q.tipo = 'radio' THEN 
            CASE 
              WHEN r.resposta ILIKE '%excelente%' OR r.resposta ILIKE '%ótimo%' THEN 10
              WHEN r.resposta ILIKE '%bom%' OR r.resposta ILIKE '%adequado%' THEN 7
              WHEN r.resposta ILIKE '%regular%' OR r.resposta ILIKE '%médio%' THEN 5
              WHEN r.resposta ILIKE '%ruim%' OR r.resposta ILIKE '%inadequado%' THEN 2
              ELSE 5
            END
          WHEN LENGTH(TRIM(r.resposta)) > 100 THEN 8  -- Resposta detalhada
          WHEN LENGTH(TRIM(r.resposta)) > 50 THEN 6   -- Resposta média
          WHEN LENGTH(TRIM(r.resposta)) > 20 THEN 4   -- Resposta básica
          ELSE 2  -- Resposta muito curta
        END
      ) as pontuacao
    FROM public.due_diligence_questions q
    INNER JOIN public.due_diligence_responses r ON q.id = r.question_id
    WHERE r.assessment_id = assessment_id_param
  LOOP
    total_weight := total_weight + COALESCE(question_record.peso, 1);
    weighted_score := weighted_score + (question_record.pontuacao * COALESCE(question_record.peso, 1));
    
    -- Acumular scores por categoria
    IF category_scores ? question_record.categoria THEN
      category_scores := jsonb_set(
        category_scores, 
        ARRAY[question_record.categoria], 
        ((category_scores->>question_record.categoria)::DECIMAL + question_record.pontuacao)::text::jsonb
      );
      category_weights := jsonb_set(
        category_weights,
        ARRAY[question_record.categoria],
        ((category_weights->>question_record.categoria)::INTEGER + COALESCE(question_record.peso, 1))::text::jsonb
      );
    ELSE
      category_scores := category_scores || jsonb_build_object(question_record.categoria, question_record.pontuacao);
      category_weights := category_weights || jsonb_build_object(question_record.categoria, COALESCE(question_record.peso, 1));
    END IF;
  END LOOP;

  -- Calcular score final
  IF total_weight > 0 THEN
    final_score := weighted_score / total_weight;
  ELSE
    final_score := 0;
  END IF;

  -- Calcular médias por categoria
  FOR category_scores IN 
    SELECT key, value 
    FROM jsonb_each(category_scores)
  LOOP
    score_breakdown := score_breakdown || jsonb_build_object(
      category_scores.key, 
      (category_scores.value::DECIMAL / (category_weights->>category_scores.key)::INTEGER)
    );
  END LOOP;

  -- Determinar classificação
  IF final_score >= 8 THEN
    classification := 'excelente';
  ELSIF final_score >= 6 THEN
    classification := 'bom';
  ELSIF final_score >= 4 THEN
    classification := 'regular';
  ELSE
    classification := 'ruim';
  END IF;

  -- Inserir ou atualizar score
  INSERT INTO public.due_diligence_scores (
    assessment_id,
    score_total,
    score_breakdown,
    classificacao,
    observacoes_ia,
    created_at,
    updated_at
  ) VALUES (
    assessment_id_param,
    final_score,
    score_breakdown,
    classification,
    'Score calculado automaticamente baseado nas respostas fornecidas.',
    now(),
    now()
  )
  ON CONFLICT (assessment_id) 
  DO UPDATE SET
    score_total = EXCLUDED.score_total,
    score_breakdown = EXCLUDED.score_breakdown,
    classificacao = EXCLUDED.classificacao,
    updated_at = now();

  -- Atualizar score no assessment
  UPDATE public.due_diligence_assessments 
  SET 
    score_final = final_score,
    updated_at = now()
  WHERE id = assessment_id_param;

  RAISE NOTICE 'Score calculado: % (classificação: %)', final_score, classification;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;