/*
   Os prazos da denúncia estavam desenhados e não estavam vigiados.

   A Diretiva (UE) 2019/1937 obriga a acusar o recebimento em 7 dias e a dar
   retorno ao informante em 3 meses. O módulo grava os dois prazos no momento
   do registo (`tg_denuncia_prazos`) e desenha-os em quatro ecrãs — o relógio
   da ficha, o painel, a configuração do canal e a fila de pendências.

   Vigiar, ninguém vigiava. Nenhuma função de borda os lê; nada avisa quando o
   prazo se aproxima nem quando passa. O cumprimento dependia de alguém abrir o
   Akuris nesse dia. Num regime em que perder o prazo É a infracção, e num
   produto que se vende precisamente como prova de cumprimento, isso é o
   contrário do que o cliente compra.

   ## Porquê em SQL, e não numa função de borda

   Uma função de borda precisa de ser chamada por um cron com uma chave no
   cabeçalho, e essa chave não pode viver numa migração de um repositório
   público -- foi o que obrigou o cron dos lembretes a passar pelo cofre. Um
   aviso que só funciona depois de alguém guardar um segredo é um aviso que
   pode nunca chegar.

   Isto não precisa de nada disso: lê a base, escreve na base, e o `pg_cron`
   chama-o directamente. Sem HTTP, sem segredo, sem função por publicar.

   O e-mail continua a sair pela `send-denuncia-notification`, que é o caminho
   do aviso de denúncia nova; aqui garante-se o que não pode falhar -- o alarme
   dentro do produto, para quem tem de agir.

   ## Não repete

   Cada marco avisa UMA vez por denúncia. Um aviso diário sobre o mesmo prazo
   deixa de se ler ao terceiro dia, e a seguir ninguém lê nenhum. São quatro
   marcos, e cada um dispara uma só vez:

     · acusação a 2 dias do fim   · acusação vencida
     · retorno a 15 dias do fim   · retorno vencido

   A marca fica em `notifications.metadata`, que é o que permite saber que já
   se avisou sem inventar tabela nova.
*/

/*
   Duas portas para o sino, com autorizações diferentes.

   `criar_notificacao` exige `auth.uid()` e recusa destinatário de outra
   empresa. A guarda está certa: sem ela, um utilizador notificava qualquer
   conta do SaaS -- a tabela `notifications` não tem `empresa_id`, o vínculo com
   o inquilino é só o destinatário.

   Mas um trabalho agendado não tem sessão. Chamá-la de um cron devolvia
   «Notificação exige utilizador autenticado», e o aviso nunca chegava. Foi o
   que aconteceu ao vigia dos prazos na primeira tentativa.

   O que NÃO se faz é abrir a porta existente. Separa-se: o insert e a
   preferência do sino ficam num sítio só, e cada porta traz a sua
   autorização -- a do utilizador verifica a empresa, a do sistema não tem
   autor a verificar. Quem desligou o sino continua a não receber por nenhuma.
*/
CREATE OR REPLACE FUNCTION public.notificar_do_sistema(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_link_to text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_quer_no_sino boolean;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR btrim(COALESCE(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Notificação exige destinatário e título';
  END IF;

  SELECT notificar_na_aplicacao INTO v_quer_no_sino
    FROM public.profiles WHERE user_id = p_user_id;

  -- Destinatário sem perfil, ou que desligou o sino: não recebe, e não é erro.
  IF NOT FOUND OR v_quer_no_sino IS FALSE THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link_to, metadata)
  VALUES (p_user_id, p_title, p_message, COALESCE(p_type, 'info'), p_link_to,
          COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.notificar_do_sistema(uuid, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notificar_do_sistema(uuid, text, text, text, text, jsonb) FROM anon, authenticated;

/** Dias de antecedência de cada aviso. */
CREATE OR REPLACE FUNCTION public.vigiar_prazos_denuncias()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_criadas integer := 0;
  r record;
  m record;
  v_titulo text;
  v_mensagem text;
  v_tipo text;
BEGIN
  /*
     Uma linha por (denúncia × marco a disparar hoje).

     Só denúncias ABERTAS: uma resolvida ou arquivada já não tem prazo a
     cumprir, e avisar sobre ela seria ruído sobre trabalho feito.
  */
  FOR r IN
    SELECT d.id, d.empresa_id, d.protocolo, d.titulo AS assunto,
           d.prazo_acusacao, d.prazo_retorno, d.data_acusacao_recebimento,
           marco.chave, marco.vencido
      FROM public.denuncias d
      CROSS JOIN LATERAL (
        VALUES
          -- Acusação: só enquanto não estiver acusada.
          ('acusacao_perto',  false, d.data_acusacao_recebimento IS NULL
                                     AND d.prazo_acusacao IS NOT NULL
                                     AND d.prazo_acusacao BETWEEN CURRENT_DATE AND CURRENT_DATE + 2),
          ('acusacao_vencida', true, d.data_acusacao_recebimento IS NULL
                                     AND d.prazo_acusacao IS NOT NULL
                                     AND d.prazo_acusacao < CURRENT_DATE),
          ('retorno_perto',   false, d.prazo_retorno IS NOT NULL
                                     AND d.prazo_retorno BETWEEN CURRENT_DATE AND CURRENT_DATE + 15),
          ('retorno_vencido',  true, d.prazo_retorno IS NOT NULL
                                     AND d.prazo_retorno < CURRENT_DATE)
      ) AS marco(chave, vencido, aplica)
     WHERE d.status IN ('nova', 'em_analise', 'em_investigacao')
       AND marco.aplica
  LOOP
    v_tipo := CASE WHEN r.vencido THEN 'error' ELSE 'warning' END;

    v_titulo := CASE r.chave
      WHEN 'acusacao_perto'   THEN 'Acusar recebimento em ' || (r.prazo_acusacao - CURRENT_DATE) || ' dia(s)'
      WHEN 'acusacao_vencida' THEN 'Prazo de acusação VENCIDO'
      WHEN 'retorno_perto'    THEN 'Retorno ao denunciante em ' || (r.prazo_retorno - CURRENT_DATE) || ' dia(s)'
      ELSE 'Prazo de retorno VENCIDO'
    END;

    v_mensagem := 'Denúncia ' || r.protocolo || ': ' || left(r.assunto, 80)
      || CASE r.chave
           WHEN 'acusacao_perto'   THEN '. A Diretiva (UE) 2019/1937 exige acusar o recebimento em 7 dias.'
           WHEN 'acusacao_vencida' THEN '. O recebimento devia ter sido acusado até ' || r.prazo_acusacao || '.'
           WHEN 'retorno_perto'    THEN '. O retorno ao denunciante vence a ' || r.prazo_retorno || '.'
           ELSE '. O retorno ao denunciante devia ter sido dado até ' || r.prazo_retorno || '.'
         END;

    /*
       Avisa o comité e, se houver, quem ficou responsável. É o mesmo conjunto
       que a RLS deixa abrir a denúncia -- avisar quem não a pode ler seria
       mandar alguém a uma porta fechada.
    */
    FOR m IN
      SELECT DISTINCT c.user_id
        FROM public.denuncias_comite c
       WHERE c.empresa_id = r.empresa_id
      UNION
      SELECT r_id.responsavel_id
        FROM public.denuncias r_id
       WHERE r_id.id = r.id AND r_id.responsavel_id IS NOT NULL
    LOOP
      -- Uma vez por marco e por pessoa. A marca vive no metadata.
      IF EXISTS (
        SELECT 1 FROM public.notifications n
         WHERE n.user_id = m.user_id
           AND n.metadata->>'denuncia_id' = r.id::text
           AND n.metadata->>'marco' = r.chave
      ) THEN
        CONTINUE;
      END IF;

      PERFORM public.notificar_do_sistema(
        m.user_id, v_titulo, v_mensagem, v_tipo, '/denuncia',
        jsonb_build_object('denuncia_id', r.id, 'marco', r.chave, 'protocolo', r.protocolo)
      );
      v_criadas := v_criadas + 1;
    END LOOP;
  END LOOP;

  RETURN v_criadas;
END;
$function$;

REVOKE ALL ON FUNCTION public.vigiar_prazos_denuncias() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vigiar_prazos_denuncias() FROM anon, authenticated;

/*
   Agendamento directo, sem HTTP.

   `pg_cron` chama a função no mesmo servidor. Não há cabeçalho, não há chave,
   não há função de borda por publicar -- por isso não há nada que possa faltar
   para o aviso funcionar.
*/
DO $$
BEGIN
  PERFORM cron.unschedule('vigiar-prazos-denuncias')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vigiar-prazos-denuncias');

  PERFORM cron.schedule(
    'vigiar-prazos-denuncias',
    '0 7 * * *',
    'SELECT public.vigiar_prazos_denuncias();'
  );
  RAISE NOTICE 'vigia dos prazos da denuncia agendada para as 07:00';
END $$;
