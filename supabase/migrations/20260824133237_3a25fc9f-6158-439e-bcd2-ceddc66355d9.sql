CREATE OR REPLACE FUNCTION public.consult_denuncia_publica(
  p_empresa_slug text,
  p_protocolo text,
  p_tracking_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_denuncia public.denuncias%ROWTYPE;
BEGIN
  /*
    Denúncias anteriores ao código de acompanhamento têm
    `token_acompanhamento_hash` nulo e nunca receberam código nenhum. Exigir
    hash nessas linhas trancava o denunciante fora do próprio processo. Para
    essas — e só essas — o protocolo volta a bastar.
  */
  SELECT d.* INTO v_denuncia
  FROM public.denuncias d
  JOIN public.empresas e ON e.id = d.empresa_id
  WHERE e.slug = p_empresa_slug
    AND upper(d.protocolo) = upper(p_protocolo)
    AND (
      (d.token_acompanhamento_hash IS NOT NULL AND d.token_acompanhamento_hash = p_tracking_hash)
      OR d.token_acompanhamento_hash IS NULL
    )
    AND d.token_acompanhamento_revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_denuncia.id,
    'protocolo', v_denuncia.protocolo,
    'titulo', v_denuncia.titulo,
    'descricao', v_denuncia.descricao,
    'status', v_denuncia.status,
    'gravidade', v_denuncia.gravidade,
    'created_at', v_denuncia.created_at,
    'data_atribuicao', v_denuncia.data_atribuicao,
    'data_inicio_investigacao', v_denuncia.data_inicio_investigacao,
    'data_conclusao', v_denuncia.data_conclusao,
    'categoria', (
      SELECT jsonb_build_object('nome', c.nome, 'cor', c.cor)
      FROM public.denuncias_categorias c WHERE c.id = v_denuncia.categoria_id
    ),
    'data_acusacao_recebimento', v_denuncia.data_acusacao_recebimento,
    'prazo_retorno', v_denuncia.prazo_retorno,
    'resultado', v_denuncia.resultado,
    'movimentacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'acao', m.acao,
        'status_anterior', m.status_anterior, 'status_novo', m.status_novo,
        'observacoes', m.observacoes,
        'created_at', m.created_at
      ) ORDER BY m.created_at)
      FROM public.denuncias_movimentacoes m
      WHERE m.denuncia_id = v_denuncia.id
    ), '[]'::jsonb),
    'mensagens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', msg.id, 'autor_tipo', msg.autor_tipo,
        'mensagem', msg.mensagem, 'created_at', msg.created_at
      ) ORDER BY msg.created_at)
      FROM public.denuncias_mensagens msg
      WHERE msg.denuncia_id = v_denuncia.id
    ), '[]'::jsonb),
    'reunioes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'status', r.status, 'modalidade', r.modalidade,
        'data_hora', r.data_hora, 'link_ou_local', r.link_ou_local,
        'ata_confirmada_em', r.ata_confirmada_em,
        'created_at', r.created_at
      ) ORDER BY r.created_at)
      FROM public.denuncias_reunioes r
      WHERE r.denuncia_id = v_denuncia.id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consult_denuncia_publica(text, text, text) TO anon, authenticated;