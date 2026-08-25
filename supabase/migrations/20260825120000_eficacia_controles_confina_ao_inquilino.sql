-- `eficacia_dos_controles` deixa de confiar no `empresa_id` que lhe passam.
--
-- ## O buraco
--
-- A função é `SECURITY DEFINER` — corre com os privilégios do dono, logo
-- IGNORA o RLS das tabelas que lê. Recebe `p_empresa_id` e filtra só por ele:
--
--     WHERE c.empresa_id = p_empresa_id AND t.estado = 'atestado'
--
-- Nada verifica que quem chama pertence a essa empresa. Um utilizador
-- autenticado de QUALQUER inquilino podia passar o `empresa_id` alheio e ler
-- a eficácia dos controlos de outra empresa — que teste correu, com que
-- resultado, quem testou, quem atestou. Provado por impersonação: um
-- utilizador da empresa B leu uma linha de controlo da empresa A.
--
-- É a armadilha clássica das funções DEFINER que recebem o inquilino como
-- argumento em vez de o derivarem da sessão. A tabela por baixo tem RLS
-- correcto; a função saltava-o por definição.
--
-- ## A correcção
--
-- O `empresa_id` efectivo passa a vir de `get_user_empresa_id()` — a mesma
-- função em que 322 políticas confiam — e o parâmetro só é aceite como o da
-- própria empresa, ou de qualquer uma para super_admin. Pedir outra empresa
-- devolve zero linhas, como se não existisse. A assinatura não muda, por isso
-- o front-end (que hoje nem sequer a chama) continuaria a funcionar tal e qual.

CREATE OR REPLACE FUNCTION public.eficacia_dos_controles(p_empresa_id uuid)
RETURNS TABLE(
  controle_id uuid,
  ultimo_teste_id uuid,
  data_teste date,
  resultado text,
  eficacia_desenho text,
  eficacia_operacional text,
  amostra_total integer,
  amostra_excecoes integer,
  testador_id uuid,
  atestado_por uuid,
  atestado_em timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH alcance AS (
    /*
      O inquilino é o da SESSÃO, não o do argumento.

      - super_admin: pode consultar a empresa que pedir (ou a sua, se pedir
        NULL — mas não deve, e o COALESCE cobre esse caso).
      - qualquer outro: só a sua. Passar o `empresa_id` de outra empresa cai
        aqui e o SELECT lá em baixo não encontra nada.
    */
    SELECT CASE
             WHEN public.is_super_admin() THEN COALESCE(p_empresa_id, public.get_user_empresa_id())
             ELSE public.get_user_empresa_id()
           END AS empresa_id
  )
  SELECT DISTINCT ON (t.controle_id)
    t.controle_id, t.id, t.data_teste, t.resultado,
    t.eficacia_desenho, t.eficacia_operacional,
    t.amostra_total, t.amostra_excecoes,
    t.testador_id, t.atestado_por, t.atestado_em
  FROM public.controles_testes t
  JOIN public.controles c ON c.id = t.controle_id
  JOIN alcance a ON a.empresa_id = c.empresa_id
  WHERE c.empresa_id = p_empresa_id
    AND t.estado = 'atestado'
  ORDER BY t.controle_id, t.data_teste DESC, t.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.eficacia_dos_controles(uuid) TO authenticated;

/*
  Deixa de estar ao alcance do anon.

  É informação de negócio — eficácia de controlos internos — e não tem nada que
  responder a quem não fez sequer login. O acesso do anon vinha do EXECUTE por
  omissão a PUBLIC, não de um GRANT explícito — daí revogar de PUBLIC.
*/
REVOKE EXECUTE ON FUNCTION public.eficacia_dos_controles(uuid) FROM PUBLIC, anon;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.eficacia_dos_controles(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'controlos: a eficácia continua ao alcance do anon';
  END IF;
  RAISE NOTICE 'controlos: a eficácia passa a confinar-se ao inquilino da sessão';
END $$;
