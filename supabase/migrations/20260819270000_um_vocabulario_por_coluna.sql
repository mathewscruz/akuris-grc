-- Um valor por conceito, com CHECK a garantir.
--
-- Três colunas de domínio ganharam sinónimos ao longo do tempo, e os filtros
-- do ecrã oferecem uma das grafias. Quem escolhe a grafia errada vê uma tabela
-- vazia sobre dados que existem — e não há como saber que o problema é a
-- grafia. Sem CHECK, nada impede que volte a divergir amanhã.

-- ── contratos.tipo: `servicos` e `servico` para a mesma coisa ───────────────
--
-- Já existe `contratos_tipo_check` a declarar `servicos` como valor válido, e
-- é essa a grafia que o filtro do ecrã oferece. Mas a constraint foi criada
-- NOT VALID: nunca verificou as linhas existentes, e o singular entrou à
-- vontade. Filtrar por "Serviços" escondia esses contratos.
--
-- Canónico é o plural, porque é o que a constraint e o ecrã já dizem.
UPDATE public.contratos SET tipo = 'servicos' WHERE tipo = 'servico';

-- Validar a constraint que existia sem nunca ter verificado nada.
ALTER TABLE public.contratos VALIDATE CONSTRAINT contratos_tipo_check;

-- ── dados_pessoais.sensibilidade: `normal` fora do vocabulário ─────────────
--
-- O filtro oferece comum / moderado / sensível / muito sensível. O banco grava
-- `normal`, que não está na lista, e nunca gravou `moderado`, que está. Os
-- dados marcados `normal` não apareciam em nenhum recorte de sensibilidade —
-- num módulo de privacidade, é o inventário a esconder registos.
UPDATE public.dados_pessoais SET sensibilidade = 'comum' WHERE sensibilidade = 'normal';

ALTER TABLE public.dados_pessoais DROP CONSTRAINT IF EXISTS dados_pessoais_sensibilidade_conhecida;
ALTER TABLE public.dados_pessoais
  ADD CONSTRAINT dados_pessoais_sensibilidade_conhecida
  CHECK (sensibilidade IS NULL OR sensibilidade IN ('comum', 'sensivel', 'muito_sensivel'));

-- ── documentos.status ──────────────────────────────────────────────────────
--
-- O filtro oferece `arquivado` (zero registos) e `vencido` (que não é estado
-- gravado — vencimento é uma data), e NÃO oferece `pendente`, que é o segundo
-- estado mais comum do produto. O CHECK fixa o que existe; o filtro do ecrã é
-- corrigido no mesmo commit.
ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS documentos_status_conhecido;
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_status_conhecido
  CHECK (status IS NULL OR status IN ('ativo', 'inativo', 'pendente', 'rascunho', 'arquivado'));
