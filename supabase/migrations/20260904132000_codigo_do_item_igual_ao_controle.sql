-- O mesmo registro lógico deve ter o mesmo código na Auditoria e em Controles.
--
-- A primeira versão do vínculo criava o controle sem informar `codigo`; o
-- gatilho sequencial então produzia CTRL-0001, embora o item tivesse, por
-- exemplo, DLT-0001. Esta versão preserva o código informado em toda criação e
-- sincroniza alterações apenas nos controles que nasceram automaticamente.

CREATE OR REPLACE FUNCTION public.auditoria_item_garante_controle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_controle_id uuid;
  v_criticidade text;
BEGIN
  -- `ON DELETE SET NULL` usa uma atualização interna para preservar o item de
  -- auditoria quando o controle vinculado é excluído. Essa atualização deve
  -- somente desfazer o vínculo: sem esta guarda, o gatilho criaria outro
  -- controle imediatamente e a exclusão pareceria não funcionar.
  IF TG_OP = 'UPDATE'
     AND OLD.controle_vinculado_id IS NOT NULL
     AND NEW.controle_vinculado_id IS NULL THEN
    NEW.controle_gerado_automaticamente := false;
    RETURN NEW;
  END IF;

  v_criticidade := CASE lower(COALESCE(NEW.prioridade, 'media'))
    WHEN 'alta' THEN 'alto'
    WHEN 'critica' THEN 'critico'
    WHEN 'crítica' THEN 'critico'
    WHEN 'baixa' THEN 'baixo'
    ELSE 'medio'
  END;

  IF NEW.controle_vinculado_id IS NULL THEN
    SELECT a.empresa_id
      INTO v_empresa_id
      FROM public.auditorias a
     WHERE a.id = NEW.auditoria_id;

    IF v_empresa_id IS NULL THEN
      RAISE EXCEPTION 'A auditoria % não existe', NEW.auditoria_id;
    END IF;

    -- Com código informado, somente o próprio código identifica um controle
    -- existente. O nome só serve como fallback quando a integração não envia
    -- código; assim dois controles homônimos não trocam de identidade.
    SELECT c.id
      INTO v_controle_id
      FROM public.controles c
     WHERE c.empresa_id = v_empresa_id
       AND (
         (NULLIF(btrim(NEW.codigo), '') IS NOT NULL AND c.codigo = btrim(NEW.codigo))
         OR (
           NULLIF(btrim(NEW.codigo), '') IS NULL
           AND lower(btrim(c.nome)) = lower(btrim(NEW.titulo))
         )
       )
     ORDER BY c.created_at, c.id
     LIMIT 1;

    IF v_controle_id IS NOT NULL THEN
      NEW.controle_vinculado_id := v_controle_id;
      NEW.controle_gerado_automaticamente := false;
      RETURN NEW;
    END IF;

    INSERT INTO public.controles (
      empresa_id,
      codigo,
      nome,
      descricao,
      tipo,
      status,
      criticidade,
      responsavel_id,
      proxima_avaliacao,
      area
    )
    VALUES (
      v_empresa_id,
      NULLIF(btrim(NEW.codigo), ''),
      NEW.titulo,
      NEW.descricao,
      'detectivo',
      'ativo',
      v_criticidade,
      NEW.responsavel_id,
      NEW.prazo,
      'Auditoria'
    )
    RETURNING id INTO v_controle_id;

    NEW.controle_vinculado_id := v_controle_id;
    NEW.controle_gerado_automaticamente := true;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.controle_gerado_automaticamente
     AND NEW.controle_vinculado_id = OLD.controle_vinculado_id THEN
    UPDATE public.controles
       SET codigo = COALESCE(NULLIF(btrim(NEW.codigo), ''), codigo),
           nome = NEW.titulo,
           descricao = NEW.descricao,
           criticidade = v_criticidade,
           responsavel_id = NEW.responsavel_id,
           proxima_avaliacao = NEW.prazo,
           updated_at = now()
     WHERE id = NEW.controle_vinculado_id;

    NEW.controle_gerado_automaticamente := true;
  ELSIF TG_OP = 'INSERT'
     OR NEW.controle_vinculado_id IS DISTINCT FROM OLD.controle_vinculado_id THEN
    NEW.controle_gerado_automaticamente := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auditoria_item_garante_controle_trg ON public.auditoria_itens;
CREATE TRIGGER auditoria_item_garante_controle_trg
  BEFORE INSERT OR UPDATE OF codigo, titulo, descricao, prioridade,
    responsavel_id, prazo, controle_vinculado_id, auditoria_id
  ON public.auditoria_itens
  FOR EACH ROW EXECUTE FUNCTION public.auditoria_item_garante_controle();

-- Controles que nasceram de itens recebem retroativamente o código do item,
-- desde que ele não pertença a outro controle da empresa.
UPDATE public.controles c
   SET codigo = btrim(ai.codigo),
       updated_at = now()
  FROM public.auditoria_itens ai
 WHERE ai.controle_vinculado_id = c.id
   AND ai.controle_gerado_automaticamente
   AND NULLIF(btrim(ai.codigo), '') IS NOT NULL
   AND c.codigo IS DISTINCT FROM btrim(ai.codigo)
   AND NOT EXISTS (
     SELECT 1
       FROM public.controles outro
      WHERE outro.empresa_id = c.empresa_id
        AND outro.id <> c.id
        AND outro.codigo = btrim(ai.codigo)
   );

-- Para controles previamente existentes/importados, o código do controle é o
-- canônico. Corrige os itens antigos que usavam uma sequência paralela.
UPDATE public.auditoria_itens ai
   SET codigo = c.codigo
  FROM public.controles c
 WHERE ai.controle_vinculado_id = c.id
   AND NULLIF(btrim(c.codigo), '') IS NOT NULL
   AND ai.codigo IS DISTINCT FROM c.codigo;

COMMENT ON FUNCTION public.auditoria_item_garante_controle() IS
  'Cria e sincroniza controles de itens manuais preservando o mesmo código exibido em Auditoria e Controles.';
