/*
   O cron dos lembretes respondia 401 todas as manhãs.

   `20250814170146` agendou `daily-invitation-reminders` para as 9h, a chamar a
   função de borda `daily-reminder-processor` com este cabeçalho:

       'Authorization': 'Bearer <chave ANON>'

   E a função, na primeira coisa que faz:

       if (authHeader.replace('Bearer ', '') !== serviceKey)
         return 401 Unauthorized

   A chave anon nunca é a de serviço. O agendamento existe, corre, e é
   recusado à porta — sem ninguém ver, porque um cron que falha não avisa.

   O que morre com ele, todos os dias:

     · lembretes de convite por aceitar;
     · **lembretes de expiração de due diligence** — é o
       `daily-reminder-processor` que chama o `process-due-diligence-reminders`;
     · e a empresa que tem `due_diligence_expiracao_ativo` ligado nas suas
       definições recebe exactamente nada.

   Num processo que vive de prazos, isto é o processo inteiro em modo manual.

   ## Porque não se corrige pondo a chave certa aqui

   O repositório é público. A chave anon numa migração é inofensiva — é pública
   por desenho. A de serviço não: quem a tem passa por cima de toda a RLS.

   Usa-se o cofre, como já se faz no expurgo do canal de denúncia
   (`20260821200000`): a função lê `projeto_url` e `lembretes_diarios_token` de
   `vault.decrypted_secrets` e só então agenda. Sem segredo, NÃO agenda e diz
   porquê — um agendamento que devolve 401 é pior do que agendamento nenhum,
   porque parece que está a correr.
*/

CREATE OR REPLACE FUNCTION public.agendar_lembretes_diarios()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_url text;
  v_chave text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'projeto_url' LIMIT 1;
  SELECT decrypted_secret INTO v_chave
  FROM vault.decrypted_secrets WHERE name = 'lembretes_diarios_token' LIMIT 1;

  /* O agendamento antigo sai sempre: mesmo sem cofre para o substituir, é
     melhor não ter cron do que ter um que responde 401 e parece vivo. */
  PERFORM cron.unschedule('daily-invitation-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-invitation-reminders');
  PERFORM cron.unschedule('lembretes-diarios')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lembretes-diarios');

  IF v_url IS NULL OR v_chave IS NULL THEN
    RETURN 'sem cofre: guarde os segredos `projeto_url` e '
        || '`lembretes_diarios_token` (a chave de serviço do projeto) e volte a '
        || 'correr public.agendar_lembretes_diarios()';
  END IF;

  PERFORM cron.schedule(
    'lembretes-diarios', '0 9 * * *',
    format(
      $cron$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
        body := jsonb_build_object('origem','cron')
      );$cron$,
      v_url || '/functions/v1/daily-reminder-processor', v_chave
    )
  );
  RETURN 'agendado';
END $function$;

REVOKE ALL ON FUNCTION public.agendar_lembretes_diarios() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agendar_lembretes_diarios() FROM anon, authenticated;

DO $$
DECLARE v_resultado text;
BEGIN
  SELECT public.agendar_lembretes_diarios() INTO v_resultado;
  RAISE NOTICE 'lembretes diarios — %', v_resultado;
END $$;
