GRANT SELECT, INSERT, UPDATE, DELETE ON public.denuncias TO authenticated;
GRANT ALL ON public.denuncias TO service_role;

CREATE POLICY "Admins can insert denuncias"
ON public.denuncias
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = get_user_empresa_id()
  AND is_admin_or_super_admin()
);

CREATE OR REPLACE FUNCTION public.criar_denuncia_manual(
  p_empresa_id uuid,
  p_titulo text,
  p_descricao text,
  p_categoria_id uuid DEFAULT NULL,
  p_gravidade text DEFAULT 'media',
  p_status text DEFAULT 'nova',
  p_nome_denunciante text DEFAULT NULL,
  p_email_denunciante text DEFAULT NULL,
  p_anonima boolean DEFAULT false,
  p_local_ocorrencia text DEFAULT NULL,
  p_data_ocorrencia date DEFAULT NULL,
  p_denunciante_telefone text DEFAULT NULL,
  p_testemunhas text DEFAULT NULL,
  p_evidencias_descricao text DEFAULT NULL
)
RETURNS TABLE(id uuid, protocolo text, token_publico text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_protocolo text;
  v_token_publico text;
  v_denuncia_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND empresa_id = p_empresa_id
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: usuário não autorizado a criar denúncia nesta empresa';
  END IF;

  v_protocolo := public.gerar_protocolo_denuncia();
  v_token_publico := public.gerar_token_publico();

  INSERT INTO public.denuncias (
    empresa_id,
    protocolo,
    token_publico,
    titulo,
    descricao,
    categoria_id,
    gravidade,
    status,
    nome_denunciante,
    email_denunciante,
    anonima,
    local_ocorrencia,
    data_ocorrencia,
    denunciante_telefone,
    testemunhas,
    evidencias_descricao
  )
  VALUES (
    p_empresa_id,
    v_protocolo,
    v_token_publico,
    p_titulo,
    p_descricao,
    p_categoria_id,
    p_gravidade,
    p_status,
    p_nome_denunciante,
    p_email_denunciante,
    p_anonima,
    p_local_ocorrencia,
    p_data_ocorrencia,
    p_denunciante_telefone,
    p_testemunhas,
    p_evidencias_descricao
  )
  RETURNING public.denuncias.id INTO v_denuncia_id;

  RETURN QUERY SELECT v_denuncia_id, v_protocolo, v_token_publico;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_denuncia_manual(
  uuid, text, text, uuid, text, text, text, text, boolean,
  text, date, text, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_denuncia_manual(
  uuid, text, text, uuid, text, text, text, text, boolean,
  text, date, text, text, text
) TO service_role;