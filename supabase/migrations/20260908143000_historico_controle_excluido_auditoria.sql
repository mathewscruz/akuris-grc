-- Preserve audit history without keeping deleted controls in operational work.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.auditoria_itens
  ADD COLUMN IF NOT EXISTS controle_excluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS controle_excluido_id uuid;

-- Repair legacy exclusions ONLY with corroborating deletion evidence.
-- A NULL link alone is not evidence. Require the same tenant, code, title and
-- transaction timestamp, and that the deleted control still does not exist.
WITH comprovados AS (
  SELECT DISTINCT ON (i.id) i.id, l.record_id, l.created_at
  FROM public.auditoria_itens i
  JOIN public.auditorias a ON a.id = i.auditoria_id
  JOIN public.audit_logs l
    ON l.empresa_id = a.empresa_id
   AND l.table_name = 'controles' AND l.action = 'DELETE'
   AND l.old_values->>'codigo' = i.codigo
   AND l.old_values->>'nome' = i.titulo
   AND l.created_at = i.updated_at
   AND i.created_at <= l.created_at
  WHERE i.controle_vinculado_id IS NULL AND i.controle_excluido_em IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.controles c WHERE c.id = l.record_id)
  ORDER BY i.id, l.created_at DESC, l.id
)
UPDATE public.auditoria_itens i
SET controle_excluido_em = c.created_at, controle_excluido_id = c.record_id,
    controle_gerado_automaticamente = false
FROM comprovados c WHERE i.id = c.id;

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
  v_ref text;
  v_detach boolean := false;
BEGIN
  -- Historical work must never recreate a deleted control, including stale forms.
  IF TG_OP = 'UPDATE' AND OLD.controle_excluido_em IS NOT NULL THEN
    -- Preserve normal FK cleanup when a related responsible person, framework,
    -- requirement or area is removed. Only NULL transitions are allowed here;
    -- historical content, scope, markers and control identity stay immutable.
    IF (to_jsonb(NEW) - ARRAY['updated_at','responsavel_id','framework_vinculado_id','requisito_vinculado_id','area_sistema_id'])
       = (to_jsonb(OLD) - ARRAY['updated_at','responsavel_id','framework_vinculado_id','requisito_vinculado_id','area_sistema_id']) THEN
      FOREACH v_ref IN ARRAY ARRAY['responsavel_id','framework_vinculado_id','requisito_vinculado_id','area_sistema_id'] LOOP
        IF (to_jsonb(NEW)->>v_ref) IS DISTINCT FROM (to_jsonb(OLD)->>v_ref) THEN
          IF (to_jsonb(NEW)->>v_ref) IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUDIT_ITEM_CONTROL_DELETED';
          END IF;
          v_detach := true;
        END IF;
      END LOOP;
      IF v_detach THEN RETURN NEW; END IF;
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUDIT_ITEM_CONTROL_DELETED';
  END IF;

  -- These fields are database-owned, not writable archive toggles.
  NEW.controle_excluido_em := NULL;
  NEW.controle_excluido_id := NULL;

  IF TG_OP = 'UPDATE'
     AND OLD.controle_vinculado_id IS NOT NULL
     AND NEW.controle_vinculado_id IS NULL THEN
    -- FK SET NULL happens after the referenced row was deleted. An explicit
    -- unlink of a still-existing control is NOT an exclusion from operations.
    IF NOT EXISTS (SELECT 1 FROM public.controles WHERE id = OLD.controle_vinculado_id) THEN
      NEW.controle_excluido_em := clock_timestamp();
      NEW.controle_excluido_id := OLD.controle_vinculado_id;
    END IF;
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
    -- Only a NEW manual item creates a control. Editing an unlinked legacy
    -- item must not manufacture one or attach to a new control reusing its code.
    IF TG_OP = 'UPDATE' THEN
      NEW.controle_gerado_automaticamente := false;
      RETURN NEW;
    END IF;
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
    IF ROW(NEW.codigo, NEW.titulo, NEW.descricao, NEW.prioridade, NEW.responsavel_id, NEW.prazo)
       IS DISTINCT FROM ROW(OLD.codigo, OLD.titulo, OLD.descricao, OLD.prioridade, OLD.responsavel_id, OLD.prazo) THEN
    UPDATE public.controles
       SET codigo = COALESCE(NULLIF(btrim(NEW.codigo), ''), codigo),
           nome = NEW.titulo,
           descricao = NEW.descricao,
           criticidade = v_criticidade,
           responsavel_id = NEW.responsavel_id,
           proxima_avaliacao = NEW.prazo,
           updated_at = now()
     WHERE id = NEW.controle_vinculado_id;
    END IF;

    NEW.controle_gerado_automaticamente := true;
  ELSIF TG_OP = 'INSERT'
     OR NEW.controle_vinculado_id IS DISTINCT FROM OLD.controle_vinculado_id THEN
    NEW.controle_gerado_automaticamente := false;
  END IF;

  RETURN NEW;
END;
$$;

-- All updates: clients cannot erase the archive marker or edit historical work
-- through a field omitted from the old UPDATE OF list.
DROP TRIGGER IF EXISTS auditoria_item_garante_controle_trg ON public.auditoria_itens;
CREATE TRIGGER auditoria_item_garante_controle_trg
  BEFORE INSERT OR UPDATE ON public.auditoria_itens
  FOR EACH ROW EXECUTE FUNCTION public.auditoria_item_garante_controle();

ALTER TABLE public.auditoria_itens
  ADD CONSTRAINT auditoria_item_controle_excluido_check CHECK (
    (controle_excluido_em IS NULL AND controle_excluido_id IS NULL)
    OR (controle_excluido_em IS NOT NULL AND controle_excluido_id IS NOT NULL
        AND controle_vinculado_id IS NULL AND NOT controle_gerado_automaticamente)
  );

CREATE INDEX auditoria_itens_operacionais_idx
  ON public.auditoria_itens (auditoria_id, id) WHERE controle_excluido_em IS NULL;

COMMENT ON COLUMN public.auditoria_itens.controle_excluido_em IS
  'Data de exclusão comprovada do controle. O item é histórico, fora das contagens operacionais.';
COMMENT ON COLUMN public.auditoria_itens.controle_excluido_id IS
  'Identidade do controle excluído, preservada sem FK. Não autoriza recriação nem novo vínculo.';
COMMENT ON FUNCTION public.auditoria_item_garante_controle() IS
  'Cria controles apenas para novos itens manuais; preserva itens de controles excluídos como histórico sem recriação.';
COMMIT;
