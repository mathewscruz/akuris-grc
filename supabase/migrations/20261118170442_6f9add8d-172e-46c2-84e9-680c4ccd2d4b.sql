CREATE OR REPLACE FUNCTION public.agendar_envio_relatorios()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp' AS $$
DECLARE v_url text; v_chave text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'projeto_url' LIMIT 1;
  SELECT decrypted_secret INTO v_chave FROM vault.decrypted_secrets WHERE name = 'lembretes_diarios_token' LIMIT 1;
  PERFORM cron.unschedule('envio-relatorios-agendados')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'envio-relatorios-agendados');
  IF v_url IS NULL OR v_chave IS NULL THEN RETURN 'sem cofre'; END IF;
  PERFORM cron.schedule('envio-relatorios-agendados', '0 11 * * *', format(
    $cron$SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
      body := '{}'::jsonb, timeout_milliseconds := 120000);$cron$,
    v_url || '/functions/v1/send-relatorios-agendados', v_chave));
  RETURN 'agendado';
END $$;
REVOKE ALL ON FUNCTION public.agendar_envio_relatorios() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE r text; BEGIN SELECT public.agendar_envio_relatorios() INTO r; RAISE NOTICE 'relatorios agendados — %', r; END $$;