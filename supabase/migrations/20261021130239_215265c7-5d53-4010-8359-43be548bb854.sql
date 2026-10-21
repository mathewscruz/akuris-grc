ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS lembrete_3d_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS lembrete_dia_enviado_em timestamptz;

CREATE OR REPLACE FUNCTION public.projeto_tarefa_avisa_responsavel(p_body jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp' AS $$
DECLARE v_url text; v_chave text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'projeto_url' LIMIT 1;
  SELECT decrypted_secret INTO v_chave FROM vault.decrypted_secrets WHERE name = 'lembretes_diarios_token' LIMIT 1;
  IF v_url IS NULL OR v_chave IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := v_url || '/functions/v1/send-projeto-tarefa-notification',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_chave),
    body := p_body, timeout_milliseconds := 15000);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'aviso de tarefa não enviado: %', SQLERRM;
END $$;
REVOKE ALL ON FUNCTION public.projeto_tarefa_avisa_responsavel(jsonb) FROM PUBLIC, anon, authenticated;

-- Substitui o aviso só-sino: a função de borda grava o sino e envia o e-mail.
CREATE OR REPLACE FUNCTION public.projeto_tarefa_notify_atribuicao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.responsavel_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id)
     AND NEW.responsavel_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.projeto_tarefa_avisa_responsavel(jsonb_build_object(
      'tipo','atribuicao','tarefa_id',NEW.id,'ator_id',auth.uid()));
  ELSIF TG_OP = 'UPDATE' AND NEW.coluna_id IS DISTINCT FROM OLD.coluna_id
     AND NEW.responsavel_id IS NOT NULL
     AND NEW.responsavel_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.projeto_tarefa_avisa_responsavel(jsonb_build_object(
      'tipo','status','tarefa_id',NEW.id,'ator_id',auth.uid(),'coluna_anterior_id',OLD.coluna_id));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_projeto_tarefa_notify ON public.projeto_tarefas;
CREATE TRIGGER trg_projeto_tarefa_notify AFTER INSERT OR UPDATE OF responsavel_id, coluna_id ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.projeto_tarefa_notify_atribuicao();

-- Zera lembretes quando o prazo muda.
CREATE OR REPLACE FUNCTION public.projeto_tarefa_reset_lembretes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.data_fim IS DISTINCT FROM OLD.data_fim OR NEW.prazo IS DISTINCT FROM OLD.prazo THEN
    NEW.lembrete_3d_enviado_em := NULL;
    NEW.lembrete_dia_enviado_em := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_projeto_tarefa_reset_lembretes ON public.projeto_tarefas;
CREATE TRIGGER trg_projeto_tarefa_reset_lembretes BEFORE UPDATE OF data_fim, prazo ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.projeto_tarefa_reset_lembretes();

-- Lembrete diário de prazo (1x/dia, 08:00 Brasília = 11:00 UTC).
CREATE OR REPLACE FUNCTION public.agendar_lembretes_tarefas_projeto()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp' AS $$
DECLARE v_url text; v_chave text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'projeto_url' LIMIT 1;
  SELECT decrypted_secret INTO v_chave FROM vault.decrypted_secrets WHERE name = 'lembretes_diarios_token' LIMIT 1;
  PERFORM cron.unschedule('lembretes-tarefas-projeto')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lembretes-tarefas-projeto');
  IF v_url IS NULL OR v_chave IS NULL THEN RETURN 'sem cofre'; END IF;
  PERFORM cron.schedule('lembretes-tarefas-projeto', '0 11 * * *', format(
    $cron$SELECT net.http_post(url := %L,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
      body := jsonb_build_object('tipo','prazo'), timeout_milliseconds := 120000);$cron$,
    v_url || '/functions/v1/send-projeto-tarefa-notification', v_chave));
  RETURN 'agendado';
END $$;
REVOKE ALL ON FUNCTION public.agendar_lembretes_tarefas_projeto() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE r text; BEGIN SELECT public.agendar_lembretes_tarefas_projeto() INTO r; RAISE NOTICE 'lembretes tarefas — %', r; END $$;