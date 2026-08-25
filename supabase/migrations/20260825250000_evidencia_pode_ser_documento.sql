-- A biblioteca de evidências passa a poder apontar para um documento aprovado.
--
-- ## O que já existia, e ninguém reparou
--
-- `evidence_library` + `evidence_library_links` é a biblioteca central de
-- evidências, e é um desenho completo: o ficheiro tem validade
-- (`valido_ate`), periodicidade de renovação, hash e etiquetas; a ligação sabe
-- apontar a um requisito, a um framework, a uma avaliação, e a QUALQUER módulo
-- (`modulo` + `registro_id`), com tipo de vínculo, parecer de IA e aceitação
-- registada.
--
-- Ou seja: a consolidação que se procurava já estava construída. O que faltava
-- era o contrário do que parecia — não mais uma tabela, mas uma coluna.
--
-- ## A coluna que faltava
--
-- A biblioteca só sabia guardar FICHEIROS. E a evidência mais forte que uma
-- empresa tem não é um ficheiro solto: é o documento aprovado, que já vive em
-- `documentos` com versão, aprovador, validade e histórico.
--
-- Sem esta ponte, provar um requisito com a Política de Segurança da
-- Informação obrigava a carregar de novo o mesmo PDF — uma cópia sem versão,
-- sem aprovador e sem ligação ao original. Revista a política, a cópia ficava
-- para trás a provar uma coisa que já não é verdade.
--
-- Agora uma entrada da biblioteca é uma de duas coisas: um ficheiro carregado,
-- ou um ponteiro para um documento aprovado. Tudo o que vem a seguir — ligar a
-- requisitos, validade, aceitação — funciona igual nos dois casos.

ALTER TABLE public.evidence_library
  ADD COLUMN IF NOT EXISTS documento_id uuid REFERENCES public.documentos(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.evidence_library.documento_id IS
  'Quando preenchido, esta evidência É um documento aprovado do módulo Documentos, não um ficheiro carregado à parte. Exclusivo com arquivo_url.';

-- A restrição ANTERIOR (`evidence_library_has_source`) exigia ficheiro ou link
-- externo -- foi escrita quando uma evidência só podia ser um dos dois, e
-- recusaria toda a entrada que fosse um documento. Passa a conhecer a terceira
-- origem; é substituída, não acrescentada, para não haver duas regras a dizer
-- coisas diferentes sobre a mesma coluna.
ALTER TABLE public.evidence_library
  DROP CONSTRAINT IF EXISTS evidence_library_has_source;
ALTER TABLE public.evidence_library
  ADD CONSTRAINT evidence_library_has_source
  CHECK (arquivo_url IS NOT NULL OR link_externo IS NOT NULL OR documento_id IS NOT NULL);

-- Uma entrada é ficheiro OU documento, nunca as duas coisas nem nenhuma: sem
-- isto, nasceriam entradas vazias que aparecem na biblioteca e não abrem nada.
ALTER TABLE public.evidence_library
  DROP CONSTRAINT IF EXISTS evidence_library_ficheiro_ou_documento;
ALTER TABLE public.evidence_library
  ADD CONSTRAINT evidence_library_ficheiro_ou_documento
  CHECK (
    (documento_id IS NOT NULL AND arquivo_url IS NULL)
    OR (documento_id IS NULL AND (arquivo_url IS NOT NULL OR link_externo IS NOT NULL))
  );

-- O mesmo documento não entra duas vezes na biblioteca da mesma empresa: era
-- assim que nasciam duplicados invisíveis, cada um com as suas ligações.
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_library_documento_por_empresa
  ON public.evidence_library(empresa_id, documento_id)
  WHERE documento_id IS NOT NULL;

-- A pergunta que se faz ao abrir um requisito é «que evidências tem?».
CREATE INDEX IF NOT EXISTS idx_evidence_links_requisito
  ON public.evidence_library_links(requirement_id)
  WHERE requirement_id IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE 'evidence_library: uma evidência pode agora ser um documento aprovado';
END $$;
