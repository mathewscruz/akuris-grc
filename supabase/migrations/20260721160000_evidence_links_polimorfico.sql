-- Torna evidence_library_links POLIMÓRFICO.
-- Antes: só vinculava evidências a requisitos de gap analysis (evaluation_id/
-- requirement_id/framework_id, todos NOT NULL).
-- Agora: também vincula a registros de qualquer módulo (controles, incidentes,
-- auditorias, riscos, due diligence) via (modulo, registro_id).
-- Aditivo e retrocompatível: os vínculos de gap analysis existentes continuam válidos.

-- 1. Colunas polimórficas (nulas)
ALTER TABLE public.evidence_library_links
  ADD COLUMN IF NOT EXISTS modulo TEXT,
  ADD COLUMN IF NOT EXISTS registro_id UUID;

-- 2. Afrouxa as colunas específicas de gap analysis (agora opcionais)
ALTER TABLE public.evidence_library_links ALTER COLUMN evaluation_id DROP NOT NULL;
ALTER TABLE public.evidence_library_links ALTER COLUMN requirement_id DROP NOT NULL;
ALTER TABLE public.evidence_library_links ALTER COLUMN framework_id DROP NOT NULL;

-- 3. Todo vínculo tem OU um destino de gap analysis OU um destino polimórfico
ALTER TABLE public.evidence_library_links DROP CONSTRAINT IF EXISTS evidence_link_has_target;
ALTER TABLE public.evidence_library_links
  ADD CONSTRAINT evidence_link_has_target CHECK (
    evaluation_id IS NOT NULL OR (modulo IS NOT NULL AND registro_id IS NOT NULL)
  );

-- 4. Impede duplicar o mesmo vínculo evidência ↔ registro
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_link_registro
  ON public.evidence_library_links(evidence_id, modulo, registro_id)
  WHERE registro_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_links_registro
  ON public.evidence_library_links(empresa_id, modulo, registro_id)
  WHERE registro_id IS NOT NULL;

-- 5. Ajusta a policy de INSERT para aceitar vínculos polimórficos (evaluation_id nulo)
DROP POLICY IF EXISTS "evidence_links_insert_empresa" ON public.evidence_library_links;
CREATE POLICY "evidence_links_insert_empresa" ON public.evidence_library_links
FOR INSERT WITH CHECK (
  empresa_id = public.get_user_empresa_id()
  AND (evaluation_id IS NULL OR public.evaluation_pertence_empresa(evaluation_id))
);
