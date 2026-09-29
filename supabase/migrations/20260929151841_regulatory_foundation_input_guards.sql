-- Complete the foundation's validation at the database boundary too: the Data
-- API must not rely on browser-side schemas to validate product metadata.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.regulatory_validate_product_metadata() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE entry jsonb; value text;
BEGIN
  IF jsonb_typeof(NEW.repositories) IS DISTINCT FROM 'array'
    OR jsonb_typeof(NEW.markets) IS DISTINCT FROM 'array' THEN
    RAISE check_violation USING MESSAGE='invalid_product_metadata';
  END IF;
  FOR entry IN SELECT jsonb_array_elements(NEW.repositories) LOOP
    value:=entry#>>'{}';
    IF jsonb_typeof(entry)<>'string' OR length(value)>2048
      OR value !~* '^https://[a-z0-9][a-z0-9.-]*(:[0-9]{1,5})?(/[^[:space:]?#]*)?$'
      OR position(chr(92) IN value)>0
      OR COALESCE(substring(lower(value) FROM '^https?://[^/:]+:([0-9]+)/?')::integer,443)>65535 THEN
      RAISE check_violation USING MESSAGE='invalid_repository_url';
    END IF;
  END LOOP;
  FOR entry IN SELECT jsonb_array_elements(NEW.markets) LOOP
    IF jsonb_typeof(entry)<>'string' OR length(btrim(entry#>>'{}')) NOT BETWEEN 1 AND 100 THEN
      RAISE check_violation USING MESSAGE='invalid_product_market';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.regulatory_validate_product_metadata() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER regulatory_product_metadata BEFORE INSERT OR UPDATE OF repositories,markets
  ON public.products FOR EACH ROW EXECUTE FUNCTION public.regulatory_validate_product_metadata();

CREATE FUNCTION public.regulatory_validate_framework_version() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.gap_analysis_frameworks
    WHERE id=NEW.framework_id AND empresa_id IS NULL AND is_template) THEN
    RAISE EXCEPTION 'global_framework_required';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.framework_id<>OLD.framework_id OR NEW.version<>OLD.version) THEN
    RAISE EXCEPTION 'immutable_regulatory_version';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.regulatory_validate_framework_version() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER regulatory_framework_version_integrity BEFORE INSERT OR UPDATE
  ON public.regulatory_framework_versions FOR EACH ROW EXECUTE FUNCTION public.regulatory_validate_framework_version();

-- Record that a sensitive field changed without copying its content into logs.
ALTER TABLE public.regulatory_audit_events ADD COLUMN changed_fields text[] NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION regulatory_private.audit_product_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row_value jsonb; previous jsonb; next_value jsonb; changed text[];
BEGIN
  IF TG_OP<>'INSERT' THEN previous:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN next_value:=to_jsonb(NEW); END IF;
  row_value:=COALESCE(next_value,previous);
  SELECT COALESCE(array_agg(key ORDER BY key),'{}'::text[]) INTO changed
    FROM jsonb_object_keys(row_value) key
    WHERE key NOT IN ('created_at','updated_at') AND previous->key IS DISTINCT FROM next_value->key;
  previous:=previous-'repositories'-'description'-'support_rationale';
  next_value:=next_value-'repositories'-'description'-'support_rationale';
  INSERT INTO public.regulatory_audit_events(empresa_id,product_id,entity_type,entity_id,action,actor_id,old_value,new_value,changed_fields)
  VALUES((row_value->>'empresa_id')::uuid,
    CASE WHEN TG_TABLE_NAME='products' THEN (row_value->>'id')::uuid ELSE (row_value->>'product_id')::uuid END,
    TG_TABLE_NAME,(row_value->>'id')::uuid,TG_OP,auth.uid(),previous,next_value,changed);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION regulatory_private.audit_product_change() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
