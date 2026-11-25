DROP FUNCTION public.integracao_registrar_riscos(uuid,uuid,text,jsonb);
CREATE FUNCTION public.integracao_registrar_riscos(p_empresa uuid, p_connection uuid, p_provider text, p_achados jsonb, p_cobertas text[])
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a jsonb; novos int := 0; v_ins boolean; u uuid; ids text[] := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM integration_connections WHERE id = p_connection AND empresa_id = p_empresa) THEN
    RAISE EXCEPTION 'connection_mismatch';
  END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(coalesce(p_achados,'[]'::jsonb)) LOOP
    ids := ids || (a->>'regra_id');
    INSERT INTO integracao_riscos_sugeridos AS s (empresa_id, connection_id, provider, regra_id, evidencia, probabilidade, impacto)
    VALUES (p_empresa, p_connection, p_provider, a->>'regra_id', coalesce(a->'evidencia','{}'), (a->>'probabilidade')::int, (a->>'impacto')::int)
    ON CONFLICT (empresa_id, connection_id, regra_id) DO UPDATE SET
      evidencia = excluded.evidencia, ultima_deteccao = now(), updated_at = now(),
      probabilidade = excluded.probabilidade, impacto = excluded.impacto,
      estado = CASE WHEN s.estado = 'corrigida' THEN CASE WHEN s.risco_id IS NOT NULL THEN 'aceita' ELSE 'aberta' END ELSE s.estado END,
      corrigida_em = NULL
    RETURNING (xmax = 0) INTO v_ins;
    IF v_ins THEN novos := novos + 1; END IF;
  END LOOP;
  FOR u IN
    UPDATE integracao_riscos_sugeridos SET estado = 'corrigida', corrigida_em = now(), updated_at = now()
    WHERE empresa_id = p_empresa AND connection_id = p_connection AND estado IN ('aberta','aceita')
      AND regra_id = ANY(coalesce(p_cobertas,'{}')) AND NOT (regra_id = ANY(ids))
    RETURNING decidido_por
  LOOP
    IF u IS NOT NULL THEN
      PERFORM criar_notificacao(u, 'Risco corrigido na origem', 'Uma falha detectada pela integração deixou de aparecer. Reveja o risco ligado.', 'info', '/riscos?tab=sugeridos', '{}'::jsonb);
    END IF;
  END LOOP;
  IF novos > 0 THEN
    FOR u IN SELECT DISTINCT p.user_id FROM profiles p JOIN user_roles r ON r.user_id = p.user_id
             WHERE p.empresa_id = p_empresa AND r.role::text IN ('admin','super_admin') LOOP
      PERFORM criar_notificacao(u, 'Novos riscos sugeridos', novos || ' falha(s) de configuração encontrada(s) pela integração.', 'warning', '/riscos?tab=sugeridos', jsonb_build_object('provider', p_provider));
    END LOOP;
  END IF;
  RETURN novos;
END $$;
REVOKE ALL ON FUNCTION public.integracao_registrar_riscos(uuid,uuid,text,jsonb,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integracao_registrar_riscos(uuid,uuid,text,jsonb,text[]) TO service_role;