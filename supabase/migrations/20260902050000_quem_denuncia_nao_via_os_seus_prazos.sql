/*
   Quem denunciou não via os prazos — via a classificação interna do comité.

   A consulta pública devolvia `gravidade` e `prazo_retorno`. O ecrã desenhava
   a gravidade num crachá ao lado do estado, e não desenhava o prazo de todo.
   Estava exactamente ao contrário do que serve quem denunciou.

   ## A gravidade não é uma avaliação

   `denuncias.gravidade` tem `DEFAULT 'medio'`. O formulário público não a
   pergunta e ninguém a atribui no registo: é o valor da coluna, escrito pelo
   banco no instante do INSERT.

   Medido — denúncia registada pelo portal às 10:41, consultada às 10:42:

       crachá: «M · Média»

   Trinta segundos depois de relatar um assédio, a pessoa lê que o caso dela
   foi classificado como médio. Ninguém o classificou. É um valor por omissão
   a fazer-se passar por juízo, e é o pior sítio possível para isso acontecer:
   se depois o comité o subir para crítico, a pessoa vê uma reclassificação que
   nunca houve; se o descer, vê um caso a ser desvalorizado.

   A gravidade é a ferramenta de triagem de quem apura. Sai da resposta — não é
   escondida do ecrã e mantida no payload, porque continuaria a viajar até ao
   navegador de quem não a deve ver.

   ## Os prazos são o contrário disso

   A Diretiva (UE) 2019/1937 dá a quem denuncia o direito a acusação de
   recebimento em 7 dias (art. 9.º/1/b) e a retorno em 3 meses (art. 9.º/1/f).
   As duas datas estão gravadas na denúncia desde o registo (`tg_denuncia_prazos`)
   e nenhuma chegava à pessoa a quem os prazos pertencem.

   Sem elas, «acompanhar a denúncia» é ver um estado que não muda e não saber
   se isso é normal ou se a empresa está atrasada. Com elas, quem denunciou
   sabe o que esperar e quando reclamar — e a empresa fica com uma promessa
   verificável, que é aquilo que o produto vende.

   Passa a devolver `prazo_acusacao`, `prazo_retorno` e
   `data_acusacao_recebimento` (o cumprimento, não só a promessa).
*/

CREATE OR REPLACE FUNCTION public.consult_denuncia_publica(p_empresa_slug text, p_protocolo text, p_tracking_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    /* O prazo de acusacao faltava: era o unico dos dois relogios que nao
       chegava a quem denunciou, e e o que vence primeiro. */
    'prazo_acusacao', v_denuncia.prazo_acusacao,
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
$function$
;
