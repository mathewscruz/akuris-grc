-- Documentos: categoria de verdade, dono de verdade, trilha de verdade.
--
-- Três ausências do mesmo módulo:
--
-- 1. **Categoria sem coluna.** Existia a tabela `documentos_categorias`, o
--    diálogo de gestão com nome/descrição/cor, e um select de categoria no
--    filtro de busca avançada — e nenhuma coluna em `documentos` onde guardar
--    a resposta. O filtro recolhia o valor e o descartava.
--
-- 2. **Prazo sem dono.** Uma política vencia em 7 dias e não havia a quem
--    cobrar: o documento não tem responsável. `aprovado_por` só existe para
--    quem passou pelo fluxo formal de aprovação, que é outra pergunta.
--
-- 3. **Trilha sempre vazia.** O menu "Trilha de Auditoria" existia e consultava
--    `audit_logs` por `table_name='documentos'` — e nada nunca escrevia ali:
--    `documentos` só tinha gatilho de `updated_at`. O item de menu abria
--    "Nenhum histórico de alterações encontrado" para sempre.

BEGIN;

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS categoria_id uuid
    REFERENCES public.documentos_categorias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsavel_id uuid
    REFERENCES public.profiles(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.documentos.categoria_id IS
  'Categoria de documentos_categorias. Era um select no filtro sem coluna onde gravar.';
COMMENT ON COLUMN public.documentos.responsavel_id IS
  'Quem responde pela vigência do documento — a quem cobrar quando vence.';

CREATE INDEX IF NOT EXISTS documentos_por_categoria
  ON public.documentos (empresa_id, categoria_id) WHERE categoria_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS documentos_por_responsavel
  ON public.documentos (empresa_id, responsavel_id) WHERE responsavel_id IS NOT NULL;

-- ------------------------------------------------------------- auditoria
CREATE OR REPLACE FUNCTION public.audit_documentos_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_values jsonb;
  v_new_values jsonb;
  v_changed_fields text[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (empresa_id, table_name, record_id, action, old_values, user_id)
    VALUES (OLD.empresa_id, 'documentos', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (empresa_id, table_name, record_id, action, new_values, user_id)
    VALUES (NEW.empresa_id, 'documentos', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    SELECT array_agg(key) INTO v_changed_fields
    FROM jsonb_each(v_new_values) AS n(key, value)
    WHERE n.value IS DISTINCT FROM v_old_values->n.key
      AND n.key NOT IN ('updated_at');
    IF v_changed_fields IS NOT NULL AND array_length(v_changed_fields, 1) > 0 THEN
      INSERT INTO public.audit_logs (empresa_id, table_name, record_id, action, old_values, new_values, changed_fields, user_id)
      VALUES (NEW.empresa_id, 'documentos', NEW.id, 'UPDATE', v_old_values, v_new_values, v_changed_fields, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_documentos_trigger ON public.documentos;
CREATE TRIGGER audit_documentos_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_documentos_changes();

COMMIT;
