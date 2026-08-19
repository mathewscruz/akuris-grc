-- Evidência de controlo interno passa a viver na biblioteca partilhada.
--
-- `controles_evidencias` era um repositório à parte: o mesmo ficheiro que prova
-- um controlo interno e um requisito de norma tinha de ser carregado duas vezes,
-- e cada cópia envelhecia por conta própria. O par
-- `evidence_library` + `evidence_library_links` já é o padrão do sistema — a
-- tabela de vínculos até tem `modulo`/`registro_id` com índice próprio à espera
-- de ser usada. Faltava ligá-la.
--
-- A tabela antiga fica no lugar, marcada como obsoleta: primeiro confirma-se em
-- produção que a leitura pela biblioteca está correcta, só depois se remove.

-- Os ficheiros já carregados vivem noutro bucket (`controles-evidencias`) e não
-- são movidos: a biblioteca passa a registar de que bucket veio cada entrada.
ALTER TABLE public.evidence_library
  ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'gap-evidence-library';

COMMENT ON COLUMN public.evidence_library.bucket IS
  'Bucket onde o ficheiro está guardado. Entradas migradas de outros módulos mantêm o bucket de origem.';

-- Migração das evidências de controlo existentes.
WITH inseridas AS (
  INSERT INTO public.evidence_library (
    empresa_id, nome, descricao, arquivo_url, arquivo_nome, arquivo_tipo,
    arquivo_tamanho, bucket, created_by, created_at, updated_at
  )
  SELECT c.empresa_id,
         ce.nome,
         ce.descricao,
         ce.arquivo_url,
         ce.arquivo_nome,
         ce.arquivo_tipo,
         ce.arquivo_tamanho,
         'controles-evidencias',
         ce.created_by,
         ce.created_at,
         ce.updated_at
    FROM public.controles_evidencias ce
    JOIN public.controles c ON c.id = ce.controle_id
   WHERE ce.arquivo_url IS NOT NULL
   RETURNING id, empresa_id, arquivo_url, created_by, created_at
)
INSERT INTO public.evidence_library_links (
  empresa_id, evidence_id, modulo, registro_id, vinculo_tipo, aceito_em, created_by, created_at
)
SELECT i.empresa_id,
       i.id,
       'controles',
       ce.controle_id,
       'manual',
       i.created_at,
       i.created_by,
       i.created_at
  FROM inseridas i
  JOIN public.controles_evidencias ce ON ce.arquivo_url = i.arquivo_url;

-- Um ficheiro não deve ser ligado duas vezes ao mesmo registo.
CREATE UNIQUE INDEX IF NOT EXISTS evidence_links_registro_uidx
  ON public.evidence_library_links (evidence_id, modulo, registro_id)
  WHERE registro_id IS NOT NULL;

COMMENT ON TABLE public.controles_evidencias IS
  'OBSOLETA desde 17/08/2026: a evidência de controlo vive em evidence_library + evidence_library_links (modulo = ''controles''). Manter só até a leitura pela biblioteca estar confirmada em produção.';
