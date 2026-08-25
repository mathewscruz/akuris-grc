-- Repõe o sigilo da movimentação na consulta pública da denúncia.
--
-- ## O que aconteceu
--
-- A migration `20260824133237` reescreveu `consult_denuncia_publica` inteira
-- — para resolver um problema real, o das denúncias antigas sem código de
-- acompanhamento — e, ao regenerar o corpo da função, perdeu uma linha:
--
--     -- antes (20260821190000)
--     'observacoes', CASE WHEN m.visibilidade = 'publica' THEN m.observacoes END,
--
--     -- depois
--     'observacoes', m.observacoes,
--
-- `denuncias_movimentacoes.observacoes` é a **nota interna de quem apura**.
-- É onde o comité escreve o que pensa do caso enquanto o investiga: suspeitas,
-- nomes de testemunhas, o rumo da apuração. Sem o filtro, tudo isso passou a
-- ser devolvido a quem tenha o protocolo — a começar por quem denunciou, e
-- também por quem for alvo da denúncia, se lhe chegar o número.
--
-- O retorno legítimo ao denunciante nunca viveu aqui: vive em
-- `denuncias_mensagens`, que a mesma função devolve por inteiro e onde o comité
-- escreve o que É para ser lido. Marcar uma movimentação como `visibilidade =
-- 'publica'` é o gesto deliberado de partilhar uma; por omissão é `interna`.
--
-- Esta migration repõe o filtro e deixa **tudo o resto** como a anterior o
-- definiu, incluindo a tolerância às denúncias sem hash.

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
AS $function$
DECLARE
  v_denuncia public.denuncias%ROWTYPE;
BEGIN
  /*
    Denúncias anteriores ao código de acompanhamento têm
    `token_acompanhamento_hash` nulo e nunca receberam código nenhum. Exigir
    hash nessas linhas trancava o denunciante fora do próprio processo. Para
    essas — e só essas — o protocolo volta a bastar.

    NOTA: isto veio da migration anterior e fica como estava, por ser decisão
    de produto. Mas tem um custo que convém estar escrito: para essas linhas o
    protocolo sozinho abre a denúncia inteira, e protocolo não é segredo — é
    um número que circula em e-mail. Se forem poucas, o melhor é emitir código
    para elas e voltar a exigir hash sempre.
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
    'nivel_identificacao', v_denuncia.nivel_identificacao,
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
        /*
          A LINHA QUE SE PERDEU.

          O andamento — «passou a Em investigação» — é o que quem denunciou
          tem direito a ver. A nota de quem apura, não. `CASE` sem `ELSE`
          devolve NULL, que é exactamente o que se quer: a movimentação
          continua a aparecer na linha do tempo, sem o texto.
        */
        'observacoes', CASE WHEN m.visibilidade = 'publica' THEN m.observacoes END,
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
    /*
      A reunião, do lado de quem a pediu.

      A versão anterior pedia `r.status`, `r.data_hora` e `r.link_ou_local` —
      três colunas que NÃO EXISTEM. A tabela tem `estado`, `agendada_para` e
      `local`. `CREATE OR REPLACE FUNCTION` em plpgsql não valida nomes de
      coluna, por isso a migration aplicou-se sem se queixar e a função passou
      a rebentar em TODA a chamada: «column r.status does not exist». Ou seja,
      a consulta pública da denúncia deixou simplesmente de responder.

      E a `ata` tinha desaparecido da resposta. Ela tem o seu próprio controlo
      de partilha — só sai depois de `ata_partilhada_em` — e é o que permite a
      quem esteve na reunião verificar, rectificar e aceitar o registo, que é
      o que o artigo 18.º/2 da Diretiva exige. Sem ela, o passo de confirmação
      ficava sem o texto a confirmar.
    */
    'reunioes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'estado', r.estado, 'modalidade', r.modalidade,
        'solicitada_em', r.solicitada_em, 'agendada_para', r.agendada_para,
        'local', r.local, 'resposta', r.resposta,
        'ata', CASE WHEN r.ata_partilhada_em IS NOT NULL THEN r.ata END,
        'ata_partilhada_em', r.ata_partilhada_em,
        'ata_confirmada_em', r.ata_confirmada_em
      ) ORDER BY r.solicitada_em)
      FROM public.denuncias_reunioes r
      WHERE r.denuncia_id = v_denuncia.id
    ), '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.consult_denuncia_publica(text, text, text) TO anon, authenticated;

/* Não sai daqui sem o filtro lá dentro. */
DO $$
BEGIN
  IF (SELECT prosrc FROM pg_proc WHERE proname = 'consult_denuncia_publica') NOT LIKE '%visibilidade%' THEN
    RAISE EXCEPTION 'canal: a consulta pública ficou sem o filtro de visibilidade';
  END IF;
  RAISE NOTICE 'canal: a nota interna da apuração volta a ficar dentro do comité';
END $$;
