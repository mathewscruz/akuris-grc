-- Corrigir a função calculate_due_diligence_score removendo referência à coluna categoria inexistente
CREATE OR REPLACE FUNCTION public.calculate_due_diligence_score(assessment_id_param uuid)
RETURNS void AS $$
DECLARE
  total_weight INTEGER := 0;
  weighted_score DECIMAL := 0;
  final_score DECIMAL := 0;
  classification TEXT := 'ruim';
  question_record RECORD;
BEGIN
  -- Verificar se o assessment existe e está concluído
  IF NOT EXISTS (
    SELECT 1 FROM public.due_diligence_assessments 
    WHERE id = assessment_id_param AND status = 'concluido'
  ) THEN
    RAISE EXCEPTION 'Assessment não encontrado ou não concluído: %', assessment_id_param;
  END IF;

  -- Calcular score total baseado nas respostas
  FOR question_record IN
    SELECT 
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
  END LOOP;

  -- Calcular score final
  IF total_weight > 0 THEN
    final_score := weighted_score / total_weight;
  ELSE
    final_score := 0;
  END IF;

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
    '{}', -- JSON vazio já que removemos o breakdown por categoria
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