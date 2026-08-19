-- Integridade referencial e vocabulário de estado.
--
-- Dois defeitos que só existem porque o banco deixa.

-- ── 1. `ropa_dados_vinculados` sem chave estrangeira nenhuma ────────────────
--
-- A tabela que liga dados pessoais a registos ROPA não tinha uma única FK.
-- Apagar um ROPA deixava as ligações para trás, e a coluna "ROPAs" do catálogo
-- contava-as: um dado da Akuris declarava 9 ROPAs numa empresa com zero
-- registos ROPA. Num módulo de privacidade, isso é o inventário a mentir sobre
-- onde o dado é tratado.
--
-- Primeiro limpar o que já ficou órfão — não há como recuperar a que ROPA
-- apontavam, e mantê-las é manter a contagem errada.
DELETE FROM public.ropa_dados_vinculados v
 WHERE NOT EXISTS (SELECT 1 FROM public.ropa_registros r WHERE r.id = v.ropa_id)
    OR NOT EXISTS (SELECT 1 FROM public.dados_pessoais d WHERE d.id = v.dados_pessoais_id);

ALTER TABLE public.ropa_dados_vinculados
  DROP CONSTRAINT IF EXISTS ropa_dados_vinculados_ropa_id_fkey;
ALTER TABLE public.ropa_dados_vinculados
  ADD CONSTRAINT ropa_dados_vinculados_ropa_id_fkey
  FOREIGN KEY (ropa_id) REFERENCES public.ropa_registros(id) ON DELETE CASCADE;

ALTER TABLE public.ropa_dados_vinculados
  DROP CONSTRAINT IF EXISTS ropa_dados_vinculados_dados_pessoais_id_fkey;
ALTER TABLE public.ropa_dados_vinculados
  ADD CONSTRAINT ropa_dados_vinculados_dados_pessoais_id_fkey
  FOREIGN KEY (dados_pessoais_id) REFERENCES public.dados_pessoais(id) ON DELETE CASCADE;

-- Uma ligação por par: sem isto, importar duas vezes duplica a contagem.
CREATE UNIQUE INDEX IF NOT EXISTS ropa_dados_vinculados_par_unico
  ON public.ropa_dados_vinculados (ropa_id, dados_pessoais_id);

-- ── 2. `auditorias.status` com dois vocabulários a viver lado a lado ────────
--
-- O banco tem `planejamento` e `planejada`, `em_andamento` e `em_execucao`,
-- para as mesmas duas coisas. O filtro do ecrã oferece quatro valores e não
-- conhece dois deles: a Nexure mostrava "Em Andamento 1" e filtrar por "Em
-- Andamento" devolvia zero. Não havia CHECK nenhum a impedir.
UPDATE public.auditorias SET status = 'planejamento' WHERE status = 'planejada';
UPDATE public.auditorias SET status = 'em_andamento' WHERE status = 'em_execucao';

ALTER TABLE public.auditorias DROP CONSTRAINT IF EXISTS auditorias_status_conhecido;
ALTER TABLE public.auditorias
  ADD CONSTRAINT auditorias_status_conhecido
  CHECK (status IN ('planejamento', 'em_andamento', 'concluida', 'cancelada'));
