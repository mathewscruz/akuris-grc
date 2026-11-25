ALTER TABLE public.integracao_riscos_sugeridos
  ADD COLUMN chave text NOT NULL DEFAULT '',
  ADD COLUMN fonte text,
  ADD COLUMN severidade_tecnica text,
  ADD COLUMN relevancia int NOT NULL DEFAULT 0,
  ADD COLUMN alcance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN suprimido_ate date,
  ADD COLUMN recorrencias int NOT NULL DEFAULT 0;
ALTER TABLE public.integracao_riscos_sugeridos DROP CONSTRAINT integracao_riscos_sugeridos_connection_id_fkey;
ALTER TABLE public.integracao_riscos_sugeridos ALTER COLUMN connection_id DROP NOT NULL;
ALTER TABLE public.integracao_riscos_sugeridos ADD CONSTRAINT integracao_riscos_sugeridos_connection_id_fkey
  FOREIGN KEY (connection_id) REFERENCES public.integration_connections(id) ON DELETE SET NULL;
ALTER TABLE public.integracao_riscos_sugeridos DROP CONSTRAINT integracao_riscos_sugeridos_empresa_id_connection_id_regra__key;
ALTER TABLE public.integracao_riscos_sugeridos ADD CONSTRAINT integracao_riscos_sugeridos_origem_key UNIQUE (empresa_id, connection_id, regra_id, chave);

DROP FUNCTION public.integracao_registrar_riscos(uuid,uuid,text,jsonb,text[]);
-- p_cobertas: rules evaluated with complete coverage in this run; only these may be marked fixed.
CREATE FUNCTION public.integracao_registrar_riscos(p_empresa uuid, p_connection uuid, p_provider text, p_achados jsonb, p_cobertas text[])
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a jsonb; novos int := 0; v_ins boolean; v_reab boolean; u uuid; chaves text[] := '{}'; corrigidos int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM integration_connections WHERE id = p_connection AND empresa_id = p_empresa) THEN
    RAISE EXCEPTION 'connection_mismatch';
  END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(coalesce(p_achados,'[]'::jsonb)) LOOP
    chaves := chaves || ((a->>'regra_id') || '|' || coalesce(a->>'chave',''));
    INSERT INTO integracao_riscos_sugeridos AS s (empresa_id, connection_id, provider, regra_id, chave, fonte, severidade_tecnica,
      relevancia, alcance, evidencia, probabilidade, impacto)
    VALUES (p_empresa, p_connection, p_provider, a->>'regra_id', coalesce(a->>'chave',''), a->>'fonte', a->>'severidade',
      coalesce((a->>'relevancia')::int,0), coalesce(a->'alcance','{}'), coalesce(a->'evidencia','{}'), (a->>'probabilidade')::int, (a->>'impacto')::int)
    ON CONFLICT (empresa_id, connection_id, regra_id, chave) DO UPDATE SET
      evidencia = excluded.evidencia, alcance = excluded.alcance, fonte = excluded.fonte,
      severidade_tecnica = excluded.severidade_tecnica, relevancia = excluded.relevancia,
      probabilidade = excluded.probabilidade, impacto = excluded.impacto, ultima_deteccao = now(), updated_at = now(),
      recorrencias = s.recorrencias + CASE WHEN s.estado = 'corrigida' OR (s.estado = 'descartada' AND s.suprimido_ate IS NOT NULL AND s.suprimido_ate < current_date) THEN 1 ELSE 0 END,
      estado = CASE
        WHEN s.estado = 'corrigida' THEN CASE WHEN s.risco_id IS NOT NULL THEN 'aceita' ELSE 'aberta' END
        WHEN s.estado = 'descartada' AND s.suprimido_ate IS NOT NULL AND s.suprimido_ate < current_date THEN 'aberta'
        ELSE s.estado END,
      corrigida_em = NULL
    RETURNING (xmax = 0), (s.estado = 'aberta' AND s.recorrencias > 0 AND s.ultima_deteccao = now()) INTO v_ins, v_reab;
    IF v_ins OR v_reab THEN novos := novos + 1; END IF;
  END LOOP;
  UPDATE integracao_riscos_sugeridos SET estado = 'corrigida', corrigida_em = now(), updated_at = now()
  WHERE empresa_id = p_empresa AND connection_id = p_connection AND estado IN ('aberta','aceita')
    AND regra_id = ANY(coalesce(p_cobertas,'{}')) AND NOT ((regra_id || '|' || chave) = ANY(chaves));
  GET DIAGNOSTICS corrigidos = ROW_COUNT;
  -- One aggregated bell notice per run, never per item.
  IF novos > 0 OR corrigidos > 0 THEN
    FOR u IN SELECT DISTINCT p.user_id FROM profiles p JOIN user_roles r ON r.user_id = p.user_id
             WHERE p.empresa_id = p_empresa AND r.role::text IN ('admin','super_admin') LOOP
      PERFORM criar_notificacao(u, 'Riscos sugeridos pelas integrações',
        concat_ws(' · ', CASE WHEN novos > 0 THEN novos || ' nova(s) sugestão(ões) para análise' END,
                         CASE WHEN corrigidos > 0 THEN corrigidos || ' corrigida(s) na origem' END),
        'warning', '/riscos?view=sugeridos', jsonb_build_object('provider', p_provider));
    END LOOP;
  END IF;
  RETURN novos;
END $$;
REVOKE ALL ON FUNCTION public.integracao_registrar_riscos(uuid,uuid,text,jsonb,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integracao_registrar_riscos(uuid,uuid,text,jsonb,text[]) TO service_role;

DROP FUNCTION public.descartar_risco_sugerido(uuid,text);
CREATE FUNCTION public.descartar_risco_sugerido(p_id uuid, p_motivo text, p_ate date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_valid_mfa_session() OR NOT usuario_tem_permissao_modulo('riscos','update') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF p_ate IS NOT NULL AND p_ate <= current_date THEN RAISE EXCEPTION 'invalid_date'; END IF;
  UPDATE integracao_riscos_sugeridos SET estado = 'descartada', motivo_descarte = left(p_motivo, 1000), suprimido_ate = p_ate,
    decidido_por = auth.uid(), decidido_em = now(), updated_at = now()
  WHERE id = p_id AND empresa_id = get_user_empresa_id() AND estado = 'aberta';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.descartar_risco_sugerido(uuid,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.descartar_risco_sugerido(uuid,text,date) TO authenticated;

-- Idempotent accept: a second call for the same suggestion returns the already-created risk.
CREATE OR REPLACE FUNCTION public.aceitar_risco_sugerido(p_id uuid, p_nome text, p_descricao text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s integracao_riscos_sugeridos; v_emp uuid := get_user_empresa_id(); v_risco uuid; nivel text;
BEGIN
  IF NOT has_valid_mfa_session() OR NOT usuario_tem_permissao_modulo('riscos','create') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO s FROM integracao_riscos_sugeridos WHERE id = p_id AND empresa_id = v_emp FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF s.risco_id IS NOT NULL THEN RETURN s.risco_id; END IF;
  IF s.estado <> 'aberta' THEN RAISE EXCEPTION 'already_decided'; END IF;
  IF coalesce(trim(p_nome),'') = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  nivel := CASE WHEN s.probabilidade * s.impacto >= 20 THEN 'Crítico' WHEN s.probabilidade * s.impacto >= 12 THEN 'Alto'
                WHEN s.probabilidade * s.impacto >= 6 THEN 'Médio' ELSE 'Baixo' END;
  INSERT INTO riscos (empresa_id, nome, descricao, probabilidade_inicial, impacto_inicial, nivel_risco_inicial, status)
  VALUES (v_emp, left(p_nome, 300), left(p_descricao, 4000), s.probabilidade::text, s.impacto::text, nivel, 'identificado')
  RETURNING id INTO v_risco;
  UPDATE integracao_riscos_sugeridos SET estado = 'aceita', risco_id = v_risco, decidido_por = auth.uid(), decidido_em = now(), updated_at = now() WHERE id = p_id;
  RETURN v_risco;
END $$;