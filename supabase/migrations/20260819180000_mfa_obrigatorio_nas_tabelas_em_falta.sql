-- O segundo fator não valia para oito tabelas — incluindo o ROPA.
--
-- O produto exige MFA através de uma política RESTRITIVA por tabela:
--
--   CREATE POLICY "Require valid MFA session" ON <tabela>
--     AS RESTRICTIVE FOR ALL TO authenticated
--     USING (has_valid_mfa_session()) WITH CHECK (has_valid_mfa_session());
--
-- 149 das 166 tabelas com RLS têm essa política. Dezassete não tinham, e nem
-- todas por engano: `mfa_codes` e `mfa_sessions` são precisas PARA fazer o MFA,
-- e as quatro tabelas de limite de taxa servem fluxos públicos (formulário de
-- contacto, denúncia, recuperação de senha, registo). Essas ficam de fora de
-- propósito.
--
-- As restantes eram esquecimento, e o efeito foi medido, não deduzido. Com um
-- token de acesso obtido só com a senha — sem qualquer sessão MFA na base — a
-- API REST devolveu e ACEITOU ALTERAR o registo de operações de tratamento:
--
--   GET   /rest/v1/ropa_exercicios  → [{"nome":"ROPA 2026 - inventario ..."}]
--   PATCH /rest/v1/ropa_exercicios  → 200, nome alterado
--   GET   /rest/v1/riscos           → []        (esta tinha a política)
--
-- É exatamente o que o segundo fator existe para impedir: senha roubada não
-- deve bastar. O isolamento entre empresas manteve-se — só se vê a própria —
-- e o acesso anónimo continua fechado, por isso o alcance é o inquilino do
-- utilizador, não o SaaS inteiro.
--
-- Nota sobre o alcance real: a política do lado do cliente não conta. O
-- `AuthProvider` guarda um `akuris_mfa_verified_until` em `sessionStorage` e
-- salta a verificação remota enquanto ele estiver no futuro, mas isso é
-- irrelevante para segurança — quem tem a senha fala com a API diretamente e
-- nunca passa pela aplicação. A fronteira real é esta, a do banco.

DO $$
DECLARE
  t text;
  -- Tabelas de negócio do inquilino que estavam sem o segundo fator.
  alvos text[] := ARRAY[
    'ropa_exercicios',
    'ropa_exercicio_anexos',
    'implementacao_programas',
    'programa_fases',
    'programa_itens',
    'programa_ferramentas',
    'controles_requisitos',
    'riscos_requisitos',
    -- Já estava protegida por arrasto (a política de leitura junta-se a
    -- `riscos`, que é barrada). Fica explícita para não depender disso.
    'riscos_comentarios',
    -- Referência partilhada, sem `empresa_id`. Não há segredo aqui, mas quem
    -- não passou o segundo fator não deve ler nada — é mais simples de
    -- verificar do que uma lista de exceções.
    'riscos_biblioteca',
    'gap_analysis_requirement_crosswalk'
  ];
BEGIN
  FOREACH t IN ARRAY alvos LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'tabela % não existe nesta base, ignorada', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Require valid MFA session" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Require valid MFA session" ON public.%I '
      'AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (public.has_valid_mfa_session()) '
      'WITH CHECK (public.has_valid_mfa_session())', t);
  END LOOP;
END $$;

-- Nota sobre o papel das políticas permissivas, que NÃO se corrige aqui:
--
-- 376 das 541 políticas permissivas do produto estão concedidas a `public` e
-- não a `authenticated` — em 112 tabelas. Em Postgres `public` é toda a gente,
-- incluindo `anon`. Na prática o pedido anónimo é recusado, mas por acidente:
-- `anon` não tem EXECUTE em `get_user_empresa_id()`, e o que volta é
--
--   {"code":"42501","message":"permission denied for function get_user_empresa_id"}
--
-- A barreira existe e vale para todas as tabelas por igual, por isso não é
-- buraco. É frágil: um `GRANT ... ON ALL FUNCTIONS` feito sem cuidado abre 112
-- tabelas de uma vez. A correção certa é uma varredura única sobre as 376, não
-- um punhado de tabelas aqui — mexer em quatro só criava divergência entre
-- tabelas irmãs. Fica registado para decisão à parte.
