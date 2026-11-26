ALTER TABLE public.due_diligence_assessments
  ADD COLUMN IF NOT EXISTS ia_status text,
  ADD COLUMN IF NOT EXISTS ia_iniciado_em timestamptz;

-- "Não se aplica" fica fora da conta.
CREATE OR REPLACE FUNCTION public.dd_eh_nao_aplicavel(p_config jsonb, p_resposta text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public','pg_temp' AS $$
  SELECT p_resposta IS NOT NULL AND (
    (jsonb_typeof(p_config->'na_opcoes') = 'array' AND p_config->'na_opcoes' ? p_resposta)
    OR lower(regexp_replace(btrim(p_resposta), '[\s\.\-_/]+', '', 'g')) IN ('na','nãoseaplica','naoseaplica','nãoaplicável','naoaplicavel','notapplicable')
  )
$$;

DO $$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('public.dd_nota_da_resposta(text,jsonb,jsonb,text,text)'::regprocedure);
  v_def := replace(v_def, '  -- 1. mapa explícito', '  IF public.dd_eh_nao_aplicavel(p_config, p_resposta) THEN RETURN NULL; END IF;

  -- 1. mapa explícito');
  EXECUTE v_def;
END $$;

-- Uma resposta só pode apontar para pergunta do questionário da própria avaliação.
CREATE OR REPLACE FUNCTION public.dd_resposta_pergunta_do_template()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.due_diligence_assessments a
    JOIN public.due_diligence_questions q ON q.template_id = a.template_id
    WHERE a.id = NEW.assessment_id AND q.id = NEW.question_id
  ) THEN
    RAISE EXCEPTION 'Pergunta não pertence ao questionário desta avaliação';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dd_resposta_pergunta_do_template ON public.due_diligence_responses;
CREATE TRIGGER trg_dd_resposta_pergunta_do_template
  BEFORE INSERT OR UPDATE OF question_id, assessment_id ON public.due_diligence_responses
  FOR EACH ROW EXECUTE FUNCTION public.dd_resposta_pergunta_do_template();

-- Uma única análise de IA por avaliação ao mesmo tempo.
CREATE OR REPLACE FUNCTION public.dd_reivindicar_parecer(p_assessment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_ok boolean;
BEGIN
  UPDATE public.due_diligence_assessments
     SET ia_status = 'em_andamento', ia_iniciado_em = now()
   WHERE id = p_assessment_id AND status = 'concluido'
     AND (ia_status IS DISTINCT FROM 'em_andamento' OR ia_iniciado_em < now() - interval '10 minutes')
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END $$;
REVOKE ALL ON FUNCTION public.dd_reivindicar_parecer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dd_reivindicar_parecer(uuid) TO service_role;

-- Recalcula todas as concluídas: converte notas antigas (nota × peso) para 0–10.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.due_diligence_assessments WHERE status = 'concluido' LOOP
    BEGIN
      PERFORM public.calculate_due_diligence_score(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'recalculo falhou %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;