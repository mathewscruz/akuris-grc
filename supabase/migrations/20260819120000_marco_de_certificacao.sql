-- Marco de certificação: a data-alvo que a coluna "PRÓXIMO MARCO" prometia.
--
-- A coluna existia no cabeçalho do módulo com um texto a convidar ("defina um
-- marco para acompanhar o progresso") e um botão cujo `onClick` era um bloco
-- vazio com um `// TODO: abrir dialog quando schema existir`. O convite estava
-- na tela desde sempre; o schema é este.
--
-- É também o que dá sentido ao "Δ 30 dias" ao lado: sem alvo nem prazo, saber
-- que o score subiu dois pontos não responde à única pergunta que a diretoria
-- faz — dá tempo até a auditoria?
--
-- O marco pertence ao **framework**, nunca à empresa.
--
-- A primeira versão desta tabela aceitava `framework_id NULL` para um marco da
-- carteira inteira, exibido no cabeçalho da lista. Está errado: a empresa
-- escolhe quantos frameworks quiser, e "faltam 35 pontos para a meta" não quer
-- dizer nada quando o índice é a média ponderada de ISO 27001, LGPD e NIST CSF.
-- Quem certifica, certifica um framework, numa data, com um escopo. A lista
-- passa a mostrar o marco mais próximo entre os frameworks ativos, dizendo de
-- qual é — e a definição acontece dentro do framework.
--
-- Não é uma agenda de projeto — para isso existe o módulo de projetos; é a
-- linha de chegada contra a qual o score daquele framework é lido.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gap_analysis_marcos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  framework_id uuid NOT NULL REFERENCES public.gap_analysis_frameworks(id) ON DELETE CASCADE,
  rotulo text NOT NULL,
  data_alvo date NOT NULL,
  score_alvo integer NOT NULL,
  concluido_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marco_rotulo_nao_vazio CHECK (length(btrim(rotulo)) > 0),
  CONSTRAINT marco_score_alvo_valido CHECK (score_alvo BETWEEN 1 AND 100)
);

-- Um marco em aberto de cada vez por framework. Dois alvos simultâneos tornam
-- ambígua a pergunta "estamos no prazo?", que é exatamente o que este quadro
-- existe para responder.
CREATE UNIQUE INDEX IF NOT EXISTS marco_aberto_por_framework
  ON public.gap_analysis_marcos (empresa_id, framework_id)
  WHERE concluido_em IS NULL;

CREATE INDEX IF NOT EXISTS marco_por_empresa_e_data
  ON public.gap_analysis_marcos (empresa_id, data_alvo);

COMMENT ON TABLE public.gap_analysis_marcos IS
  'Data-alvo e score-alvo de certificação de um framework, por empresa.';

CREATE OR REPLACE FUNCTION public.gap_marcos_toca_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gap_marcos_updated_at ON public.gap_analysis_marcos;
CREATE TRIGGER trg_gap_marcos_updated_at
  BEFORE UPDATE ON public.gap_analysis_marcos
  FOR EACH ROW EXECUTE FUNCTION public.gap_marcos_toca_updated_at();

ALTER TABLE public.gap_analysis_marcos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marcos_leitura ON public.gap_analysis_marcos;
CREATE POLICY marcos_leitura ON public.gap_analysis_marcos
  FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS marcos_insercao ON public.gap_analysis_marcos;
CREATE POLICY marcos_insercao ON public.gap_analysis_marcos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS marcos_atualizacao ON public.gap_analysis_marcos;
CREATE POLICY marcos_atualizacao ON public.gap_analysis_marcos
  FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS marcos_remocao ON public.gap_analysis_marcos;
CREATE POLICY marcos_remocao ON public.gap_analysis_marcos
  FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id());

-- Mesma exigência de sessão com MFA das restantes tabelas do módulo.
DROP POLICY IF EXISTS marcos_exige_mfa ON public.gap_analysis_marcos;
CREATE POLICY marcos_exige_mfa ON public.gap_analysis_marcos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_valid_mfa_session())
  WITH CHECK (has_valid_mfa_session());

COMMIT;
