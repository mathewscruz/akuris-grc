-- Auditoria de RLS: quem está de fora das duas fronteiras do produto.
--
-- Corre só SELECT. Serve para produção e para qualquer ambiente.
--
--   psql "$URL" -f scripts/auditoria-rls.sql
--
-- Duas perguntas, porque foram as duas que já falharam em silêncio:
--
--   1. Tabela de negócio sem o segundo fator. Em 19/08/2026 eram oito, e uma
--      delas era o ROPA: com um token obtido só com a senha, a API devolvia e
--      aceitava ALTERAR o registo de operações de tratamento.
--
--   2. Tabela com RLS ligada mas sem política de escrita nenhuma. O Postgres
--      recusa em silêncio e o cliente do Supabase não lança, por isso o ecrã
--      diz "guardado". Foi o caso de `notifications` e de todo o Due Diligence.
--
-- Zero linhas nos dois blocos = as fronteiras estão inteiras.

\echo ''
\echo '=== 1. Tabelas de negócio SEM exigência de MFA ==='
\echo '(esperado: vazio. As isentas de propósito estão na lista de exceções.)'
\echo ''

SELECT c.relname AS tabela,
       CASE WHEN a.attname IS NOT NULL THEN 'dados do inquilino' ELSE 'referência' END AS natureza
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attribute a
       ON a.attrelid = c.oid AND a.attname = 'empresa_id' AND a.attnum > 0 AND NOT a.attisdropped
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname
          AND p.permissive = 'RESTRICTIVE'
          AND (p.qual ILIKE '%has_valid_mfa_session%'
            OR p.with_check ILIKE '%has_valid_mfa_session%'))
  -- Isentas por desenho: as duas primeiras são precisas PARA fazer o MFA; as
  -- quatro seguintes servem fluxos públicos, onde não há utilizador nenhum.
  AND c.relname NOT IN (
        'mfa_codes', 'mfa_sessions',
        'contact_form_rate_limits', 'denuncia_submission_limits',
        'password_reset_limits', 'public_registration_limits')
ORDER BY 2, 1;

\echo ''
\echo '=== 2. Tabelas com RLS mas SEM nenhuma política de escrita ==='
\echo '(escrita do navegador nestas falha em silêncio; se a aplicação escreve,'
\echo ' ou falta política, ou a escrita devia passar por função SECURITY DEFINER)'
\echo ''

SELECT c.relname AS tabela,
       string_agg(DISTINCT p.cmd, ', ' ORDER BY p.cmd) AS politicas_existentes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p
       ON p.schemaname = 'public' AND p.tablename = c.relname AND p.permissive = 'PERMISSIVE'
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
GROUP BY c.relname
HAVING NOT bool_or(p.cmd IN ('INSERT', 'ALL'))
ORDER BY 1;

\echo ''
\echo '=== 3. Políticas concedidas a `public` em vez de `authenticated` ==='
\echo '(resumo, não listagem: é o padrão dominante do produto, não uma exceção.'
\echo ' Em Postgres `public` inclui `anon`. O que hoje fecha a porta é `anon`'
\echo ' não ter EXECUTE em get_user_empresa_id() — uma falta de GRANT, não uma'
\echo ' decisão da política. Vigiar o número; se subir, alguém alargou.)'
\echo ''

SELECT count(*) FILTER (WHERE roles::text[] @> ARRAY['public'])        AS politicas_para_public,
       count(*) FILTER (WHERE roles::text[] @> ARRAY['authenticated']) AS politicas_para_authenticated,
       count(DISTINCT tablename) FILTER (WHERE roles::text[] @> ARRAY['public']) AS tabelas_afetadas
FROM pg_policies
WHERE schemaname = 'public' AND permissive = 'PERMISSIVE';

\echo ''
\echo '--- `anon` tem EXECUTE em get_user_empresa_id()? (esperado: f) ---'
\echo ''

SELECT has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_pode_executar
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_user_empresa_id'
  AND pg_get_function_identity_arguments(p.oid) = '';
