DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.integracao_registrar_riscos(uuid,uuid,text,jsonb,text[])'::regprocedure);
  d := replace(d, $x$    FOR u IN SELECT DISTINCT p.user_id FROM profiles p JOIN user_roles r ON r.user_id = p.user_id
             WHERE p.empresa_id = p_empresa AND p.ativo AND r.role::text IN ('admin','super_admin') LOOP
      PERFORM criar_notificacao(u, 'Riscos sugeridos pelas integrações', novos || ' nova(s) sugestão(ões) para análise',
        'warning', '/riscos?view=sugeridos', jsonb_build_object('provider', p_provider));
    END LOOP;$x$,
  $x$    -- Server-side job (no user session): write the bell notice directly, same company, honouring the bell opt-out.
    INSERT INTO notifications (user_id, title, message, type, link_to, metadata)
    SELECT DISTINCT p.user_id, 'Riscos sugeridos pelas integrações', novos || ' nova(s) sugestão(ões) para análise',
      'warning', '/riscos?view=sugeridos', jsonb_build_object('provider', p_provider, 'connection_id', p_connection)
    FROM profiles p JOIN user_roles r ON r.user_id = p.user_id
    WHERE p.empresa_id = p_empresa AND p.ativo AND p.notificar_na_aplicacao IS NOT FALSE AND r.role::text IN ('admin','super_admin');$x$);
  IF position('INSERT INTO notifications' in d) = 0 THEN RAISE EXCEPTION 'patch failed'; END IF;
  EXECUTE d;
END $do$;