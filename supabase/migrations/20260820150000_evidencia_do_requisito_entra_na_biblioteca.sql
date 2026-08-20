-- A evidência anexada num requisito passa mesmo a aparecer na Biblioteca.
--
-- O ecrã vazio da aba "Biblioteca de Evidências" diz, com todas as letras:
--
--     "Faça upload de evidências dentro de qualquer requisito do Gap Analysis.
--      Elas aparecerão aqui automaticamente para reuso."
--
-- Não apareciam. O anexo de um requisito ia para
-- `gap_analysis_evaluations.evidence_files` (um array JSON) no bucket
-- `documentos`, e a Biblioteca lê `evidence_library`, que só era escrita pelo
-- módulo Controles, noutro bucket. Prova disto na base de desenvolvimento: o
-- requisito A.5.1 da ISO/IEC 27001 tinha 1 ficheiro anexado e a
-- `evidence_library` tinha zero linhas.
--
-- O reuso da prova entre requisitos e entre frameworks é a razão de existir da
-- Biblioteca — é o que evita anexar a mesma política de senhas trinta vezes.
-- Estava desligado.
--
-- Porquê um gatilho e não código no ecrã: `evidence_files` é escrito ao gravar
-- a avaliação, e mais lado nenhum garante passar por lá — a aplicação do
-- resultado da análise documental, uma acção em lote ou um ecrã futuro
-- escrevem na mesma coluna. No banco, apanha-se toda a gente de uma vez, hoje
-- e amanhã.

-- ---------------------------------------------------------------- o gatilho
CREATE OR REPLACE FUNCTION public.espelhar_evidencia_na_biblioteca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f            jsonb;
  v_url        text;
  v_nome       text;
  v_tipo       text;
  v_tamanho    bigint;
  v_e_link     boolean;
  v_evidence   uuid;
  v_autor      uuid;
BEGIN
  IF NEW.evidence_files IS NULL OR jsonb_typeof(NEW.evidence_files) <> 'array' THEN
    RETURN NEW;
  END IF;

  -- Sem empresa não há a quem pertencer a prova.
  IF NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_autor := COALESCE(auth.uid(), NEW.created_by);

  FOR f IN SELECT * FROM jsonb_array_elements(NEW.evidence_files)
  LOOP
    v_url := NULLIF(COALESCE(f->>'path', f->>'url'), '');
    CONTINUE WHEN v_url IS NULL;

    v_nome    := COALESCE(NULLIF(f->>'name', ''), v_url);
    v_tipo    := NULLIF(f->>'type', '');
    v_e_link  := (v_tipo = 'link');
    v_tamanho := NULLIF(f->>'size', '')::bigint;

    /*
      A identidade da prova é o caminho (ou o URL externo) dentro da empresa.
      O mesmo ficheiro anexado em dois requisitos tem de ser UMA linha na
      biblioteca com dois vínculos — senão o reuso não existe, só duplicação.
    */
    SELECT id INTO v_evidence
      FROM public.evidence_library
     WHERE empresa_id = NEW.empresa_id
       AND COALESCE(arquivo_url, link_externo) = v_url
     LIMIT 1;

    IF v_evidence IS NULL THEN
      INSERT INTO public.evidence_library (
        empresa_id, nome, arquivo_url, arquivo_nome, arquivo_tipo,
        arquivo_tamanho, link_externo, bucket, origem_evaluation_id, created_by
      ) VALUES (
        NEW.empresa_id,
        v_nome,
        CASE WHEN v_e_link THEN NULL ELSE v_url END,
        CASE WHEN v_e_link THEN NULL ELSE v_nome END,
        CASE WHEN v_e_link THEN NULL ELSE v_tipo END,
        CASE WHEN v_e_link THEN NULL ELSE v_tamanho END,
        CASE WHEN v_e_link THEN v_url ELSE NULL END,
        -- O anexo do requisito vive no bucket `documentos`; o da biblioteca,
        -- em `gap-evidence-library`. A coluna guarda qual é para que a URL
        -- assinada seja pedida ao bucket certo.
        CASE WHEN v_e_link THEN 'gap-evidence-library' ELSE 'documentos' END,
        NEW.id,
        v_autor
      )
      RETURNING id INTO v_evidence;
    END IF;

    INSERT INTO public.evidence_library_links (
      empresa_id, evidence_id, evaluation_id, requirement_id, framework_id,
      vinculo_tipo, aceito_em, aceito_por, created_by
    ) VALUES (
      NEW.empresa_id, v_evidence, NEW.id, NEW.requirement_id, NEW.framework_id,
      'manual', now(), v_autor, v_autor
    )
    ON CONFLICT (evidence_id, evaluation_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.espelhar_evidencia_na_biblioteca() IS
  'Espelha gap_analysis_evaluations.evidence_files em evidence_library + evidence_library_links, para que a prova anexada num requisito fique reutilizável noutros requisitos e frameworks.';

DROP TRIGGER IF EXISTS trg_espelhar_evidencia_na_biblioteca ON public.gap_analysis_evaluations;
CREATE TRIGGER trg_espelhar_evidencia_na_biblioteca
  AFTER INSERT OR UPDATE OF evidence_files ON public.gap_analysis_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.espelhar_evidencia_na_biblioteca();

-- ------------------------------------------------ o que já estava anexado
--
-- Quem anexou prova antes deste gatilho não tem de a anexar outra vez. Um
-- UPDATE que não muda nada dispara o gatilho e recupera o passado.
UPDATE public.gap_analysis_evaluations
   SET evidence_files = evidence_files
 WHERE evidence_files IS NOT NULL
   AND jsonb_typeof(evidence_files) = 'array'
   AND jsonb_array_length(evidence_files) > 0;
