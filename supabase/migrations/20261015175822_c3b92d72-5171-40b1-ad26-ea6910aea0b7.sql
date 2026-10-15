-- lovable-cron-fallback-reviewed: bounded backlog drain of ~3400 shared texts (4/run); idles cheaply once complete
CREATE OR REPLACE FUNCTION public.agendar_orientacoes_requisitos()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE v_url text; v_chave text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'projeto_url' LIMIT 1;
  SELECT decrypted_secret INTO v_chave FROM vault.decrypted_secrets WHERE name = 'lembretes_diarios_token' LIMIT 1;
  PERFORM cron.unschedule('orientacoes-requisitos')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'orientacoes-requisitos');
  IF v_url IS NULL OR v_chave IS NULL THEN RETURN 'sem cofre'; END IF;
  PERFORM cron.schedule('orientacoes-requisitos', '*/15 * * * *', format(
    $cron$SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
      body := jsonb_build_object('origem','cron'), timeout_milliseconds := 150000);$cron$,
    v_url || '/functions/v1/populate-requirement-guidance', v_chave));
  RETURN 'agendado';
END $function$;
REVOKE ALL ON FUNCTION public.agendar_orientacoes_requisitos() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE r text; BEGIN SELECT public.agendar_orientacoes_requisitos() INTO r; RAISE NOTICE 'orientacoes — %', r; END $$;