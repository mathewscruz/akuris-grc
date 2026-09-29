-- Additive foundation. Existing organization evaluations and scores stay unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.gap_analysis_frameworks
  ADD COLUMN assessment_scope text NOT NULL DEFAULT 'organization'
    CHECK (assessment_scope IN ('organization','product')),
  ADD COLUMN rollout_status text NOT NULL DEFAULT 'active'
    CHECK (rollout_status IN ('draft','active','retired'));

-- Draft product catalogs must not appear in legacy questionnaires or AI context.
CREATE POLICY regulatory_framework_release_gate ON public.gap_analysis_frameworks
  AS RESTRICTIVE FOR SELECT TO authenticated USING (rollout_status = 'active');

CREATE TABLE public.regulatory_framework_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES public.gap_analysis_frameworks(id) ON DELETE RESTRICT,
  version text NOT NULL CHECK (length(btrim(version)) BETWEEN 1 AND 100),
  jurisdiction text NOT NULL,
  legal_instrument text NOT NULL,
  source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
  verified_on date NOT NULL,
  reporting_applies_on date,
  general_applies_on date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  coverage_note text NOT NULL,
  scoring_method text NOT NULL DEFAULT 'assessed_weighted_v1'
    CHECK (scoring_method = 'assessed_weighted_v1'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (framework_id, version)
);

CREATE TABLE public.regulatory_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_version_id uuid NOT NULL REFERENCES public.regulatory_framework_versions(id) ON DELETE RESTRICT,
  code text NOT NULL CHECK (code ~ '^[a-z][a-z0-9-]{1,79}$'),
  name text NOT NULL,
  name_en text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  UNIQUE (framework_version_id, code),
  UNIQUE (framework_version_id, position),
  UNIQUE (id, framework_version_id)
);

-- Canonical control definitions, not copies of tenant operational `controles`.
CREATE TABLE public.universal_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^AK-[A-Z0-9]+-[0-9]{3}$'),
  name text NOT NULL,
  name_en text NOT NULL,
  domain text NOT NULL,
  description text NOT NULL,
  description_en text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.regulatory_requirement_definitions (
  requirement_id uuid PRIMARY KEY REFERENCES public.gap_analysis_requirements(id) ON DELETE RESTRICT,
  framework_version_id uuid NOT NULL REFERENCES public.regulatory_framework_versions(id) ON DELETE RESTRICT,
  domain_id uuid NOT NULL,
  legal_reference text NOT NULL,
  source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
  assessment_question text NOT NULL,
  assessment_question_en text NOT NULL,
  applicability_rule jsonb NOT NULL CHECK (jsonb_typeof(applicability_rule) = 'object'),
  criticality text NOT NULL CHECK (criticality IN ('low','medium','high','critical')),
  risk_level text NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  remediation_guidance text NOT NULL,
  remediation_guidance_en text NOT NULL,
  review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft','reviewed','retired')),
  FOREIGN KEY (domain_id, framework_version_id)
    REFERENCES public.regulatory_domains(id, framework_version_id) ON DELETE RESTRICT
);
CREATE INDEX regulatory_requirements_version ON public.regulatory_requirement_definitions(framework_version_id);
CREATE INDEX regulatory_requirements_domain ON public.regulatory_requirement_definitions(domain_id,framework_version_id);

CREATE TABLE public.control_framework_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id uuid NOT NULL REFERENCES public.universal_controls(id) ON DELETE RESTRICT,
  requirement_id uuid NOT NULL REFERENCES public.gap_analysis_requirements(id) ON DELETE RESTRICT,
  -- Version is optional for the existing, not-yet-versioned catalogs.
  framework_version_id uuid REFERENCES public.regulatory_framework_versions(id) ON DELETE RESTRICT,
  mapping_strength text NOT NULL CHECK (mapping_strength IN ('full','partial','supporting')),
  mapping_notes text NOT NULL CHECK (length(btrim(mapping_notes)) >= 12),
  source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
  review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft','reviewed','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (control_id, requirement_id)
);
CREATE INDEX control_mappings_requirement ON public.control_framework_mappings(requirement_id);
CREATE INDEX control_mappings_version ON public.control_framework_mappings(framework_version_id);

-- Invoker-only trigger. Catalog writes are restricted to service_role/migrations.
CREATE FUNCTION public.regulatory_validate_catalog_reference() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE target_framework uuid; version_framework uuid;
BEGIN
  SELECT r.framework_id INTO target_framework
    FROM public.gap_analysis_requirements r
    JOIN public.gap_analysis_frameworks f ON f.id=r.framework_id
    WHERE r.id=NEW.requirement_id AND f.empresa_id IS NULL AND f.is_template;
  IF target_framework IS NULL THEN RAISE EXCEPTION 'global_requirement_required'; END IF;
  IF NEW.framework_version_id IS NOT NULL THEN
    SELECT framework_id INTO version_framework FROM public.regulatory_framework_versions
      WHERE id=NEW.framework_version_id;
    IF version_framework IS DISTINCT FROM target_framework THEN
      RAISE EXCEPTION 'regulatory_framework_mismatch';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.regulatory_validate_catalog_reference() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER regulatory_definition_integrity BEFORE INSERT OR UPDATE
  ON public.regulatory_requirement_definitions FOR EACH ROW
  EXECUTE FUNCTION public.regulatory_validate_catalog_reference();
CREATE TRIGGER regulatory_mapping_integrity BEFORE INSERT OR UPDATE
  ON public.control_framework_mappings FOR EACH ROW
  EXECUTE FUNCTION public.regulatory_validate_catalog_reference();

-- Do not insert product responses into the organization-level unique key.
CREATE FUNCTION public.regulatory_is_organization_requirement(p_requirement uuid, p_framework uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.gap_analysis_requirements r
    JOIN public.gap_analysis_frameworks f ON f.id=r.framework_id
    WHERE r.id=p_requirement AND (p_framework IS NULL OR f.id=p_framework)
      AND f.assessment_scope='organization' AND f.rollout_status='active');
$$;
REVOKE ALL ON FUNCTION public.regulatory_is_organization_requirement(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.regulatory_is_organization_requirement(uuid,uuid) TO authenticated,service_role;
CREATE POLICY regulatory_evaluation_insert_scope ON public.gap_analysis_evaluations
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.regulatory_is_organization_requirement(requirement_id,framework_id));
CREATE POLICY regulatory_evaluation_update_scope ON public.gap_analysis_evaluations
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true) WITH CHECK (public.regulatory_is_organization_requirement(requirement_id,framework_id));

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  product_type text NOT NULL CHECK (product_type IN ('software','hardware','combined','other')),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 12000),
  product_owner_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  security_owner_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  development_team text NOT NULL DEFAULT '' CHECK (length(development_team) <= 500),
  deployment_model text NOT NULL DEFAULT 'unknown'
    CHECK (deployment_model IN ('on_premise','cloud','hybrid','embedded','mobile','unknown')),
  repositories jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(repositories)='array' AND jsonb_array_length(repositories)<=50),
  markets jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(markets)='array' AND jsonb_array_length(markets)<=250),
  eu_availability text NOT NULL DEFAULT 'unknown' CHECK (eu_availability IN ('yes','no','unknown')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,empresa_id)
);
CREATE INDEX products_tenant_list ON public.products(empresa_id,status,created_at DESC,id);
CREATE INDEX products_owner ON public.products(product_owner_id);
CREATE INDEX products_security_owner ON public.products(security_owner_id);
CREATE INDEX products_creator ON public.products(created_by);

CREATE TABLE public.product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL,
  version text NOT NULL CHECK (length(btrim(version)) BETWEEN 1 AND 100),
  release_date date,
  support_starts_on date,
  support_ends_on date,
  support_rationale text NOT NULL DEFAULT '' CHECK (length(support_rationale)<=4000),
  lifecycle_status text NOT NULL DEFAULT 'development'
    CHECK (lifecycle_status IN ('development','released','end_of_support','archived')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id,empresa_id) REFERENCES public.products(id,empresa_id) ON DELETE RESTRICT,
  UNIQUE (product_id,version),
  UNIQUE (id,product_id,empresa_id),
  CHECK (support_ends_on IS NULL OR support_starts_on IS NULL OR support_ends_on>=support_starts_on),
  CHECK (support_ends_on IS NULL OR release_date IS NULL OR support_ends_on>=release_date)
);
CREATE INDEX product_versions_product_tenant ON public.product_versions(product_id,empresa_id);
CREATE INDEX product_versions_tenant ON public.product_versions(empresa_id,created_at DESC,id);
CREATE INDEX product_versions_creator ON public.product_versions(created_by);

CREATE TABLE public.regulatory_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  actor_id uuid REFERENCES auth.users(id),
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX regulatory_audit_timeline ON public.regulatory_audit_events(empresa_id,product_id,created_at DESC,id);
CREATE INDEX regulatory_audit_actor ON public.regulatory_audit_events(actor_id);

CREATE FUNCTION public.regulatory_product_integrity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.empresa_id<>OLD.empresa_id) THEN
    RAISE EXCEPTION 'immutable_regulatory_identity';
  END IF;
  IF TG_TABLE_NAME='product_versions' THEN
    IF TG_OP='UPDATE' AND (NEW.product_id<>OLD.product_id OR NEW.version<>OLD.version) THEN
      RAISE EXCEPTION 'immutable_product_version';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM unnest(ARRAY[NEW.product_owner_id,NEW.security_owner_id]) owner_id
      WHERE owner_id IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM public.profiles p WHERE p.id=owner_id AND p.empresa_id=NEW.empresa_id AND p.ativo)) THEN
      RAISE EXCEPTION 'invalid_product_owner';
    END IF;
  END IF;
  IF TG_OP='INSERT' THEN NEW.created_by:=auth.uid(); NEW.created_at:=now();
  ELSE NEW.created_by:=OLD.created_by; NEW.created_at:=OLD.created_at; END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.regulatory_product_integrity() FROM PUBLIC,anon,authenticated;

-- Definer is needed only to append a protected log. No public RPC or editable logs.
CREATE SCHEMA IF NOT EXISTS regulatory_private;
REVOKE ALL ON SCHEMA regulatory_private FROM PUBLIC,anon,authenticated;
CREATE FUNCTION regulatory_private.audit_product_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row_value jsonb; previous jsonb; next_value jsonb;
BEGIN
  IF TG_OP<>'INSERT' THEN previous:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN next_value:=to_jsonb(NEW); END IF;
  row_value:=COALESCE(next_value,previous);
  -- Preserve changed business fields; repository URLs and free-text descriptions
  -- are deliberately omitted from this log to avoid duplicating sensitive data.
  previous:=previous-'repositories'-'description'-'support_rationale';
  next_value:=next_value-'repositories'-'description'-'support_rationale';
  INSERT INTO public.regulatory_audit_events(empresa_id,product_id,entity_type,entity_id,action,actor_id,old_value,new_value)
  VALUES((row_value->>'empresa_id')::uuid,
    CASE WHEN TG_TABLE_NAME='products' THEN (row_value->>'id')::uuid ELSE (row_value->>'product_id')::uuid END,
    TG_TABLE_NAME,(row_value->>'id')::uuid,TG_OP,auth.uid(),previous,next_value);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION regulatory_private.audit_product_change() FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE relation text; operation text; BEGIN
  FOREACH relation IN ARRAY ARRAY['regulatory_framework_versions','regulatory_domains','universal_controls',
    'regulatory_requirement_definitions','control_framework_mappings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',relation);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',relation);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',relation);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',relation);
    EXECUTE format('CREATE POLICY regulatory_catalog_read ON public.%I FOR SELECT TO authenticated USING
      ((SELECT public.has_valid_mfa_session()) AND (SELECT public.usuario_tem_permissao_modulo(''gap-analysis'',''read'')))',relation);
  END LOOP;
  FOREACH relation IN ARRAY ARRAY['products','product_versions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',relation);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',relation);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO authenticated',relation);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',relation);
    EXECUTE format('CREATE POLICY regulatory_product_read ON public.%I FOR SELECT TO authenticated USING
      (empresa_id=(SELECT public.get_user_empresa_id()) AND (SELECT public.has_valid_mfa_session())
        AND (SELECT public.usuario_tem_permissao_modulo(''gap-analysis'',''read'')))',relation);
    EXECUTE format('CREATE POLICY regulatory_product_create ON public.%I FOR INSERT TO authenticated WITH CHECK
      (empresa_id=(SELECT public.get_user_empresa_id()) AND (SELECT public.has_valid_mfa_session())
        AND (SELECT public.usuario_tem_permissao_modulo(''gap-analysis'',''create'')))',relation);
    EXECUTE format('CREATE POLICY regulatory_product_update ON public.%I FOR UPDATE TO authenticated USING
      (empresa_id=(SELECT public.get_user_empresa_id()) AND (SELECT public.has_valid_mfa_session())
        AND (SELECT public.usuario_tem_permissao_modulo(''gap-analysis'',''update''))) WITH CHECK
      (empresa_id=(SELECT public.get_user_empresa_id()) AND (SELECT public.has_valid_mfa_session())
        AND (SELECT public.usuario_tem_permissao_modulo(''gap-analysis'',''update'')))',relation);
    EXECUTE format('CREATE TRIGGER regulatory_product_integrity BEFORE INSERT OR UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.regulatory_product_integrity()',relation);
    EXECUTE format('CREATE TRIGGER regulatory_product_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION regulatory_private.audit_product_change()',relation);
  END LOOP;
END $$;
ALTER TABLE public.regulatory_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulatory_audit_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.regulatory_audit_events TO authenticated;
GRANT ALL ON public.regulatory_audit_events TO service_role;
CREATE POLICY regulatory_audit_read ON public.regulatory_audit_events FOR SELECT TO authenticated
USING (empresa_id=(SELECT public.get_user_empresa_id()) AND (SELECT public.has_valid_mfa_session())
  AND (SELECT public.usuario_tem_permissao_modulo('gap-analysis','read')));

COMMIT;
