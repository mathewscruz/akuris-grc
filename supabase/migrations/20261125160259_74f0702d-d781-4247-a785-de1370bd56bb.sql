CREATE OR REPLACE FUNCTION public.integracao_registrar_riscos(p_empresa uuid, p_connection uuid, p_provider text, p_achados jsonb, p_cobertas text[])
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a jsonb; novos int := 0; u uuid; chaves text[] := '{}'; prev integracao_riscos_sugeridos; v_reab boolean;
  v_rel int; v_regra text; v_chave text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM integration_connections WHERE id = p_connection AND empresa_id = p_empresa) THEN
    RAISE EXCEPTION 'connection_mismatch';
  END IF;
  -- Serialise runs of the same connection so transitions are decided once, even on retries/concurrency.
  PERFORM pg_advisory_xact_lock(hashtextextended('integracao_riscos:' || p_connection::text, 0));
  FOR a IN SELECT * FROM jsonb_array_elements(coalesce(p_achados,'[]'::jsonb)) LOOP
    v_regra := a->>'regra_id'; v_chave := coalesce(a->>'chave','');
    IF v_regra IS NULL THEN CONTINUE; END IF;
    chaves := chaves || (v_regra || '|' || v_chave);
    v_rel := CASE WHEN (a->>'relevancia') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN least(greatest(round((a->>'relevancia')::numeric), 0), 2147483647)::int ELSE 0 END;
    SELECT * INTO prev FROM integracao_riscos_sugeridos
      WHERE empresa_id = p_empresa AND connection_id = p_connection AND regra_id = v_regra AND chave = v_chave FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO integracao_riscos_sugeridos (empresa_id, connection_id, provider, regra_id, chave, fonte, severidade_tecnica,
        relevancia, alcance, evidencia, probabilidade, impacto)
      VALUES (p_empresa, p_connection, p_provider, v_regra, v_chave, a->>'fonte', a->>'severidade', v_rel,
        coalesce(a->'alcance','{}'), coalesce(a->'evidencia','{}'), (a->>'probabilidade')::int, (a->>'impacto')::int);
      novos := novos + 1;
      CONTINUE;
    END IF;
    v_reab := prev.estado = 'corrigida'
      OR (prev.estado = 'descartada' AND prev.suprimido_ate IS NOT NULL AND prev.suprimido_ate < current_date);
    UPDATE integracao_riscos_sugeridos SET
      evidencia = coalesce(a->'evidencia','{}'), alcance = coalesce(a->'alcance','{}'), fonte = a->>'fonte',
      severidade_tecnica = a->>'severidade', relevancia = v_rel,
      probabilidade = (a->>'probabilidade')::int, impacto = (a->>'impacto')::int,
      ultima_deteccao = now(), updated_at = now(),
      recorrencias = recorrencias + CASE WHEN v_reab THEN 1 ELSE 0 END,
      estado = CASE WHEN NOT v_reab THEN estado WHEN risco_id IS NOT NULL THEN 'aceita' ELSE 'aberta' END,
      suprimido_ate = CASE WHEN v_reab AND prev.estado = 'descartada' THEN NULL ELSE suprimido_ate END,
      corrigida_em = CASE WHEN v_reab THEN NULL ELSE corrigida_em END
    WHERE id = prev.id;
    IF v_reab THEN novos := novos + 1; END IF;
  END LOOP;
  -- Only rules evaluated with complete coverage in this run may be marked fixed; history is never deleted.
  UPDATE integracao_riscos_sugeridos SET estado = 'corrigida', corrigida_em = now(), updated_at = now()
  WHERE empresa_id = p_empresa AND connection_id = p_connection AND estado IN ('aberta','aceita')
    AND regra_id = ANY(coalesce(p_cobertas,'{}')) AND NOT ((regra_id || '|' || chave) = ANY(chaves));
  -- One aggregated bell notice per run, only for real new or reopened suggestions.
  IF novos > 0 THEN
    FOR u IN SELECT DISTINCT p.user_id FROM profiles p JOIN user_roles r ON r.user_id = p.user_id
             WHERE p.empresa_id = p_empresa AND p.ativo AND r.role::text IN ('admin','super_admin') LOOP
      PERFORM criar_notificacao(u, 'Riscos sugeridos pelas integrações', novos || ' nova(s) sugestão(ões) para análise',
        'warning', '/riscos?view=sugeridos', jsonb_build_object('provider', p_provider));
    END LOOP;
  END IF;
  RETURN novos;
END $$;
REVOKE ALL ON FUNCTION public.integracao_registrar_riscos(uuid,uuid,text,jsonb,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integracao_registrar_riscos(uuid,uuid,text,jsonb,text[]) TO service_role;