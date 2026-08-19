-- O formulário de contacto era escrita anónima ilimitada na base.
--
-- `contact_form_submissions` tinha uma política de INSERT para `{anon,
-- authenticated}` com `WITH CHECK (true)` — sem qualquer teto de tamanho nem
-- de frequência. Não era preciso passar pela Edge Function: bastava a chave
-- anon, que qualquer navegador tem, e um POST direto ao PostgREST. Medido:
--
--   5 pedidos anónimos → 5 linhas gravadas, mensagem de 2000 caracteres aceite
--
-- E existia, já feito, um limitador desenhado para isto — a função
-- `consume_contact_form_attempt`, com bloqueio de advisory, teto de 5 por hora
-- e limpeza das linhas com mais de 24 horas. Nunca tinha sido chamada. O mesmo
-- vale para `consume_password_reset_attempt` e
-- `consume_public_registration_attempt`: as três estavam prontas e nenhuma
-- ligada, com as Edge Functions a usar um `Map` em memória que não sobrevive
-- entre isolados do Deno.
--
-- A partir daqui só há um caminho de escrita: a Edge Function, que passa a
-- correr com a chave de serviço e a chamar o limitador. `service_role` ignora
-- RLS, por isso não precisa de política.

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_form_submissions;

-- Apanha também o caso de a política ter outro nome nesta base: o que se quer
-- é que não sobre nenhuma via de INSERT aberta a `anon`.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contact_form_submissions'
      AND permissive = 'PERMISSIVE'
      AND cmd IN ('INSERT', 'ALL')
      AND (roles::text[] @> ARRAY['anon'] OR roles::text[] @> ARRAY['public'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.contact_form_submissions', p.policyname);
    RAISE NOTICE 'política de escrita anónima removida: %', p.policyname;
  END LOOP;
END $$;

-- Tetos de tamanho, para que a validação não dependa só da Edge Function.
-- NOT VALID: uma base com submissões antigas fora do teto não deve travar o
-- push; o que interessa é o que entra a partir de agora.
ALTER TABLE public.contact_form_submissions
  DROP CONSTRAINT IF EXISTS contact_form_tamanhos,
  ADD CONSTRAINT contact_form_tamanhos CHECK (
        length(name)              <= 120
    AND length(email)             <= 254
    AND length(COALESCE(company, '')) <= 160
    AND length(COALESCE(phone, ''))   <= 40
    AND length(message)           <= 4000
  ) NOT VALID;

COMMENT ON TABLE public.contact_form_submissions IS
  'Só escrita pela Edge Function send-contact-email, com chave de serviço e limite por consume_contact_form_attempt.';
