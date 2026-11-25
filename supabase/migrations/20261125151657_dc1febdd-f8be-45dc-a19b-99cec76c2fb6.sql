CREATE TABLE public.integracao_riscos_sugeridos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  provider text NOT NULL,
  regra_id text NOT NULL,
  evidencia jsonb NOT NULL DEFAULT '{}'::jsonb,
  probabilidade int NOT NULL,
  impacto int NOT NULL,
  estado text NOT NULL DEFAULT 'aberta',
  risco_id uuid REFERENCES public.riscos(id) ON DELETE SET NULL,
  motivo_descarte text,
  decidido_por uuid,
  decidido_em timestamptz,
  primeira_deteccao timestamptz NOT NULL DEFAULT now(),
  ultima_deteccao timestamptz NOT NULL DEFAULT now(),
  corrigida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, connection_id, regra_id)
);
GRANT SELECT ON public.integracao_riscos_sugeridos TO authenticated;
GRANT ALL ON public.integracao_riscos_sugeridos TO service_role;
ALTER TABLE public.integracao_riscos_sugeridos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver sugestões da própria empresa" ON public.integracao_riscos_sugeridos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.has_valid_mfa_session()
         AND public.usuario_tem_permissao_modulo('riscos','read'));
CREATE INDEX ON public.integracao_riscos_sugeridos (empresa_id, estado);

-- Server only: upsert findings of one connection, mark vanished ones as fixed, notify admins of new ones.
CREATE OR REPLACE FUNCTION public.integracao_registrar_riscos(p_empresa uuid, p_connection uuid, p_provider text, p_achados jsonb)
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
  -- Vanished findings: fixed at the source (risk itself is never closed automatically).
  FOR u IN
    UPDATE integracao_riscos_sugeridos SET estado = 'corrigida', corrigida_em = now(), updated_at = now()
    WHERE empresa_id = p_empresa AND connection_id = p_connection AND estado IN ('aberta','aceita')
      AND NOT (regra_id = ANY(ids))
    RETURNING decidido_por
  LOOP
    IF u IS NOT NULL THEN
      PERFORM criar_notificacao(u, 'Risco corrigido na origem', 'Uma falha detectada pela integração deixou de aparecer. Reveja o risco ligado.', 'info', '/riscos?tab=sugeridos', '{}'::jsonb);
    END IF;
  END LOOP;
  IF novos > 0 THEN
    FOR u IN SELECT p.user_id FROM profiles p JOIN user_roles r ON r.user_id = p.user_id
             WHERE p.empresa_id = p_empresa AND r.role::text IN ('admin','super_admin') LOOP
      PERFORM criar_notificacao(u, 'Novos riscos sugeridos', novos || ' falha(s) de configuração encontrada(s) pela integração.', 'warning', '/riscos?tab=sugeridos', jsonb_build_object('provider', p_provider));
    END LOOP;
  END IF;
  RETURN novos;
END $$;
REVOKE ALL ON FUNCTION public.integracao_registrar_riscos(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integracao_registrar_riscos(uuid,uuid,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.aceitar_risco_sugerido(p_id uuid, p_nome text, p_descricao text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s integracao_riscos_sugeridos; v_emp uuid := get_user_empresa_id(); v_risco uuid; nivel text;
BEGIN
  IF NOT has_valid_mfa_session() OR NOT usuario_tem_permissao_modulo('riscos','create') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO s FROM integracao_riscos_sugeridos WHERE id = p_id AND empresa_id = v_emp FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
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

CREATE OR REPLACE FUNCTION public.descartar_risco_sugerido(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_valid_mfa_session() OR NOT usuario_tem_permissao_modulo('riscos','update') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  UPDATE integracao_riscos_sugeridos SET estado = 'descartada', motivo_descarte = left(p_motivo, 1000),
    decidido_por = auth.uid(), decidido_em = now(), updated_at = now()
  WHERE id = p_id AND empresa_id = get_user_empresa_id() AND estado = 'aberta';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.aceitar_risco_sugerido(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.descartar_risco_sugerido(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceitar_risco_sugerido(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.descartar_risco_sugerido(uuid,text) TO authenticated;