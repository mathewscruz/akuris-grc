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

\echo ''
\echo '=== 4. Funções SECURITY DEFINER que recebem empresa_id e não a validam ==='
\echo '(o vetor do pentest de 25/08: DEFINER salta o RLS; se filtra só pelo'
\echo ' parâmetro, um inquilino lê/escreve no outro passando o empresa_id alheio.'
\echo ' Vazio = todas validam a sessão, ou estão na allowlist com motivo.)'
\echo ''

WITH candidatas AS (
  SELECT p.proname,
         pg_get_function_identity_arguments(p.oid) AS args,
         p.prosrc AS corpo
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND pg_get_function_arguments(p.oid) ~ 'p_empresa_id'
)
SELECT proname, args
FROM candidatas
WHERE corpo !~ 'get_user_empresa_id|gap_empresa_autorizada|exige_empresa_da_sessao|is_super_admin|is_admin_or_super_admin|auth\.uid'
  -- Allowlist, com o motivo de cada uma:
  AND proname NOT IN (
    -- Config PÚBLICA do canal, servida ao denunciante anónimo por desenho.
    -- Não devolve segredo nenhum — só o que a página pública mostra.
    'get_canal_config_publica',
    'get_denuncia_config_publica',
    'get_denuncias_categorias_publicas',
    -- Semeadura de dados de demonstração. Escreve na empresa passada, mas só é
    -- chamada no provisionamento (que já exige admin) e nunca do cliente.
    'popular_ativos_demo', 'popular_categorias_base', 'popular_controles_demo',
    'popular_dados_demonstracao_direto', 'popular_documentos_demo',
    'popular_incidentes_demo', 'popular_riscos_demo',
    -- Leitura pura da matriz vigente / cálculo; sem escrita, e o que "vaza" é a
    -- config da matriz, não dado de risco. Baixo valor, vigiado.
    'risco_avaliar', 'risco_matriz_vigente',
    -- Chamada só de dentro de provisionar_canal_denuncia (que valida), e já
    -- sem EXECUTE para authenticated/anon.
    'semear_comite_denuncias',
    -- Trigger interno; não é chamável por sessão.
    'sistema_do_diretorio'
  )
ORDER BY 1;

\echo ''
\echo '=== 5. Gatilhos de auditoria que RECUSAM escritas de integração ==='
\echo '(esperado: vazio. Ver 20260901040000_trilha_que_recusa_e_trilha_que_esquece.)'
\echo ''

-- `create_audit_log` gravava `get_user_empresa_id()` numa coluna NOT NULL. Sem
-- sessão de utilizador isso é NULL, o INSERT na trilha falha, e como o gatilho
-- corre dentro da transacção a ESCRITA ORIGINAL aborta com ele. Duas funções de
-- borda com `service_role` -- `api-inbound-webhook` e `azure-integration` --
-- nunca conseguiram gravar um activo nem um controlo.
--
-- A resposta certa é o `empresa_id` do próprio registo, que o gatilho tem em
-- `NEW`/`OLD`. Esta consulta procura quem voltou a depender só da sessão.
SELECT p.proname AS gatilho,
       'chama create_audit_log sem passar o empresa_id do registo' AS problema
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosrc ILIKE '%create_audit_log%'
  AND p.prosrc !~ '(NEW|OLD)\.empresa_id'
ORDER BY 1;

\echo ''
\echo '=== 6. Gatilhos de auditoria que ESQUECEM alterações ==='
\echo '(esperado: vazio. `!=` com NULL dá NULL, e a alteração não entra na trilha.)'
\echo ''

-- Comparar `OLD.x != NEW.x` numa coluna que aceita NULL faz desaparecer da
-- trilha toda a entrada e saída de NULL. Medido: uma trilha com 7 registos
-- ficou em 7 depois de pôr o estado do activo a NULL, e em 7 outra vez depois
-- de lhe dar estado. Numa ferramenta de GRC a trilha é o produto.
SELECT p.proname AS gatilho,
       (regexp_matches(p.prosrc, '(OLD\.[a-z_]+\s*!=\s*NEW\.[a-z_]+)', 'g'))[1] AS comparacao
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname ILIKE 'audit%changes'
ORDER BY 1;

\echo ''
\echo '=== 7. Perguntas de due diligence que o score NAO consegue distinguir ==='
\echo '(esperado: vazio. Ver 20260901060000_o_score_do_fornecedor_era_uma_constante.)'
\echo ''

-- O score era 50 para toda a gente: as 139 perguntas sao `radio` com opcoes
-- ["Sim","Nao"] e a funcao so reconhecia "excelente/bom/regular/ruim", caindo
-- sempre no ELSE 5. Medido: tudo "Sim" -> 50,00; tudo "Nao" -> 50,00.
--
-- Esta consulta pontua a PRIMEIRA e a ULTIMA opcao de cada pergunta fechada.
-- Se derem a mesma nota, aquela pergunta nao pesa no score -- responder bem ou
-- mal da no mesmo.
SELECT t.nome AS modelo,
       q.secao,
       left(q.titulo, 60) AS pergunta,
       public.dd_nota_da_resposta(q.tipo, q.opcoes, q.configuracoes, q.opcoes->>0, NULL) AS nota_primeira
FROM public.due_diligence_questions q
JOIN public.due_diligence_templates t ON t.id = q.template_id
WHERE q.tipo IN ('radio', 'select')
  AND jsonb_array_length(q.opcoes) >= 2
  AND public.dd_nota_da_resposta(q.tipo, q.opcoes, q.configuracoes, q.opcoes->>0, NULL)
      IS NOT DISTINCT FROM
      public.dd_nota_da_resposta(q.tipo, q.opcoes, q.configuracoes, q.opcoes->>(jsonb_array_length(q.opcoes)-1), NULL)
ORDER BY 1, 2;

\echo ''
\echo '=== 8. Perguntas onde "Sim" e a MA resposta e ninguem o declarou ==='
\echo '(esperado: vazio. `configuracoes.polaridade = negativa` inverte a nota.)'
\echo ''

-- Sete perguntas tem o sinal trocado: sancoes, autuacao laboral, condenacao por
-- corrupcao, dependencia de subfornecedor unico, PEP no quadro societario,
-- acidente grave, interrupcao nao planeada. Um padrao de texto achava DUAS; as
-- outras cinco so aparecem a ler as perguntas uma a uma. Esta consulta e a
-- rede: apanha formulacoes novas com o mesmo feitio que ninguem marcou.
SELECT t.nome AS modelo, left(q.titulo, 70) AS pergunta
FROM public.due_diligence_questions q
JOIN public.due_diligence_templates t ON t.id = q.template_id
WHERE (
        q.titulo ~* '(houve|foram|foi) .*(condenad|autuad|acidente|interrup|viola|vazamento|sanc)'
     OR q.titulo ~* 'consta de listas|politicamente exposta|depend[êe]ncia cr[íi]tica'
   )
   AND COALESCE(q.configuracoes->>'polaridade', 'positiva') <> 'negativa'
ORDER BY 1, 2;
