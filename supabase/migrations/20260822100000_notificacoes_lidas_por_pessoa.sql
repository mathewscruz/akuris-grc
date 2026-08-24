-- O que já foi visto deixa de voltar a aparecer.
--
-- ## O que estava a acontecer
--
-- O painel do sino mistura duas coisas:
--
--  · notificações GRAVADAS, na tabela `notifications`, com coluna `read`;
--  · notificações CALCULADAS no cliente a cada abertura — documentos vencidos,
--    contratos a expirar, controlos por avaliar, incidentes críticos, licenças,
--    chaves, riscos por rever. Estas não existem em lado nenhum: nascem de uma
--    consulta e têm ids sintéticos (`doc-vencido-<uuid>`).
--
-- O estado «lida» das calculadas vivia em `localStorage`, numa chave só —
-- `readAutomaticNotifications` — sem dono. Três consequências:
--
--  1. **Por navegador, não por pessoa.** Marcar como lida no portátil não fazia
--     nada no telemóvel; e duas pessoas na mesma máquina partilhavam o estado.
--  2. **Some com a limpeza do navegador**, que é coisa que se faz sem pensar.
--  3. **Só marcava ao CLICAR.** Abrir o painel, ler tudo e fechar não marcava
--     nada — e é isto que a pessoa quer dizer com «notificações que eu já vi».
--
-- Verificado no ambiente de trabalho: a chave nem sequer existia, depois de
-- semanas de uso.
--
-- A leitura é de quem lê. Passa para a base, por pessoa.

CREATE TABLE IF NOT EXISTS public.notificacoes_lidas (
  user_id uuid NOT NULL,
  /*
    A chave da notificação calculada — `doc-vencido-<uuid>`, `contrato-30dias-…`.
    Texto e não FK de propósito: o que está do outro lado pode desaparecer (o
    documento é apagado, o contrato é renovado) e a marca de leitura não tem de
    morrer com ele.
  */
  chave text NOT NULL,
  lida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_lidas_user
  ON public.notificacoes_lidas(user_id, lida_em DESC);

COMMENT ON TABLE public.notificacoes_lidas IS
  'Que notificações CALCULADAS cada pessoa já viu. As gravadas usam '
  'notifications.read. Vivia em localStorage — por navegador, sem dono, e '
  'perdida em qualquer limpeza.';

ALTER TABLE public.notificacoes_lidas ENABLE ROW LEVEL SECURITY;

/* Cada pessoa é dona da sua leitura, e de mais nenhuma. */
DROP POLICY IF EXISTS "Cada um ve o que leu" ON public.notificacoes_lidas;
CREATE POLICY "Cada um ve o que leu" ON public.notificacoes_lidas
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Cada um marca o que leu" ON public.notificacoes_lidas;
CREATE POLICY "Cada um marca o que leu" ON public.notificacoes_lidas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Cada um limpa o que leu" ON public.notificacoes_lidas;
CREATE POLICY "Cada um limpa o que leu" ON public.notificacoes_lidas
  FOR DELETE TO authenticated USING (user_id = auth.uid());

/*
  Sem exigência de MFA, ao contrário do resto.

  Aqui não há dado de negócio nenhum: é uma lista de identificadores de avisos
  que a própria pessoa já leu. Exigir MFA para gravar que se viu um aviso
  transformaria uma sessão a meio da verificação num sino que nunca se cala.
*/

/*
  Marcar em lote, ao abrir o painel.

  Um INSERT por notificação daria dez pedidos para abrir um sino. E é preciso
  ser idempotente: reabrir o painel volta a mandar as mesmas chaves.
*/
CREATE OR REPLACE FUNCTION public.marcar_notificacoes_lidas(p_chaves text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_novas integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_chaves IS NULL OR array_length(p_chaves, 1) IS NULL THEN
    RETURN 0;
  END IF;
  IF array_length(p_chaves, 1) > 500 THEN
    RAISE EXCEPTION 'demasiadas chaves de uma vez' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.notificacoes_lidas (user_id, chave)
  SELECT auth.uid(), c FROM unnest(p_chaves) AS c
  WHERE nullif(btrim(c), '') IS NOT NULL
  ON CONFLICT (user_id, chave) DO NOTHING;

  GET DIAGNOSTICS v_novas = ROW_COUNT;
  RETURN v_novas;
END $function$;

GRANT EXECUTE ON FUNCTION public.marcar_notificacoes_lidas(text[]) TO authenticated;

/*
  Poda.

  A lista antiga em `localStorage` crescia para sempre — guardava o id de um
  documento vencido muito depois de o documento deixar de existir. Aqui a marca
  deixa de fazer falta ao fim de um ano: se o aviso voltar passado tanto tempo,
  provavelmente merece ser visto outra vez.
*/
CREATE OR REPLACE FUNCTION public.podar_notificacoes_lidas()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH removidas AS (
    DELETE FROM public.notificacoes_lidas
    WHERE lida_em < now() - interval '12 months'
    RETURNING 1
  )
  SELECT count(*)::integer FROM removidas;
$function$;

REVOKE ALL ON FUNCTION public.podar_notificacoes_lidas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.podar_notificacoes_lidas() FROM anon, authenticated;

SELECT cron.unschedule('podar-notificacoes-lidas')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'podar-notificacoes-lidas');
SELECT cron.schedule(
  'podar-notificacoes-lidas', '15 3 * * 0',
  $$SELECT public.podar_notificacoes_lidas();$$
);

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE tablename = 'notificacoes_lidas') < 3 THEN
    RAISE EXCEPTION 'notificações: a tabela de leitura ficou sem políticas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'podar-notificacoes-lidas') THEN
    RAISE EXCEPTION 'notificações: a poda não ficou agendada';
  END IF;
  RAISE NOTICE 'notificações: a leitura passou a ser de quem lê';
END $$;
