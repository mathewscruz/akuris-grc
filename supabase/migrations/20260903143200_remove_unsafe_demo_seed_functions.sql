-- Estas rotinas foram criadas para popular um ambiente de demonstração em
-- 2025. Elas ficaram acessíveis a `anon`/`authenticated` como SECURITY
-- DEFINER e hoje tentam escrever colunas que já não existem. O produto não as
-- chama; manter os endpoints só amplia a superfície de ataque e produz erros.
DROP FUNCTION IF EXISTS public.popular_dados_demonstracao();
DROP FUNCTION IF EXISTS public.popular_dados_demonstracao_direto(uuid, uuid);
DROP FUNCTION IF EXISTS public.popular_ativos_demo(uuid, uuid);
DROP FUNCTION IF EXISTS public.popular_categorias_base(uuid);
DROP FUNCTION IF EXISTS public.popular_controles_demo(uuid, uuid);
DROP FUNCTION IF EXISTS public.popular_documentos_demo(uuid, uuid);
DROP FUNCTION IF EXISTS public.popular_incidentes_demo(uuid, uuid);
DROP FUNCTION IF EXISTS public.popular_riscos_demo(uuid, uuid);
