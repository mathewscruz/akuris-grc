-- Local-only regression fixtures. No account, business assessment or credit
-- mutation survives this transaction. Run against supabase_db_akuris-local.
BEGIN;
DO $$
DECLARE tenant uuid; actor uuid; framework uuid; req uuid; evaluation uuid;
 template uuid; assessment uuid; question uuid; measured numeric;
 matrix record; p integer; i integer; expected integer; risk_result record; cells integer := 0;
 job jsonb; jid uuid; attempt int; charged_before integer; result jsonb := '{"verdict":"indeterminado"}';
BEGIN
 SELECT p.empresa_id,p.user_id INTO tenant,actor FROM public.profiles p
 JOIN auth.users u ON u.id=p.user_id WHERE p.ativo AND p.empresa_id IS NOT NULL LIMIT 1;
 ASSERT actor IS NOT NULL, 'Local fixture user required';
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 PERFORM set_config('request.jwt.claim.sub','',true);
 INSERT INTO public.gap_analysis_frameworks(nome,empresa_id) VALUES('QA scoring - rolled back',tenant) RETURNING id INTO framework;
 INSERT INTO public.gap_analysis_requirements(framework_id,titulo,codigo,peso)
 VALUES(framework,'Compliant','QA-A',3) RETURNING id INTO req;
 INSERT INTO public.gap_analysis_evaluations(framework_id,requirement_id,empresa_id,conformity_status)
 VALUES(framework,req,tenant,'parcial') RETURNING id INTO evaluation;
 INSERT INTO public.gap_analysis_requirements(framework_id,titulo,codigo,peso)
 VALUES(framework,'Other','QA-B',1) RETURNING id INTO question;
 INSERT INTO public.gap_analysis_evaluations(framework_id,requirement_id,empresa_id,conformity_status)
 VALUES(framework,question,tenant,'conforme');
 SELECT score INTO measured FROM public.gap_calcula_score_framework(framework,tenant);
 ASSERT measured=63, 'SQL must match JS: (3*50+1*100)/4 rounds to 63';
 INSERT INTO public.gap_analysis_soa(framework_id,requirement_id,empresa_id,aplicavel,justificativa)
 VALUES(framework,question,tenant,false,'QA: outside declared scope');
 SELECT score INTO measured FROM public.gap_calcula_score_framework(framework,tenant);
 ASSERT measured=50, 'SoA must affect numerator and denominator';
 UPDATE public.gap_analysis_requirements SET peso=0 WHERE id=req;
 SELECT score INTO measured FROM public.gap_calcula_score_framework(framework,tenant);
 ASSERT measured=50, 'Legacy zero weight defaults to 1 consistently';

 -- All configured risk cells: current SQL must honor the saved method and bands.
 FOR matrix IN SELECT * FROM public.riscos_matriz_configuracao LOOP
   FOR p IN SELECT (v->>'valor')::integer FROM jsonb_array_elements(matrix.escala_probabilidade) v LOOP
     FOR i IN SELECT (v->>'valor')::integer FROM jsonb_array_elements(matrix.escala_impacto) v LOOP
       expected := CASE WHEN matrix.metodo_calculo='soma' THEN p+i ELSE p*i END;
       SELECT * INTO risk_result FROM public.risco_avaliar_na_matriz(matrix.matriz_id,p::smallint,i::smallint);
       ASSERT risk_result.score=expected, 'Risk matrix score differs from configured method';
       ASSERT risk_result.nivel IS NOT NULL, 'A configured risk cell has no severity band';
       cells := cells + 1;
     END LOOP;
   END LOOP;
   SELECT * INTO risk_result FROM public.risco_avaliar_na_matriz(matrix.matriz_id,NULL::smallint,1::smallint);
   ASSERT risk_result.score IS NULL, 'Missing likelihood must not become a zero risk';
 END LOOP;
 ASSERT cells > 0, 'At least one local risk matrix is required';
 RAISE NOTICE 'Validated % configured risk cells', cells;

 ASSERT public.dd_nota_da_resposta('radio','["Sim","Não"]','{}','Sim',NULL)=10;
 ASSERT public.dd_nota_da_resposta('radio','["Sim","Não"]','{"polaridade":"negativa"}','Sim',NULL)=0;
 ASSERT public.dd_nota_da_resposta('checkbox','["AWS","AWS Backup"]','{}','AWS Backup',NULL)=5, 'Substring matching inflated score';
 ASSERT public.dd_nota_da_resposta('checkbox','["%","AWS"]','{}','AWS',NULL)=5, 'SQL wildcard must be literal';
 ASSERT public.dd_nota_da_resposta('score',NULL,'{}','0',NULL)=0;
 ASSERT public.dd_nota_da_resposta('score',NULL,'{}','NaN',NULL) IS NULL;
 ASSERT public.dd_nota_da_resposta('score',NULL,'{}','Infinity',NULL) IS NULL;
 ASSERT public.dd_nota_da_resposta('score',NULL,'{}','11',NULL) IS NULL;

 INSERT INTO public.due_diligence_templates(empresa_id,nome) VALUES(tenant,'QA scores') RETURNING id INTO template;
 INSERT INTO public.due_diligence_assessments(empresa_id,template_id,fornecedor_nome,fornecedor_email,link_token,status)
 VALUES(tenant,template,'QA vendor','qa@example.invalid',replace(gen_random_uuid()::text,'-',''),'enviado') RETURNING id INTO assessment;
 INSERT INTO public.due_diligence_questions(template_id,titulo,tipo,peso)
 VALUES(template,'Raw numerical answer','score',1) RETURNING id INTO question;
 INSERT INTO public.due_diligence_responses(assessment_id,question_id,resposta,pontuacao) VALUES(assessment,question,NULL,7.5);
 UPDATE public.due_diligence_assessments SET status='concluido' WHERE id=assessment;
 PERFORM public.calculate_due_diligence_score(assessment);
 ASSERT (SELECT score_final FROM public.due_diligence_assessments WHERE id=assessment)=75, 'Legacy numerical raw answer must survive recalculation';
 UPDATE public.due_diligence_responses SET resposta='0',pontuacao=0 WHERE assessment_id=assessment;
 PERFORM public.calculate_due_diligence_score(assessment);
 ASSERT (SELECT score_final FROM public.due_diligence_assessments WHERE id=assessment)=0, 'Zero is a measured score';
 UPDATE public.due_diligence_questions SET tipo='text' WHERE id=question;
 PERFORM public.calculate_due_diligence_score(assessment);
 ASSERT (SELECT score_final FROM public.due_diligence_assessments WHERE id=assessment) IS NULL, 'No measurable questions is not a score of zero';

 -- Credit quota changes are transaction-only and fully rolled back.
 UPDATE public.empresas SET plano_id=(SELECT id FROM public.planos WHERE creditos_franquia>=10 LIMIT 1),creditos_consumidos=0 WHERE id=tenant;
 ASSERT (SELECT plano_id IS NOT NULL FROM public.empresas WHERE id=tenant), 'Local credit plan required';
 SELECT creditos_consumidos INTO charged_before FROM public.empresas WHERE id=tenant;
 job:=public.evidence_analysis_claim(tenant,actor,req,'qa-billing','hash','test');
 jid:=(job->'job'->>'id')::uuid;
 BEGIN
  PERFORM public.evidence_analysis_finish(jid,1,'complete','{}'); RAISE EXCEPTION 'Invalid result accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_result' THEN RAISE; END IF; END;
 ASSERT (SELECT creditos_consumidos FROM public.empresas WHERE id=tenant)=charged_before, 'Invalid output must not charge';
 BEGIN
  PERFORM public.evidence_analysis_finish(jid,1,'complete','{"verdict":null}'); RAISE EXCEPTION 'Null verdict accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_result' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.evidence_analysis_finish(jid,NULL,'complete',result); RAISE EXCEPTION 'Missing lease accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'lease_lost' THEN RAISE; END IF; END;
 PERFORM public.evidence_analysis_finish(jid,1,'error',NULL,NULL,'analysis_failed');
 job:=public.evidence_analysis_claim(tenant,actor,req,'qa-billing','hash','test');
 attempt:=(job->'job'->>'attempt')::int;
 ASSERT attempt=2;
 PERFORM public.evidence_analysis_finish(jid,attempt,'complete',result);
 PERFORM public.evidence_analysis_finish(jid,attempt,'complete',result);
 ASSERT (SELECT creditos_consumidos FROM public.empresas WHERE id=tenant)=charged_before+1, 'Retry then repeated completion must debit exactly once';
 job:=public.evidence_analysis_claim(tenant,actor,req,'qa-billing','hash','test');
 ASSERT (job->>'cached')::boolean, 'Cached read must not debit';
 UPDATE public.evidence_analysis_jobs SET updated_at=now()-interval '8 days',attempt_window_started_at=now()-interval '8 days' WHERE id=jid;
 job:=public.evidence_analysis_claim(tenant,actor,req,'qa-billing','hash','test');
 ASSERT (job->'job'->>'attempt')::int=3, 'Lease generation must never reset';
 BEGIN
  PERFORM public.evidence_analysis_finish(jid,1,'complete',result); RAISE EXCEPTION 'Stale worker accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'lease_lost' THEN RAISE; END IF; END;
 UPDATE public.empresas e SET creditos_consumidos=p.creditos_franquia FROM public.planos p WHERE e.id=tenant AND p.id=e.plano_id;
 BEGIN
  PERFORM public.evidence_analysis_finish(jid,3,'complete',result); RAISE EXCEPTION 'Over quota accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'credits_exhausted' THEN RAISE; END IF; END;
 ASSERT (SELECT status FROM public.evidence_analysis_jobs WHERE id=jid)='running', 'Failed debit must roll back completion';
 RAISE NOTICE 'PASS: SQL/JS score parity, scope, weights, exact options, zero, missing measurements, single debit, retry, cache, monotonic leases and quota rollback';
END $$;
ROLLBACK;
