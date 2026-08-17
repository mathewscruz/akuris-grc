CREATE OR REPLACE FUNCTION public.create_denuncia_publica(p_empresa_slug text, p_categoria_id uuid, p_titulo text, p_descricao text, p_anonima boolean, p_politica_aceita boolean, p_denunciante_nome text, p_denunciante_email text, p_denunciante_telefone text, p_local_ocorrencia text, p_data_ocorrencia date, p_testemunhas text, p_evidencias_descricao text, p_tracking_hash text, p_fingerprint_hash text, p_client_ip inet, p_user_agent text)
 RETURNS TABLE(id uuid, protocolo text, empresa_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_portal_active boolean;
  v_allow_anonymous boolean;
  v_require_email boolean;
  v_id uuid;
  v_protocol text;
  v_attempt integer := 0;
  v_recent integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_empresa_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
     OR length(btrim(p_titulo)) NOT BETWEEN 8 AND 160
     OR length(btrim(p_descricao)) NOT BETWEEN 20 AND 10000
     OR p_politica_aceita IS DISTINCT FROM true
     OR p_tracking_hash !~ '^[0-9a-f]{64}$'
     OR p_fingerprint_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid report' USING ERRCODE = '22023';
  END IF;

  SELECT e.id, c.ativo, c.permitir_anonimas, c.requerer_email
    INTO v_empresa_id, v_portal_active, v_allow_anonymous, v_require_email
  FROM public.empresas e
  JOIN public.denuncias_configuracoes c ON c.empresa_id = e.id
  WHERE e.slug = p_empresa_slug AND e.ativo = true
  LIMIT 1;

  IF v_empresa_id IS NULL OR v_portal_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'portal unavailable' USING ERRCODE = '22023';
  END IF;
  IF p_anonima AND v_allow_anonymous IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'anonymous reports disabled' USING ERRCODE = '22023';
  END IF;
  IF v_require_email AND (p_anonima OR nullif(btrim(p_denunciante_email), '') IS NULL) THEN
    RAISE EXCEPTION 'email required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.denuncias_categorias dc
    WHERE dc.id = p_categoria_id AND dc.empresa_id = v_empresa_id AND dc.ativo = true
  ) THEN
    RAISE EXCEPTION 'invalid category' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':' || p_fingerprint_hash, 0)
  );
  DELETE FROM public.denuncia_submission_limits dsl
  WHERE dsl.created_at < now() - interval '24 hours';

  SELECT count(*) INTO v_recent
  FROM public.denuncia_submission_limits dsl
  WHERE dsl.empresa_id = v_empresa_id
    AND dsl.fingerprint_hash = p_fingerprint_hash
    AND dsl.created_at >= now() - interval '1 hour';

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'rate limit exceeded' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.denuncia_submission_limits (empresa_id, fingerprint_hash)
  VALUES (v_empresa_id, p_fingerprint_hash);

  LOOP
    v_attempt := v_attempt + 1;
    v_protocol := 'DEN-' || to_char(now(), 'YYYYMMDD') || '-' ||
      upper(encode(extensions.gen_random_bytes(8), 'hex'));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.denuncias d WHERE d.protocolo = v_protocol
    );
    IF v_attempt >= 5 THEN
      RAISE EXCEPTION 'protocol generation failed';
    END IF;
  END LOOP;

  INSERT INTO public.denuncias (
    empresa_id, categoria_id, titulo, descricao, anonima,
    nome_denunciante, email_denunciante, denunciante_telefone,
    local_ocorrencia, data_ocorrencia, testemunhas, evidencias_descricao,
    politica_aceita, protocolo, token_publico, token_acompanhamento_hash,
    ip_origem, user_agent, status
  ) VALUES (
    v_empresa_id, p_categoria_id, btrim(p_titulo), btrim(p_descricao), p_anonima,
    CASE WHEN p_anonima THEN NULL ELSE nullif(btrim(p_denunciante_nome), '') END,
    CASE WHEN p_anonima THEN NULL ELSE nullif(lower(btrim(p_denunciante_email)), '') END,
    CASE WHEN p_anonima THEN NULL ELSE nullif(btrim(p_denunciante_telefone), '') END,
    nullif(btrim(p_local_ocorrencia), ''), p_data_ocorrencia,
    nullif(btrim(p_testemunhas), ''), nullif(btrim(p_evidencias_descricao), ''),
    true, v_protocol, encode(extensions.gen_random_bytes(32), 'hex'), p_tracking_hash,
    CASE WHEN p_anonima THEN NULL ELSE p_client_ip END,
    CASE WHEN p_anonima THEN NULL ELSE left(p_user_agent, 500) END,
    'nova'
  ) RETURNING denuncias.id INTO v_id;

  RETURN QUERY SELECT v_id, v_protocol, v_empresa_id;
END;
$function$;