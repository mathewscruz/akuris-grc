-- Preserve supplied assessments; normalize legacy weights only while calculating.
-- No historical score backfill or automatic compliance decisions.
CREATE OR REPLACE FUNCTION public.gap_calcula_score_framework(p_framework_id uuid,p_empresa_id uuid)
RETURNS TABLE(score numeric,total_requisitos integer,avaliados integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH quem AS (SELECT CASE WHEN auth.role()='service_role' THEN p_empresa_id ELSE public.gap_empresa_autorizada(p_empresa_id) END AS empresa_id),
 no_escopo AS (
 SELECT r.id, CASE WHEN r.peso>0 AND r.peso::text NOT IN ('NaN','Infinity') THEN r.peso ELSE 1 END AS peso,
 COALESCE(e.conformity_status,'nao_avaliado') AS estado
 FROM public.gap_analysis_requirements r
 JOIN public.gap_analysis_frameworks f ON f.id=r.framework_id
  AND (f.empresa_id IS NULL OR f.empresa_id=(SELECT empresa_id FROM quem))
 LEFT JOIN public.gap_analysis_evaluations e ON e.requirement_id=r.id AND e.empresa_id=(SELECT empresa_id FROM quem) AND e.framework_id=r.framework_id
 LEFT JOIN public.gap_analysis_soa s ON s.requirement_id=r.id AND s.empresa_id=(SELECT empresa_id FROM quem) AND s.framework_id=r.framework_id
 WHERE r.framework_id=p_framework_id AND COALESCE(s.aplicavel,true)
 AND COALESCE(e.conformity_status,'nao_avaliado')<>'nao_aplicavel'
 )
 SELECT COALESCE(round(sum((CASE estado WHEN 'conforme' THEN 100 WHEN 'parcial' THEN 50 ELSE 0 END)::numeric*peso)/NULLIF(sum(peso),0)),0),
 count(*)::integer, count(*) FILTER(WHERE estado IN ('conforme','parcial','nao_conforme'))::integer FROM no_escopo;
$$;

-- A monotonically increasing lease generation prevents delayed workers from
-- regaining ownership when the hourly retry counter resets.
ALTER TABLE public.evidence_analysis_jobs
 ADD COLUMN attempts_in_window integer NOT NULL DEFAULT 1,
 ADD COLUMN attempt_window_started_at timestamptz NOT NULL DEFAULT now();
CREATE OR REPLACE FUNCTION public.evidence_analysis_claim(p_empresa uuid,p_user uuid,p_requirement uuid,p_key text,p_hash text,p_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.evidence_analysis_jobs;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa::text,491));
 -- Retain extracted text only while it is useful for resumption. Results keep
 -- the quoted passages, not another permanent copy of the whole document.
 UPDATE public.evidence_analysis_jobs SET checkpoint=NULL WHERE empresa_id=p_empresa AND updated_at<now()-interval '7 days' AND checkpoint IS NOT NULL;
 SELECT * INTO j FROM public.evidence_analysis_jobs WHERE empresa_id=p_empresa AND cache_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF j.status='complete' AND j.updated_at>now()-interval '7 days' THEN RETURN jsonb_build_object('cached',true,'job',to_jsonb(j)); END IF;
  IF j.status='running' AND j.lease_until>now() THEN RETURN jsonb_build_object('busy',true,'job_id',j.id); END IF;
  IF j.attempts_in_window>=3 AND j.attempt_window_started_at>now()-interval '1 hour' THEN RAISE EXCEPTION 'retry_later'; END IF;
 END IF;
 IF (SELECT count(*) FROM public.evidence_analysis_jobs WHERE empresa_id=p_empresa AND status='running' AND lease_until>now())>=2
  OR (SELECT count(*) FROM public.evidence_analysis_jobs WHERE empresa_id=p_empresa AND created_at>now()-interval '1 hour')>=40 THEN RAISE EXCEPTION 'processing_limit'; END IF;
 IF j.id IS NULL THEN
  INSERT INTO public.evidence_analysis_jobs(empresa_id,requested_by,requirement_id,cache_key,source_hash,reader_version,status)
  VALUES(p_empresa,p_user,p_requirement,p_key,p_hash,p_version,'running') RETURNING * INTO j;
 ELSE
  UPDATE public.evidence_analysis_jobs SET status='running',attempt=attempt+1, requested_by=p_user,
   attempts_in_window=CASE WHEN attempt_window_started_at<=now()-interval '1 hour' THEN 1 ELSE attempts_in_window+1 END,
   attempt_window_started_at=CASE WHEN attempt_window_started_at<=now()-interval '1 hour' THEN now() ELSE attempt_window_started_at END,
   lease_until=now()+interval '3 minutes',updated_at=now(),error_code=NULL,result=NULL,
   checkpoint=CASE WHEN updated_at<now()-interval '7 days' THEN NULL ELSE checkpoint END WHERE id=j.id RETURNING * INTO j;
 END IF;
 RETURN jsonb_build_object('job',to_jsonb(j));
END $$;
REVOKE ALL ON FUNCTION public.evidence_analysis_claim(uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.evidence_analysis_claim(uuid,uuid,uuid,text,text,text) TO service_role;

-- Exact checkbox option matches: "AWS" must not match "AWS Backup"; "%" is literal.
-- Numeric zero remains a valid answer; NaN/infinite/out-of-range values are not scores.
CREATE OR REPLACE FUNCTION public.dd_nota_da_resposta(
  p_tipo text,
  p_opcoes jsonb,
  p_config jsonb,
  p_resposta text,
  p_arquivo text
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_negativa boolean := COALESCE(p_config->>'polaridade', 'positiva') = 'negativa';
  v_explicita numeric;
  v_n integer;
  v_idx integer;
  v_nota numeric;
  v_escolhidas integer;
BEGIN
  IF p_resposta IS NULL OR btrim(p_resposta) = '' THEN
    -- Um anexo pode ser a resposta inteira numa pergunta de ficheiro.
    IF p_tipo = 'file' THEN
      RETURN CASE WHEN COALESCE(btrim(p_arquivo), '') <> '' THEN 10 ELSE 0 END;
    END IF;
    RETURN NULL;
  END IF;

  -- 1. mapa explícito
  BEGIN
    v_explicita := (p_config->'pontuacoes'->>p_resposta)::numeric;
  EXCEPTION WHEN OTHERS THEN
    v_explicita := NULL;
  END;
  IF v_explicita IS NOT NULL AND v_explicita::text NOT IN ('NaN','Infinity','-Infinity') THEN
    RETURN GREATEST(0, LEAST(10, v_explicita));
  END IF;

  CASE p_tipo
    WHEN 'radio', 'select' THEN
      v_n := COALESCE(jsonb_array_length(p_opcoes), 0);
      IF v_n < 2 THEN RETURN NULL; END IF;
      SELECT ord - 1 INTO v_idx
        FROM jsonb_array_elements_text(p_opcoes) WITH ORDINALITY AS o(val, ord)
       WHERE o.val = p_resposta
       LIMIT 1;
      -- Resposta fora das opções: não se inventa nota para ela.
      IF v_idx IS NULL THEN RETURN NULL; END IF;
      -- Primeira opção vale 10, última vale 0, o resto distribui-se por igual.
      v_nota := 10.0 * (v_n - 1 - v_idx) / (v_n - 1);

    WHEN 'checkbox' THEN
      v_n := COALESCE(jsonb_array_length(p_opcoes), 0);
      IF v_n = 0 THEN RETURN NULL; END IF;
      SELECT count(*) INTO v_escolhidas
        FROM jsonb_array_elements_text(p_opcoes) AS o(val)
       WHERE btrim(o.val) = ANY(regexp_split_to_array(p_resposta, '\s*;\s*'));
      v_nota := 10.0 * v_escolhidas / v_n;

    WHEN 'score', 'numerico' THEN
      BEGIN
        v_nota := p_resposta::numeric;
        IF v_nota::text IN ('NaN','Infinity','-Infinity') OR v_nota < 0 OR v_nota > 10 THEN RETURN NULL; END IF;
      EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
      END;

    WHEN 'file' THEN
      v_nota := CASE WHEN COALESCE(btrim(p_arquivo), '') <> '' THEN 10 ELSE 0 END;

    ELSE
      /* `text`, `textarea`, `date` e o que vier a seguir: fora da conta.
         Pontuar texto livre por comprimento premeia quem escreve muito. */
      RETURN NULL;
  END CASE;

  RETURN CASE WHEN v_negativa THEN 10 - v_nota ELSE v_nota END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.calculate_due_diligence_score(assessment_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_peso_total numeric := 0;
  v_soma numeric := 0;
  v_score numeric := 0;
  v_classificacao text := 'ruim';
  v_contadas integer := 0;
  v_fora integer := 0;
  v_breakdown jsonb := '{}'::jsonb;
  v_nota_registo record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.due_diligence_assessments
     WHERE id = assessment_id_param AND status = 'concluido'
  ) THEN
    RAISE EXCEPTION 'Avaliação não encontrada ou não concluída: %', assessment_id_param;
  END IF;

  -- A nota de cada resposta fica gravada: é o que torna o score conferível.
  UPDATE public.due_diligence_responses r
     SET pontuacao = public.dd_nota_da_resposta(
           q.tipo, q.opcoes, q.configuracoes, COALESCE(NULLIF(btrim(r.resposta), ''), CASE WHEN q.tipo IN ('score','numerico') THEN r.pontuacao::text END),
           COALESCE(r.arquivo_url, r.resposta_arquivo_url)
         ),
         updated_at = now()
    FROM public.due_diligence_questions q
   WHERE q.id = r.question_id
     AND r.assessment_id = assessment_id_param;

  SELECT
    COALESCE(sum(r.pontuacao * CASE WHEN q.peso > 0 AND q.peso::text NOT IN ('NaN','Infinity') THEN q.peso ELSE 1 END) FILTER (WHERE r.pontuacao IS NOT NULL), 0),
    COALESCE(sum(CASE WHEN q.peso > 0 AND q.peso::text NOT IN ('NaN','Infinity') THEN q.peso ELSE 1 END)              FILTER (WHERE r.pontuacao IS NOT NULL), 0),
    count(*) FILTER (WHERE r.pontuacao IS NOT NULL),
    count(*) FILTER (WHERE r.pontuacao IS NULL)
    INTO v_soma, v_peso_total, v_contadas, v_fora
    FROM public.due_diligence_responses r
    JOIN public.due_diligence_questions q ON q.id = r.question_id
   WHERE r.assessment_id = assessment_id_param;

  IF v_peso_total = 0 THEN v_classificacao := NULL; END IF;
  IF v_peso_total > 0 THEN
    v_score := round((v_soma / v_peso_total) * 10, 2);
  END IF;

  IF    v_score >= 80 THEN v_classificacao := 'excelente';
  ELSIF v_score >= 60 THEN v_classificacao := 'bom';
  ELSIF v_score >= 40 THEN v_classificacao := 'regular';
  END IF;

  -- Por secção, com o mesmo peso: é o que o ecrã precisa para dizer ONDE dói.
  FOR v_nota_registo IN
    SELECT COALESCE(NULLIF(btrim(q.secao), ''), 'Geral') AS secao,
           round((sum(r.pontuacao * CASE WHEN q.peso > 0 AND q.peso::text NOT IN ('NaN','Infinity') THEN q.peso ELSE 1 END) / NULLIF(sum(CASE WHEN q.peso > 0 AND q.peso::text NOT IN ('NaN','Infinity') THEN q.peso ELSE 1 END), 0)) * 10, 2) AS score,
           count(*) AS perguntas
      FROM public.due_diligence_responses r
      JOIN public.due_diligence_questions q ON q.id = r.question_id
     WHERE r.assessment_id = assessment_id_param
       AND r.pontuacao IS NOT NULL
     GROUP BY 1
  LOOP
    v_breakdown := v_breakdown || jsonb_build_object(
      v_nota_registo.secao,
      jsonb_build_object('score', v_nota_registo.score, 'perguntas', v_nota_registo.perguntas)
    );
  END LOOP;

  INSERT INTO public.due_diligence_scores (
    assessment_id, score_total, score_breakdown, classificacao, observacoes_ia, created_at, updated_at
  ) VALUES (
    assessment_id_param, v_score, v_breakdown, v_classificacao,
    /* Cobertura, não parecer. O parecer é da `avaliar-fornecedor-ia`, que lê
       também o texto livre; aqui diz-se apenas sobre o que a conta se fez. */
    format('Índice do questionário, não certificação. Cálculo sobre %s resposta(s) pontuável(is); %s sem critério mensurável ou sem resposta válida ficaram fora. Consulte a cobertura antes de interpretar o score.', v_contadas, v_fora),
    now(), now()
  )
  ON CONFLICT (assessment_id) DO UPDATE SET
    score_total = EXCLUDED.score_total,
    score_breakdown = EXCLUDED.score_breakdown,
    classificacao = EXCLUDED.classificacao,
    observacoes_ia = EXCLUDED.observacoes_ia,
    updated_at = now();

  UPDATE public.due_diligence_assessments
     SET score_final = CASE WHEN v_peso_total > 0 THEN v_score ELSE NULL END, updated_at = now()
   WHERE id = assessment_id_param;
END;
$function$;


REVOKE ALL ON FUNCTION public.calculate_due_diligence_score(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_due_diligence_score(uuid) TO service_role;
