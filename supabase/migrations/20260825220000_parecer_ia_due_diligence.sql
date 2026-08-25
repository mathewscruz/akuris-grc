-- O Akuris passa a ler o questionário do fornecedor por ti.
--
-- ## O que faltava
--
-- Quando o fornecedor terminava o questionário, o produto calculava um número
-- (`score_final`, média ponderada das notas) e parava aí. Quem tinha de LER as
-- respostas, abrir as evidências anexadas e decidir se aquilo era aceitável era
-- a pessoa — uma a uma, avaliação a avaliação. O score dizia «72%» e não dizia
-- porquê, nem o que estava bem, nem o que faltava.
--
-- Agora a IA lê o que foi respondido, olha para as evidências que vieram
-- anexadas, e devolve um parecer: nível de risco, resumo, pontos fortes, pontos
-- de atenção e o que pedir a seguir.
--
-- ## Porquê uma coluna JSONB e não cinco colunas
--
-- O parecer é um documento, não um conjunto de campos independentes: as partes
-- só fazem sentido juntas e mudam de forma conforme o questionário. Guardar
-- como JSONB deixa a estrutura evoluir sem migrar a tabela a cada ajuste do
-- prompt, e mantém a versão do modelo ao lado do texto — sem isso, daqui a seis
-- meses ninguém sabe que modelo escreveu aquele parecer.
--
-- O `score_final` continua a ser o número calculado das respostas. O parecer da
-- IA é uma leitura ADICIONAL, e é assim que aparece no ecrã: o número é
-- aritmética verificável, o parecer é interpretação.

ALTER TABLE public.due_diligence_assessments
  ADD COLUMN IF NOT EXISTS ia_parecer jsonb,
  ADD COLUMN IF NOT EXISTS ia_avaliado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ia_nivel_risco text;

COMMENT ON COLUMN public.due_diligence_assessments.ia_parecer IS
  'Parecer da IA sobre as respostas e evidências: { resumo, pontosFortes[], pontosAtencao[], recomendacoes[], evidenciasEmFalta[], confianca, modelo }. Documento, não campos soltos — a forma acompanha o questionário.';

COMMENT ON COLUMN public.due_diligence_assessments.ia_nivel_risco IS
  'Nível de risco que a IA atribuiu (baixo/medio/alto/critico). Separado do JSON para se poder filtrar e ordenar sem abrir o documento.';

COMMENT ON COLUMN public.due_diligence_assessments.ia_avaliado_em IS
  'Quando o parecer foi produzido. Nulo = ainda não avaliado (ou avaliação falhou).';

-- Filtrar «mostra-me os fornecedores que a IA marcou como alto risco» tem de
-- ser barato; é a pergunta que se faz primeiro ao abrir a lista.
CREATE INDEX IF NOT EXISTS idx_dd_assessments_ia_nivel
  ON public.due_diligence_assessments(empresa_id, ia_nivel_risco)
  WHERE ia_nivel_risco IS NOT NULL;

ALTER TABLE public.due_diligence_assessments
  DROP CONSTRAINT IF EXISTS dd_assessments_ia_nivel_check;
ALTER TABLE public.due_diligence_assessments
  ADD CONSTRAINT dd_assessments_ia_nivel_check
  CHECK (ia_nivel_risco IS NULL OR ia_nivel_risco IN ('baixo', 'medio', 'alto', 'critico'));

DO $$
BEGIN
  RAISE NOTICE 'due_diligence_assessments: parecer da IA passa a ter onde ficar';
END $$;
