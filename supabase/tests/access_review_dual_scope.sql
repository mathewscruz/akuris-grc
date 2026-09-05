-- LOCAL ONLY. Run with the migration substituted below. Everything rolls back.
BEGIN;
-- APPLY_ACCESS_REVIEW_MIGRATION

INSERT INTO public.empresas (id,nome) VALUES ('a0000000-0000-4000-8000-000000000001','QA Review A'),('b0000000-0000-4000-8000-000000000001','QA Review B');
INSERT INTO auth.users(id,email) VALUES ('a0000000-0000-4000-8000-000000000002','qa-review@example.invalid');
INSERT INTO public.profiles(user_id,empresa_id,nome,email,role,preferred_locale) VALUES ('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','QA Reviewer','qa-review@example.invalid','admin','pt-BR');
INSERT INTO public.mfa_sessions(user_id,empresa_id) VALUES ('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001');
INSERT INTO public.sistemas_privilegiados(id,empresa_id,nome_sistema,tipo_sistema,ativo) VALUES
 ('a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','QA A','aplicacao',true),
 ('a0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','QA Empty','aplicacao',true),
 ('b0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000001','QA B','aplicacao',true);
INSERT INTO public.sistemas_usuarios(id,empresa_id,sistema_id,nome_usuario,email_usuario,ativo) VALUES
 ('a0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','Same person','same@example.invalid',true),
 ('a0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','Inactive','inactive@example.invalid',false),
 ('b0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000003','Foreign','foreign@example.invalid',true);
INSERT INTO public.contas_privilegiadas(id,empresa_id,sistema_id,usuario_beneficiario,email_beneficiario,tipo_acesso,nivel_privilegio,data_concessao,justificativa_negocio,status) VALUES
 ('a0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','Same person','same@example.invalid','administrativo','admin',CURRENT_DATE,'QA access','ativo'),
 ('a0000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','Revoked',NULL,'administrativo','admin',CURRENT_DATE,'QA revoked','revogado');

INSERT INTO public.sistemas_usuarios(id,empresa_id,sistema_id,nome_usuario,email_usuario,ativo,origem,origem_id)
VALUES('a0000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','Same person','same@example.invalid',true,'conta_privilegiada','a0000000-0000-4000-8000-000000000007');
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE campaign public.access_reviews; payload jsonb; before_count integer;
BEGIN
  payload := jsonb_build_object('nome_revisao','QA mixed campaign','tipo_revisao','periodica','sistema_id','a0000000-0000-4000-8000-000000000003','responsavel_revisao','a0000000-0000-4000-8000-000000000002','data_inicio',CURRENT_DATE,'data_limite',CURRENT_DATE+30);
  campaign := public.create_access_review('a0000000-0000-4000-8000-000000000001',payload);
  PERFORM set_config('qa.review_id',campaign.id::text,true);
  IF campaign.total_contas <> 2 THEN RAISE EXCEPTION 'FAIL: expected distinct directory user and privileged account, excluding inactive/revoked/foreign'; END IF;
  IF (SELECT count(*) FROM public.access_review_items WHERE review_id=campaign.id AND conta_id IS NOT NULL) <> 1 OR (SELECT count(*) FROM public.access_review_items WHERE review_id=campaign.id AND sistema_usuario_id IS NOT NULL) <> 1 THEN RAISE EXCEPTION 'FAIL: origin identities not preserved'; END IF;
  SELECT count(*) INTO before_count FROM public.access_reviews;
  BEGIN
    UPDATE public.access_reviews SET responsavel_revisao='b0000000-0000-4000-8000-000000000002' WHERE id=campaign.id;
    RAISE EXCEPTION 'FAIL: unavailable owner accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.access_reviews SET data_limite=CURRENT_DATE-1 WHERE id=campaign.id;
    RAISE EXCEPTION 'FAIL: inverted dates accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'REVIEW_INVALID_INPUT' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.create_access_review('a0000000-0000-4000-8000-000000000001',payload || '{"sistema_id":"a0000000-0000-4000-8000-000000000004"}'::jsonb);
    RAISE EXCEPTION 'FAIL: empty campaign accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'REVIEW_EMPTY_SCOPE' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.access_reviews) <> before_count THEN RAISE EXCEPTION 'FAIL: orphan campaign after failed create'; END IF;
  BEGIN
    PERFORM public.create_access_review('b0000000-0000-4000-8000-000000000001',payload);
    RAISE EXCEPTION 'FAIL: foreign company accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.access_review_items(review_id,sistema_usuario_id,usuario_beneficiario,tipo_acesso,nivel_privilegio) VALUES(campaign.id,'b0000000-0000-4000-8000-000000000005','foreign','leitura','usuario');
    RAISE EXCEPTION 'FAIL: foreign item accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.finalize_access_review(campaign.id);
    RAISE EXCEPTION 'FAIL: pending campaign finalized';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'REVIEW_PENDING_ITEMS' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.access_review_items SET decisao='modificar',justificativa_revisor='QA missing expiry' WHERE review_id=campaign.id AND conta_id IS NOT NULL;
    RAISE EXCEPTION 'FAIL: modify without expiry accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'REVIEW_EXPIRY_REQUIRED' THEN RAISE; END IF; END;
  UPDATE public.access_review_items SET decisao=CASE WHEN conta_id IS NOT NULL THEN 'modificar' ELSE 'revogar' END,
    nova_data_expiracao=CURRENT_DATE+60, justificativa_revisor='QA authorized review' WHERE review_id=campaign.id;
  PERFORM public.finalize_access_review(campaign.id);
  PERFORM public.finalize_access_review(campaign.id);
  IF (SELECT ativo FROM public.sistemas_usuarios WHERE id='a0000000-0000-4000-8000-000000000005') THEN RAISE EXCEPTION 'FAIL: directory user not revoked'; END IF;
  IF (SELECT data_expiracao FROM public.contas_privilegiadas WHERE id='a0000000-0000-4000-8000-000000000007') <> CURRENT_DATE+60 THEN RAISE EXCEPTION 'FAIL: privileged expiry not updated'; END IF;
  IF (SELECT data_expiracao FROM public.sistemas_usuarios WHERE id='a0000000-0000-4000-8000-000000000009') <> CURRENT_DATE+60 THEN RAISE EXCEPTION 'FAIL: explicit mirror expiry not updated'; END IF;
  IF (SELECT count(*) FROM public.access_review_history WHERE review_id=campaign.id) <> 2 THEN RAISE EXCEPTION 'FAIL: incomplete or duplicate history'; END IF;
  IF (SELECT count(*) FROM public.notifications WHERE metadata->>'review_id'=campaign.id::text) <> 1 THEN RAISE EXCEPTION 'FAIL: missing or duplicate notification'; END IF;
  BEGIN
    UPDATE public.access_review_items SET decisao='aprovar' WHERE review_id=campaign.id;
    RAISE EXCEPTION 'FAIL: finalized evidence changed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'REVIEW_CLOSED' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.access_reviews SET sistema_id='a0000000-0000-4000-8000-000000000004' WHERE id=campaign.id;
    RAISE EXCEPTION 'FAIL: campaign scope changed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'REVIEW_IMMUTABLE_SCOPE' THEN RAISE; END IF; END;
  RAISE NOTICE 'PASS: mixed scope, exact identities, tenant isolation, atomic creation, decisions, both effects, idempotence, history, closed guards';
END $test$;
RESET ROLE;

-- Cover the opposite effects too: directory expiry and privileged revocation.
UPDATE public.sistemas_usuarios SET ativo=true WHERE id='a0000000-0000-4000-8000-000000000005';
SET LOCAL ROLE authenticated;
DO $test$
DECLARE campaign public.access_reviews;
BEGIN
  campaign := public.create_access_review('a0000000-0000-4000-8000-000000000001', jsonb_build_object('nome_revisao','QA opposite effects','tipo_revisao','ad_hoc','sistema_id','a0000000-0000-4000-8000-000000000003','responsavel_revisao','a0000000-0000-4000-8000-000000000002','data_inicio',CURRENT_DATE,'data_limite',CURRENT_DATE+30));
  UPDATE public.access_review_items SET decisao=CASE WHEN conta_id IS NOT NULL THEN 'revogar' ELSE 'modificar' END, nova_data_expiracao=CURRENT_DATE+90, justificativa_revisor='QA opposite effects' WHERE review_id=campaign.id;
  PERFORM public.finalize_access_review(campaign.id);
  IF (SELECT status FROM public.contas_privilegiadas WHERE id='a0000000-0000-4000-8000-000000000007') <> 'revogado' THEN RAISE EXCEPTION 'FAIL: privileged account not revoked'; END IF;
  IF (SELECT ativo FROM public.sistemas_usuarios WHERE id='a0000000-0000-4000-8000-000000000009') THEN RAISE EXCEPTION 'FAIL: explicit privileged mirror still active'; END IF;
  IF (SELECT data_expiracao FROM public.sistemas_usuarios WHERE id='a0000000-0000-4000-8000-000000000005') <> CURRENT_DATE+90 THEN RAISE EXCEPTION 'FAIL: directory expiry not updated'; END IF;
END $test$;
RESET ROLE;

-- More than the API row cap; inject a failure AFTER an effect/history write.
INSERT INTO public.sistemas_usuarios(empresa_id,sistema_id,nome_usuario,ativo)
SELECT 'a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','QA bulk ' || n,true FROM generate_series(1,1001) n;
CREATE FUNCTION public.qa_review_history_failure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('qa.fail_history',true) = 'true' AND EXISTS(SELECT 1 FROM public.access_review_history WHERE review_id=NEW.review_id) THEN RAISE EXCEPTION 'QA_SYNTHETIC_HISTORY_FAILURE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER qa_review_history_failure BEFORE INSERT ON public.access_review_history FOR EACH ROW EXECUTE FUNCTION public.qa_review_history_failure();
SET LOCAL ROLE authenticated;
DO $test$
DECLARE campaign public.access_reviews;
BEGIN
  campaign := public.create_access_review('a0000000-0000-4000-8000-000000000001', jsonb_build_object('nome_revisao','QA 1002 accesses','tipo_revisao','periodica','sistema_id','a0000000-0000-4000-8000-000000000003','responsavel_revisao','a0000000-0000-4000-8000-000000000002','data_inicio',CURRENT_DATE,'data_limite',CURRENT_DATE+30));
  IF campaign.total_contas <> 1002 THEN RAISE EXCEPTION 'FAIL: batch silently truncated'; END IF;
  UPDATE public.access_review_items SET decisao='revogar',justificativa_revisor='QA bulk revocation' WHERE review_id=campaign.id;
  PERFORM set_config('qa.fail_history','true',true);
  BEGIN
    PERFORM public.finalize_access_review(campaign.id);
    RAISE EXCEPTION 'FAIL: expected history failure';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'QA_SYNTHETIC_HISTORY_FAILURE' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.sistemas_usuarios WHERE sistema_id=campaign.sistema_id AND ativo) <> 1002 THEN RAISE EXCEPTION 'FAIL: partial revocation survived rollback'; END IF;
  IF EXISTS(SELECT 1 FROM public.access_review_history WHERE review_id=campaign.id) THEN RAISE EXCEPTION 'FAIL: partial history survived rollback'; END IF;
  IF (SELECT status FROM public.access_reviews WHERE id=campaign.id) <> 'em_andamento' THEN RAISE EXCEPTION 'FAIL: failed transaction completed campaign'; END IF;
  PERFORM set_config('qa.fail_history','false',true);
  PERFORM public.finalize_access_review(campaign.id);
  IF (SELECT count(*) FROM public.access_review_history WHERE review_id=campaign.id) <> 1002 THEN RAISE EXCEPTION 'FAIL: finalization truncated'; END IF;
  RAISE NOTICE 'PASS: 1002 accesses, rollback after partial effects, full finalization';
END $test$;
RESET ROLE;

-- MFA must be enforced by the RPC, including when no readable source exists.
UPDATE public.mfa_sessions SET expires_at=now()-interval '1 minute' WHERE user_id='a0000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $test$ BEGIN
  BEGIN
    PERFORM public.finalize_access_review(current_setting('qa.review_id')::uuid);
    RAISE EXCEPTION 'FAIL: missing MFA accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF has_function_privilege('anon','public.create_access_review(uuid,jsonb)','EXECUTE') OR has_function_privilege('anon','public.finalize_access_review(uuid)','EXECUTE') THEN RAISE EXCEPTION 'FAIL: anonymous RPC execution granted'; END IF;
  RAISE NOTICE 'PASS: MFA and anonymous-execution protection';
END $test$;
RESET ROLE;
ROLLBACK;
