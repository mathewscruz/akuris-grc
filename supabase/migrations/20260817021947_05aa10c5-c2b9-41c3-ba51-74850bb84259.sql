-- 0) Token público sem dependência de pgcrypto no search_path
CREATE OR REPLACE FUNCTION public.gerar_token_publico()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
  SELECT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

-- 1) Normalização e slug automático
CREATE OR REPLACE FUNCTION public.unaccent_immutable_fallback(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public','pg_temp'
AS $$
  SELECT translate(
    lower(coalesce(p_text, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
$$;

CREATE OR REPLACE FUNCTION public.empresas_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  base text;
  candidate text;
  i integer := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND btrim(NEW.slug) <> '' THEN
    NEW.slug := lower(btrim(NEW.slug));
    RETURN NEW;
  END IF;

  base := btrim(regexp_replace(public.unaccent_immutable_fallback(NEW.nome), '[^a-z0-9]+', '-', 'g'), '-');
  IF base = '' THEN base := 'empresa'; END IF;
  candidate := base;

  WHILE EXISTS (SELECT 1 FROM public.empresas e WHERE lower(e.slug) = candidate) LOOP
    i := i + 1;
    candidate := base || '-' || i;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresas_set_slug ON public.empresas;
CREATE TRIGGER trg_empresas_set_slug
BEFORE INSERT ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.empresas_set_slug();

-- 2) Provisionamento do canal de denúncia
CREATE OR REPLACE FUNCTION public.provisionar_canal_denuncia(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  INSERT INTO public.denuncias_configuracoes (
    empresa_id, ativo, token_publico, permitir_anonimas, requerer_email,
    texto_apresentacao, notificar_administradores
  )
  VALUES (
    p_empresa_id, true, public.gerar_token_publico(), true, false,
    'Este canal permite comunicar, de forma segura e confidencial, situações que violem as normas internas ou a legislação aplicável.',
    true
  )
  ON CONFLICT (empresa_id) DO NOTHING;

  INSERT INTO public.denuncias_categorias (empresa_id, nome, descricao, cor, ativo)
  SELECT p_empresa_id, v.nome, v.descricao, v.cor, true
  FROM (VALUES
    ('Assédio', 'Assédio moral ou sexual', '#EF4444'),
    ('Fraude', 'Fraude, furto ou desvio de recursos', '#F59E0B'),
    ('Corrupção', 'Suborno, corrupção ou conflito de interesses', '#8B5CF6'),
    ('Discriminação', 'Discriminação ou preconceito', '#EC4899'),
    ('Segurança', 'Segurança da informação ou do trabalho', '#3B82F6'),
    ('Outros', 'Outras situações', '#64748B')
  ) AS v(nome, descricao, cor)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.denuncias_categorias c
    WHERE c.empresa_id = p_empresa_id AND lower(c.nome) = lower(v.nome)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.empresas_provisionar_denuncia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  PERFORM public.provisionar_canal_denuncia(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Falha ao provisionar canal de denúncia da empresa %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresas_provisionar_denuncia ON public.empresas;
CREATE TRIGGER trg_empresas_provisionar_denuncia
AFTER INSERT ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.empresas_provisionar_denuncia();

-- 3) Backfill
UPDATE public.empresas
SET slug = btrim(regexp_replace(public.unaccent_immutable_fallback(nome), '[^a-z0-9]+', '-', 'g'), '-')
WHERE slug IS NULL OR btrim(slug) = '';

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.empresas LOOP
    PERFORM public.provisionar_canal_denuncia(r.id);
  END LOOP;
END $$;