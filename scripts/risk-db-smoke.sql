\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claim.sub', '9212519c-d450-4fc8-ad7b-e8d05bc5659a', true);
SELECT set_config('request.jwt.claims', '{"sub":"9212519c-d450-4fc8-ad7b-e8d05bc5659a","role":"authenticated","aal":"aal2"}', true);

DO $$
DECLARE
  v_risco constant uuid := '95e9ca8b-3915-4ac0-93bc-405944970f0a';
  v_empresa constant uuid := '6c3ebb8f-c182-4006-8252-5c970ad295a6';
  v_user constant uuid := '9212519c-d450-4fc8-ad7b-e8d05bc5659a';
  v_tratamento uuid;
  v_tratamento_legado uuid;
  v_plano_legado uuid;
  v_kri uuid;
  v_status text;
  v_proxima date;
BEGIN
  v_tratamento := public.salvar_tratamento_risco(
    v_risco, NULL, 'mitigar', 'Teste transacional de QA', v_user,
    100, current_date + 30, current_date, 'pendente', NULL
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.planos_acao
    WHERE tratamento_risco_id = v_tratamento AND registro_origem_id = v_risco
  ) THEN
    RAISE EXCEPTION 'PLANO_NAO_CRIADO_COM_TRATAMENTO';
  END IF;
  SELECT status INTO v_status FROM public.riscos WHERE id = v_risco;
  IF v_status <> 'em_tratamento' THEN
    RAISE EXCEPTION 'STATUS_NAO_DERIVADO: %', v_status;
  END IF;
  RAISE NOTICE 'tratamento_plano_status_ok';

  UPDATE public.planos_acao SET status = 'concluido'
   WHERE tratamento_risco_id = v_tratamento;
  IF NOT EXISTS (
    SELECT 1 FROM public.riscos_tratamentos
    WHERE id = v_tratamento AND status = 'concluído'
  ) OR (SELECT status FROM public.riscos WHERE id = v_risco) <> 'tratado' THEN
    RAISE EXCEPTION 'SINCRONIZACAO_PLANO_TRATAMENTO_FALHOU';
  END IF;
  RAISE NOTICE 'plano_tratamento_bidirecional_ok';

  INSERT INTO public.riscos_tratamentos (
    risco_id, tipo_tratamento, descricao, responsavel, status
  ) VALUES (
    v_risco, 'mitigar', 'Teste de responsável legado', 'Equipe legada', 'pendente'
  ) RETURNING id INTO v_tratamento_legado;
  INSERT INTO public.planos_acao (
    empresa_id, titulo, descricao, modulo_origem, registro_origem_id,
    registro_origem_titulo, tratamento_risco_id
  ) VALUES (
    v_empresa, 'Plano legado de QA', 'Teste de responsável legado', 'riscos',
    v_risco, 'Teste transacional', v_tratamento_legado
  ) RETURNING id INTO v_plano_legado;
  UPDATE public.planos_acao SET descricao = 'Plano legado atualizado'
   WHERE id = v_plano_legado;
  IF (SELECT responsavel FROM public.riscos_tratamentos WHERE id = v_tratamento_legado)
     <> 'Equipe legada' THEN
    RAISE EXCEPTION 'RESPONSAVEL_LEGADO_FOI_APAGADO';
  END IF;
  RAISE NOTICE 'responsavel_legado_preservado_ok';

  INSERT INTO public.riscos_kris (
    empresa_id, risco_id, nome, unidade, limite, periodicidade, created_by
  ) VALUES (
    v_empresa, v_risco, '__qa_kri__', '%', 10, 'mensal', v_user
  ) RETURNING id INTO v_kri;
  INSERT INTO public.riscos_kri_medicoes (kri_id, empresa_id, valor, medido_por)
  VALUES (v_kri, v_empresa, 12, v_user);
  SELECT proxima_medicao INTO v_proxima FROM public.riscos_kris WHERE id = v_kri;
  IF v_proxima <> (current_date + interval '1 month')::date THEN
    RAISE EXCEPTION 'PROXIMA_MEDICAO_INCORRETA: %', v_proxima;
  END IF;
  RAISE NOTICE 'kri_medicao_agendamento_ok';

  BEGIN
    UPDATE public.riscos_matriz_configuracao c
       SET apetite_score = COALESCE(c.apetite_score, 0) + 1
     WHERE c.matriz_id = '96e33629-3a8a-45ae-8cdf-2eb52c89989a';
    RAISE EXCEPTION 'MATRIZ_PUBLICADA_FOI_ALTERADA';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'MATRIZ_PUBLICADA_IMUTAVEL_USE_NOVA_VERSAO' THEN RAISE; END IF;
    RAISE NOTICE 'matriz_imutavel_ok';
  END;

  BEGIN
    UPDATE public.riscos
       SET status_aceite = 'pendente', aprovador_aceite = v_user
     WHERE id = v_risco;
    RAISE EXCEPTION 'AUTO_ACEITE_FOI_PERMITIDO';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ACEITE_PELO_PROPRIO_SOLICITANTE' THEN RAISE; END IF;
    RAISE NOTICE 'segregacao_aceite_ok';
  END;

  BEGIN
    UPDATE public.riscos
       SET status_aceite = 'aprovado', aceito = true
     WHERE id = v_risco;
    RAISE EXCEPTION 'ACEITE_PULOU_ESTADO_PENDENTE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ACEITE_DEVE_ESTAR_PENDENTE' THEN RAISE; END IF;
    RAISE NOTICE 'aceite_exige_fila_e_aprovador_ok';
  END;

  PERFORM public.arquivar_risco(v_risco, 'Teste de QA');
  IF NOT EXISTS (
    SELECT 1 FROM public.riscos
    WHERE id = v_risco AND status = 'arquivado' AND arquivado_em IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ARQUIVAMENTO_FALHOU';
  END IF;
  RAISE NOTICE 'arquivamento_preserva_registro_ok';
END;
$$;
ROLLBACK;
