-- Notificações criadas pela aplicação nunca chegavam a existir.
--
-- `public.notifications` tem RLS ativo com policies apenas de SELECT e UPDATE.
-- Não há policy de INSERT — por desenho, porque a intenção era que notificação
-- fosse produzida pelo servidor (gatilhos `SECURITY DEFINER`), não pelo cliente.
--
-- Só que seis pontos da aplicação inserem na tabela a partir do NAVEGADOR:
--
--   · AprovacaoRiscoDialog       — envio para aprovação, aprovação e rejeição
--   · RiscoFormWizard            — novo aceite formal de risco
--   · ControleDetalheDialog      — menção em comentário de controlo
--   · ItemAuditoriaDetalheDialog — menção em comentário de item de auditoria
--
-- Todos são recusados pela RLS, e todos descartam o resultado do `await`, por
-- isso a recusa nunca aparece: o ecrã dá "enviado para aprovação" e o aprovador
-- não recebe nada. Verificado em base local com papel `authenticated`:
--
--   ERROR: new row violates row-level security policy for table "notifications"
--
-- A saída não é abrir INSERT ao cliente — isso deixaria qualquer utilizador
-- escrever notificação para quem quisesse, com `link_to` à escolha. É dar à
-- aplicação a mesma porta que os gatilhos já usam, mas estreita: uma função
-- `SECURITY DEFINER` que só aceita destinatário da MESMA empresa de quem chama.

CREATE OR REPLACE FUNCTION public.criar_notificacao(
  p_user_id  uuid,
  p_title    text,
  p_message  text,
  p_type     text DEFAULT 'info',
  p_link_to  text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_autor uuid;
  v_empresa_dest  uuid;
  v_id            uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Notificação exige utilizador autenticado';
  END IF;

  IF p_user_id IS NULL OR btrim(COALESCE(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Notificação exige destinatário e título';
  END IF;

  SELECT empresa_id INTO v_empresa_autor FROM public.profiles WHERE user_id = auth.uid();
  SELECT empresa_id INTO v_empresa_dest  FROM public.profiles WHERE user_id = p_user_id;

  -- A tabela não tem `empresa_id`: o vínculo com o inquilino é só o destinatário.
  -- Sem esta verificação, um utilizador podia notificar qualquer conta do SaaS.
  IF v_empresa_dest IS NULL OR v_empresa_autor IS NULL OR v_empresa_dest <> v_empresa_autor THEN
    RAISE EXCEPTION 'Destinatário fora da empresa de quem envia';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link_to, metadata)
  VALUES (p_user_id, p_title, p_message, COALESCE(p_type, 'info'), p_link_to,
          COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_notificacao(uuid, text, text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.criar_notificacao(uuid, text, text, text, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.criar_notificacao(uuid, text, text, text, text, jsonb) IS
  'Única porta de escrita em notifications a partir da aplicação. Restringe o destinatário à empresa de quem chama.';


-- O gatilho de menção em tarefa de projeto estava escrito contra colunas que
-- não existem — em DUAS tabelas:
--
--   · lê `projeto_tarefas.empresa_id`, que a tabela não tem;
--   · escreve `notifications (empresa_id, tipo, titulo, mensagem, link,
--     prioridade)`, quando as colunas são (type, title, message, link_to).
--
-- Não é bug vivo hoje só por acidente: `useAddComentario` nunca preenche
-- `mencionados`, portanto a função sai no primeiro IF e nunca chega ao SELECT.
-- Ou seja, está armada e dispara no dia em que a menção for ligada no ecrã —
-- e não falha em silêncio, rebenta o INSERT do comentário e perde o texto.
-- Confirmado em base local:
--
--   ERROR: column t.empresa_id does not exist
--   CONTEXT: PL/pgSQL function notifica_mencao_comentario() line 10

CREATE OR REPLACE FUNCTION public.notifica_mencao_comentario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       uuid;
  v_titulo     text;
  v_projeto_id uuid;
BEGIN
  IF NEW.mencionados IS NULL OR array_length(NEW.mencionados, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.titulo, t.projeto_id INTO v_titulo, v_projeto_id
  FROM public.projeto_tarefas t WHERE t.id = NEW.tarefa_id;

  FOREACH v_user IN ARRAY NEW.mencionados LOOP
    IF v_user <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, title, message, type, link_to, metadata)
      VALUES (
        v_user,
        'Você foi mencionado',
        'Em: ' || COALESCE(v_titulo, 'tarefa'),
        'info',
        '/projetos/' || v_projeto_id,
        jsonb_build_object('tipo', 'projeto_mencao',
                           'projeto_id', v_projeto_id,
                           'tarefa_id', NEW.tarefa_id)
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
