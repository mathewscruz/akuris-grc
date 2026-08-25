-- A fila de expurgo de ficheiros de denúncia deixa de aceitar mãos de sessão.
--
-- ## O que se encontrou no pentest
--
-- `denuncias_ficheiros_por_apagar` guarda os CAMINHOS dos anexos de denúncia à
-- espera de serem apagados do storage. Tinha RLS ligado mas ZERO políticas —
-- o que, por omissão, nega tudo — e ao mesmo tempo `anon` e `authenticated`
-- com INSERT/SELECT/UPDATE/DELETE/TRUNCATE herdados.
--
-- Hoje não vaza: sem política, o RLS recusa toda a leitura pela API (provado —
-- anon e authenticated lêem zero). Mas é uma armadilha montada: basta alguém
-- adicionar UMA política permissiva, um dia, a pensar noutra coisa, e a lista
-- de caminhos de anexos de denúncia — que apontam para quem denunciou o quê —
-- fica exposta a qualquer autenticado. A tabela é do processo de expurgo (cron
-- + service_role), e mais ninguém tem que lhe tocar.
--
-- ## A correcção
--
-- Retira os privilégios de `anon` e `authenticated`. O `service_role` (que o
-- RLS nem sequer consulta) continua a fazer o seu trabalho. Deixa de haver a
-- combinação «grant largo + zero política» à espera de um descuido.

REVOKE ALL ON TABLE public.denuncias_ficheiros_por_apagar FROM anon, authenticated;

/*
  Uma política RESTRICTIVE que nega a toda a gente por escrito, em vez de
  confiar apenas na ausência de políticas.

  «Sem política» e «política que nega» dão o mesmo resultado hoje, mas dizem
  coisas diferentes a quem lê o esquema a seguir: a primeira parece esquecimento
  e convida a «corrigir» com uma permissiva; a segunda é uma decisão escrita.
*/
ALTER TABLE public.denuncias_ficheiros_por_apagar FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fila de expurgo é só do serviço" ON public.denuncias_ficheiros_por_apagar;
CREATE POLICY "Fila de expurgo é só do serviço"
  ON public.denuncias_ficheiros_por_apagar
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name = 'denuncias_ficheiros_por_apagar'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'expurgo: a fila continua acessível a anon/authenticated';
  END IF;
  RAISE NOTICE 'expurgo: a fila de ficheiros de denúncia passa a ser só do serviço';
END $$;
