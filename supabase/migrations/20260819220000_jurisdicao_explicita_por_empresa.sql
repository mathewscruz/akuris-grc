-- A jurisdição da empresa estava por preencher — e por isso era do navegador.
--
-- Medido numa cópia da base de produção: `empresas.jurisdicao` é NULL nas SETE
-- empresas, e 11 dos 13 perfis estão em `preferred_locale = 'pt'`, que é
-- português de PORTUGAL.
--
-- ---------------------------------------------------------------------------
-- Por que isto importa mais do que a grafia
-- ---------------------------------------------------------------------------
-- `useJurisdicao` resolve assim:
--
--   const codigo = data || inferirJurisdicao(locale);
--
-- Com `jurisdicao` nula entra a inferência, e ela lê o NAVEGADOR — domínio,
-- `navigator.languages`, fuso horário. Ou seja: a jurisdição deixa de ser uma
-- propriedade da EMPRESA e passa a ser uma propriedade de quem está sentado à
-- frente do ecrã. Dois colegas da mesma empresa, um em viagem, podem ver bases
-- legais diferentes (Art. 7 da LGPD vs Art. 6 do RGPD), direitos do titular
-- diferentes e prazos de resposta diferentes — 15 dias contra 30.
--
-- Hoje isso não se manifesta por sorte: a inferência testa o domínio primeiro,
-- e produção corre em `akuris.com.br`, logo devolve 'BR'. Basta um ambiente de
-- pré-produção noutro domínio, ou um acesso pelo IP, para o produto mudar de
-- lei sozinho.
--
-- ---------------------------------------------------------------------------
-- BR como omissão, não como imposição
-- ---------------------------------------------------------------------------
-- É o mercado principal, é o que a inferência já devolve em produção, e o
-- administrador altera em Configurações › Contexto da empresa
-- (`CompanyContextSettings.tsx`), onde o seletor das três jurisdições já vive.
-- O que se ganha é a jurisdição passar a ser um facto guardado, e não um palpite
-- recalculado a cada sessão.

ALTER TABLE public.empresas ALTER COLUMN jurisdicao SET DEFAULT 'BR';

UPDATE public.empresas SET jurisdicao = 'BR' WHERE jurisdicao IS NULL;

COMMENT ON COLUMN public.empresas.jurisdicao IS
  'Lei aplicável à empresa: BR (LGPD), PT_EU (RGPD) ou INTL. Sem valor, a aplicação inferia do navegador e a jurisdição variava por utilizador.';

-- ---------------------------------------------------------------------------
-- O idioma, agora que a jurisdição existe
-- ---------------------------------------------------------------------------
-- A migration 20260817140000 já trazia este backfill, mas condicionado a
-- `e.jurisdicao = 'BR'` — e como a coluna estava NULA em toda a base, não tocou
-- em ninguém. Repetido aqui, depois de a jurisdição passar a estar preenchida.
--
-- Só mexe em quem está em 'pt' numa empresa BR. Quem escolheu português de
-- Portugal de propósito numa empresa PT_EU fica intocado, e o seletor de idioma
-- continua disponível para quem quiser voltar.
UPDATE public.profiles p
   SET preferred_locale = 'pt-BR'
  FROM public.empresas e
 WHERE p.empresa_id = e.id
   AND e.jurisdicao = 'BR'
   AND p.preferred_locale = 'pt';
