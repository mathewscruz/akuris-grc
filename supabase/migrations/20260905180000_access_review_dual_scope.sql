-- Keep the two identities separate. Never match privileged accounts to directory
-- users by email/name: those values are neither unique nor stable identifiers.
ALTER TABLE public.access_review_items ALTER COLUMN conta_id DROP NOT NULL;
ALTER TABLE public.access_review_items ADD COLUMN sistema_usuario_id uuid REFERENCES public.sistemas_usuarios(id) ON DELETE RESTRICT;
ALTER TABLE public.access_review_items ADD CONSTRAINT access_review_item_one_source CHECK (num_nonnulls(conta_id, sistema_usuario_id) = 1);
CREATE UNIQUE INDEX access_review_items_system_user ON public.access_review_items(review_id, sistema_usuario_id) WHERE sistema_usuario_id IS NOT NULL;
ALTER TABLE public.access_review_history ALTER COLUMN conta_id DROP NOT NULL;
ALTER TABLE public.access_review_history ADD COLUMN sistema_usuario_id uuid REFERENCES public.sistemas_usuarios(id) ON DELETE RESTRICT;
ALTER TABLE public.access_review_history ADD CONSTRAINT access_review_history_one_source CHECK (num_nonnulls(conta_id, sistema_usuario_id) = 1);

-- Serialize decisions with finalization, reject cross-company/cross-system links,
-- and prevent a completed campaign from acquiring new or edited decisions.
CREATE FUNCTION public.guard_access_review_item() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE campaign public.access_reviews;
BEGIN
  SELECT * INTO campaign FROM public.access_reviews WHERE id = NEW.review_id FOR UPDATE;
  IF NOT FOUND OR campaign.empresa_id IS DISTINCT FROM public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'REVIEW_NOT_AVAILABLE' USING ERRCODE = '42501';
  END IF;
  IF campaign.status NOT IN ('rascunho', 'em_andamento') THEN RAISE EXCEPTION 'REVIEW_CLOSED'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.review_id IS DISTINCT FROM OLD.review_id OR NEW.conta_id IS DISTINCT FROM OLD.conta_id OR NEW.sistema_usuario_id IS DISTINCT FROM OLD.sistema_usuario_id) THEN
    RAISE EXCEPTION 'REVIEW_IMMUTABLE_SCOPE';
  END IF;
  IF NEW.conta_id IS NOT NULL THEN
    PERFORM 1 FROM public.contas_privilegiadas WHERE id = NEW.conta_id AND empresa_id = campaign.empresa_id AND sistema_id = campaign.sistema_id;
  ELSE
    PERFORM 1 FROM public.sistemas_usuarios WHERE id = NEW.sistema_usuario_id AND empresa_id = campaign.empresa_id AND sistema_id = campaign.sistema_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_SOURCE_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  IF NEW.decisao <> 'pendente' THEN
    IF auth.uid() IS NULL OR length(btrim(coalesce(NEW.justificativa_revisor, ''))) < 10 THEN RAISE EXCEPTION 'REVIEW_INVALID_DECISION'; END IF;
    IF NEW.decisao = 'modificar' AND NEW.nova_data_expiracao IS NULL THEN RAISE EXCEPTION 'REVIEW_EXPIRY_REQUIRED'; END IF;
    NEW.revisado_por := auth.uid();
    NEW.data_revisao := now();
  ELSE
    NEW.revisado_por := NULL;
    NEW.data_revisao := NULL;
  END IF;
  IF NEW.decisao <> 'modificar' THEN NEW.nova_data_expiracao := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_access_review_item BEFORE INSERT OR UPDATE ON public.access_review_items FOR EACH ROW EXECUTE FUNCTION public.guard_access_review_item();

CREATE OR REPLACE FUNCTION public.guard_access_review_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id OR NEW.sistema_id IS DISTINCT FROM OLD.sistema_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'REVIEW_IMMUTABLE_SCOPE';
  END IF;
  IF OLD.status IN ('concluida', 'cancelada') AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'REVIEW_CLOSED'; END IF;
  IF NEW.responsavel_revisao IS DISTINCT FROM OLD.responsavel_revisao THEN
    PERFORM 1 FROM public.profiles WHERE user_id = NEW.responsavel_revisao AND empresa_id = NEW.empresa_id AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_OWNER_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  END IF;
  IF (NEW.data_inicio IS DISTINCT FROM OLD.data_inicio OR NEW.data_limite IS DISTINCT FROM OLD.data_limite) AND NEW.data_limite < NEW.data_inicio THEN RAISE EXCEPTION 'REVIEW_INVALID_INPUT'; END IF;
  IF NEW.nome_revisao IS DISTINCT FROM OLD.nome_revisao AND length(btrim(NEW.nome_revisao)) < 3 THEN RAISE EXCEPTION 'REVIEW_INVALID_INPUT'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_access_review_scope BEFORE UPDATE ON public.access_reviews FOR EACH ROW EXECUTE FUNCTION public.guard_access_review_scope();

-- One transaction creates both the campaign and its full eligible population.
-- SECURITY INVOKER deliberately preserves existing company and MFA RLS policies.
CREATE OR REPLACE FUNCTION public.create_access_review(p_empresa_id uuid, p_data jsonb) RETURNS public.access_reviews
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE campaign public.access_reviews; item_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_valid_mfa_session() OR p_empresa_id IS DISTINCT FROM public.get_user_empresa_id() THEN
    RAISE EXCEPTION 'REVIEW_NOT_AVAILABLE' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_data->>'nome_revisao', ''))) < 3
    OR nullif(p_data->>'data_inicio', '') IS NULL OR nullif(p_data->>'data_limite', '') IS NULL
    OR (p_data->>'data_limite')::date < (p_data->>'data_inicio')::date THEN RAISE EXCEPTION 'REVIEW_INVALID_INPUT'; END IF;
  PERFORM 1 FROM public.sistemas_privilegiados WHERE id = (p_data->>'sistema_id')::uuid AND empresa_id = p_empresa_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_SOURCE_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.profiles WHERE user_id = (p_data->>'responsavel_revisao')::uuid AND empresa_id = p_empresa_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_OWNER_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.access_reviews (empresa_id, sistema_id, nome_revisao, descricao, tipo_revisao, data_inicio, data_limite, responsavel_revisao, observacoes, created_by, link_token, status)
  VALUES (p_empresa_id, (p_data->>'sistema_id')::uuid, btrim(p_data->>'nome_revisao'), p_data->>'descricao', p_data->>'tipo_revisao',
    (p_data->>'data_inicio')::date, (p_data->>'data_limite')::date, (p_data->>'responsavel_revisao')::uuid, p_data->>'observacoes', auth.uid(),
    encode(extensions.gen_random_bytes(32), 'hex'), 'em_andamento') RETURNING * INTO campaign;
  INSERT INTO public.access_review_items (review_id, conta_id, sistema_usuario_id, usuario_beneficiario, email_beneficiario, tipo_acesso, nivel_privilegio, data_concessao, data_expiracao, justificativa_original)
  SELECT campaign.id, NULL::uuid, u.id, u.nome_usuario, u.email_usuario, coalesce(u.tipo_acesso, 'leitura'), coalesce(u.nivel_privilegio, 'usuario'), u.data_concessao, u.data_expiracao, u.justificativa
  FROM public.sistemas_usuarios u WHERE u.empresa_id = p_empresa_id AND u.sistema_id = campaign.sistema_id AND u.ativo
    -- A legacy import may mirror a privileged account using its exact stable ID.
    -- Review the canonical account once; never deduplicate by email/name.
    AND NOT EXISTS (SELECT 1 FROM public.contas_privilegiadas canonical WHERE u.origem = 'conta_privilegiada'
      AND u.origem_id = canonical.id::text AND canonical.empresa_id = p_empresa_id AND canonical.sistema_id = campaign.sistema_id)
  UNION ALL
  SELECT campaign.id, c.id, NULL::uuid, c.usuario_beneficiario, c.email_beneficiario, c.tipo_acesso, c.nivel_privilegio, c.data_concessao, c.data_expiracao, c.justificativa_negocio
  FROM public.contas_privilegiadas c WHERE c.empresa_id = p_empresa_id AND c.sistema_id = campaign.sistema_id AND c.status = 'ativo';
  GET DIAGNOSTICS item_count = ROW_COUNT;
  IF item_count = 0 THEN RAISE EXCEPTION 'REVIEW_EMPTY_SCOPE'; END IF;
  UPDATE public.access_reviews SET total_contas = item_count WHERE id = campaign.id RETURNING * INTO campaign;
  RETURN campaign;
END $$;

-- No API batch limit, no service-role bypass, and no partial revocation if one
-- source/history write fails. A repeated request does not repeat the effects.
CREATE OR REPLACE FUNCTION public.finalize_access_review(p_review_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE campaign public.access_reviews; item public.access_review_items; action_taken text; item_count integer; changed integer; mirrors integer; system_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_valid_mfa_session() THEN RAISE EXCEPTION 'REVIEW_NOT_AVAILABLE' USING ERRCODE = '42501'; END IF;
  SELECT * INTO campaign FROM public.access_reviews WHERE id = p_review_id AND empresa_id = public.get_user_empresa_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_NOT_AVAILABLE' USING ERRCODE = '42501'; END IF;
  IF campaign.status = 'concluida' THEN RETURN jsonb_build_object('success', true, 'already_finalized', true); END IF;
  IF campaign.status = 'cancelada' THEN RAISE EXCEPTION 'REVIEW_CLOSED'; END IF;
  SELECT count(*) INTO item_count FROM public.access_review_items WHERE review_id = campaign.id;
  IF item_count = 0 THEN RAISE EXCEPTION 'REVIEW_EMPTY_SCOPE'; END IF;
  IF EXISTS (SELECT 1 FROM public.access_review_items WHERE review_id = campaign.id AND (decisao = 'pendente' OR data_revisao IS NULL OR revisado_por IS NULL)) THEN RAISE EXCEPTION 'REVIEW_PENDING_ITEMS'; END IF;
  SELECT nome_sistema INTO system_name FROM public.sistemas_privilegiados WHERE id = campaign.sistema_id AND empresa_id = campaign.empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_SOURCE_UNAVAILABLE'; END IF;
  FOR item IN SELECT * FROM public.access_review_items WHERE review_id = campaign.id ORDER BY id FOR UPDATE LOOP
    action_taken := 'mantido';
    IF item.conta_id IS NOT NULL THEN
      PERFORM 1 FROM public.contas_privilegiadas WHERE id = item.conta_id AND empresa_id = campaign.empresa_id AND sistema_id = campaign.sistema_id FOR UPDATE;
    ELSE
      PERFORM 1 FROM public.sistemas_usuarios WHERE id = item.sistema_usuario_id AND empresa_id = campaign.empresa_id AND sistema_id = campaign.sistema_id FOR UPDATE;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_SOURCE_UNAVAILABLE'; END IF;
    IF item.decisao IN ('revogar', 'modificar') THEN
      IF item.decisao = 'modificar' AND item.nova_data_expiracao IS NULL THEN RAISE EXCEPTION 'REVIEW_EXPIRY_REQUIRED'; END IF;
      IF item.conta_id IS NOT NULL THEN
        UPDATE public.contas_privilegiadas SET
          status = CASE WHEN item.decisao = 'revogar' THEN 'revogado' ELSE status END,
          data_expiracao = CASE WHEN item.decisao = 'modificar' THEN item.nova_data_expiracao ELSE data_expiracao END
        WHERE id = item.conta_id AND empresa_id = campaign.empresa_id AND sistema_id = campaign.sistema_id;
      ELSE
        UPDATE public.sistemas_usuarios SET
          ativo = CASE WHEN item.decisao = 'revogar' THEN false ELSE ativo END,
          data_expiracao = CASE WHEN item.decisao = 'modificar' THEN item.nova_data_expiracao ELSE data_expiracao END
        WHERE id = item.sistema_usuario_id AND empresa_id = campaign.empresa_id AND sistema_id = campaign.sistema_id;
      END IF;
      GET DIAGNOSTICS changed = ROW_COUNT;
      IF changed <> 1 THEN RAISE EXCEPTION 'REVIEW_SOURCE_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
      IF item.conta_id IS NOT NULL THEN
        PERFORM 1 FROM public.sistemas_usuarios WHERE empresa_id = campaign.empresa_id AND sistema_id = campaign.sistema_id
          AND origem = 'conta_privilegiada' AND origem_id = item.conta_id::text ORDER BY id FOR UPDATE;
        GET DIAGNOSTICS mirrors = ROW_COUNT;
        UPDATE public.sistemas_usuarios SET
          ativo = CASE WHEN item.decisao = 'revogar' THEN false ELSE ativo END,
          data_expiracao = CASE WHEN item.decisao = 'modificar' THEN item.nova_data_expiracao ELSE data_expiracao END
        WHERE empresa_id = campaign.empresa_id AND sistema_id = campaign.sistema_id AND origem = 'conta_privilegiada' AND origem_id = item.conta_id::text;
        GET DIAGNOSTICS changed = ROW_COUNT;
        IF changed <> mirrors THEN RAISE EXCEPTION 'REVIEW_SOURCE_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
      END IF;
      action_taken := CASE WHEN item.decisao = 'revogar' THEN 'revogado' ELSE 'expirado_atualizado' END;
    END IF;
    INSERT INTO public.access_review_history (empresa_id, review_id, conta_id, sistema_usuario_id, sistema_nome, usuario_beneficiario, email_beneficiario, tipo_acesso, nivel_privilegio, decisao, justificativa_revisor, revisado_por, data_revisao, acao_tomada)
    VALUES (campaign.empresa_id, campaign.id, item.conta_id, item.sistema_usuario_id, system_name, item.usuario_beneficiario, item.email_beneficiario, item.tipo_acesso, item.nivel_privilegio, item.decisao, item.justificativa_revisor, item.revisado_por, item.data_revisao, action_taken);
  END LOOP;
  UPDATE public.access_reviews SET status = 'concluida', data_conclusao = now(), total_contas = item_count WHERE id = campaign.id;
  RETURN jsonb_build_object('success', true, 'already_finalized', false);
END $$;

-- Preserve the existing creator notification inside the same transaction. This
-- trigger can only insert a notification derived from a real state transition.
CREATE FUNCTION public.notify_access_review_completed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, link_to, metadata)
    VALUES (NEW.created_by, 'Revisão de Acesso Finalizada', format('A revisão "%s" foi concluída.', NEW.nome_revisao), 'success',
      '/revisao-acessos?revisao=' || NEW.id, jsonb_build_object('review_id', NEW.id, 'tipo', 'revisao_finalizada', 'i18n_key', 'experience.reviewFinishedTitle', 'i18n_message_key', 'experience.reviewFinishedMessage', 'i18n_params', jsonb_build_object('name', NEW.nome_revisao)));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_access_review_completed AFTER UPDATE OF status ON public.access_reviews FOR EACH ROW EXECUTE FUNCTION public.notify_access_review_completed();

REVOKE ALL ON FUNCTION public.create_access_review(uuid, jsonb), public.finalize_access_review(uuid), public.guard_access_review_item(), public.guard_access_review_scope(), public.notify_access_review_completed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_access_review(uuid, jsonb), public.finalize_access_review(uuid) TO authenticated;
