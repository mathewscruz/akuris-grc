-- Integridade referencial e trilha de auditoria do módulo de Contratos.
--
-- Descoberto por acidente durante a revisão: inseri um aditivo apontando para
-- um contrato que **não existia** e o banco aceitou. As quatro tabelas do
-- módulo — `contratos`, `contrato_aditivos`, `contrato_marcos` e
-- `contrato_documentos` — não tinham **nenhuma** foreign key. Apagar um
-- contrato deixava aditivos, marcos e documentos órfãos para sempre, e a UI
-- exibia qualquer string de `tipo`/`status` capitalizada como se fosse
-- vocabulário legítimo.
--
-- E não havia trilha: o valor de um contrato mudou de 444 mil para 480 mil por
-- aditivo e nenhum registro diz quem decidiu. `audit_logs` já recebia riscos,
-- controles, ativos e avaliações de gap — contratos e fornecedores ficavam de
-- fora justamente onde a pergunta "quem alterou o valor?" é a mais cara.
--
-- Constraints entram como NOT VALID de propósito: validam toda escrita nova
-- sem falhar na criação por causa de lixo pré-existente em produção. Depois de
-- inventariar e corrigir os dados lá, rodar:
--   ALTER TABLE ... VALIDATE CONSTRAINT <nome>;

BEGIN;

-- ---------------------------------------------------------------- FKs
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_empresa_fk,
  ADD CONSTRAINT contratos_empresa_fk
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE
    NOT VALID;

-- RESTRICT: excluir um fornecedor com contratos é decisão que o utilizador
-- precisa tomar contrato a contrato, não um cascateamento silencioso.
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_fornecedor_fk,
  ADD CONSTRAINT contratos_fornecedor_fk
    FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id) ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE public.contrato_aditivos
  DROP CONSTRAINT IF EXISTS contrato_aditivos_contrato_fk,
  ADD CONSTRAINT contrato_aditivos_contrato_fk
    FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.contrato_marcos
  DROP CONSTRAINT IF EXISTS contrato_marcos_contrato_fk,
  ADD CONSTRAINT contrato_marcos_contrato_fk
    FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.contrato_documentos
  DROP CONSTRAINT IF EXISTS contrato_documentos_contrato_fk,
  ADD CONSTRAINT contrato_documentos_contrato_fk
    FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE CASCADE
    NOT VALID;

CREATE INDEX IF NOT EXISTS contrato_aditivos_por_contrato ON public.contrato_aditivos (contrato_id);
CREATE INDEX IF NOT EXISTS contrato_marcos_por_contrato ON public.contrato_marcos (contrato_id);
CREATE INDEX IF NOT EXISTS contrato_documentos_por_contrato ON public.contrato_documentos (contrato_id);
CREATE INDEX IF NOT EXISTS contratos_por_empresa ON public.contratos (empresa_id);

-- ------------------------------------------------------------- vocabulário
-- O conjunto é o que o wizard oferece, mais as variantes legadas que
-- `lib/metrics/contratos.ts` já mapeia (em_negociacao, cancelado, ...).
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_tipo_check,
  ADD CONSTRAINT contratos_tipo_check
    CHECK (tipo IN ('servicos', 'licenciamento', 'manutencao', 'consultoria', 'produto'))
    NOT VALID;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_status_check,
  ADD CONSTRAINT contratos_status_check
    CHECK (status IN (
      'rascunho', 'negociacao', 'em_negociacao', 'aprovacao', 'em_aprovacao',
      'ativo', 'vigente', 'suspenso', 'encerrado', 'cancelado', 'inativo'
    ))
    NOT VALID;

-- O aditivo tem ciclo próprio (rascunho → aprovação → ativo | rejeitado).
-- "assinado" não existe no ciclo — era exatamente o valor que a UI engolia e
-- exibia como "Rascunho" sem avisar.
ALTER TABLE public.contrato_aditivos
  DROP CONSTRAINT IF EXISTS contrato_aditivos_status_check,
  ADD CONSTRAINT contrato_aditivos_status_check
    CHECK (status IN ('rascunho', 'aprovacao', 'ativo', 'rejeitado'))
    NOT VALID;

-- ------------------------------------------------------------- auditoria
-- Mesmo formato de `audit_riscos_changes`: DELETE/INSERT gravam o registro
-- inteiro; UPDATE grava apenas quando algum campo além de `updated_at` mudou.
CREATE OR REPLACE FUNCTION public.audit_contratos_changes()
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
    VALUES (OLD.empresa_id, 'contratos', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (empresa_id, table_name, record_id, action, new_values, user_id)
    VALUES (NEW.empresa_id, 'contratos', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
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
      VALUES (NEW.empresa_id, 'contratos', NEW.id, 'UPDATE', v_old_values, v_new_values, v_changed_fields, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_contratos_trigger ON public.contratos;
CREATE TRIGGER audit_contratos_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.audit_contratos_changes();

-- Aditivo muda valor e prazo do contrato: é o registro que o auditor pede.
-- A empresa vem do contrato-pai, porque a tabela filha não tem empresa_id.
CREATE OR REPLACE FUNCTION public.audit_contrato_aditivos_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_contrato_id uuid;
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);
  SELECT empresa_id INTO v_empresa_id FROM public.contratos WHERE id = v_contrato_id;
  IF v_empresa_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (empresa_id, table_name, record_id, action, old_values, user_id)
    VALUES (v_empresa_id, 'contrato_aditivos', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (empresa_id, table_name, record_id, action, new_values, user_id)
    VALUES (v_empresa_id, 'contrato_aditivos', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_logs (empresa_id, table_name, record_id, action, old_values, new_values, user_id)
    VALUES (v_empresa_id, 'contrato_aditivos', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS audit_contrato_aditivos_trigger ON public.contrato_aditivos;
CREATE TRIGGER audit_contrato_aditivos_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_aditivos
  FOR EACH ROW EXECUTE FUNCTION public.audit_contrato_aditivos_changes();

COMMIT;
