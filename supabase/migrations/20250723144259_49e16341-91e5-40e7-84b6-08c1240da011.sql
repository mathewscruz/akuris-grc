-- Corrigir todas as funções sem search_path definido para segurança
-- Adicionar SET search_path = 'public' nas funções que estão gerando warnings

-- 1. Função gerar_protocolo_denuncia
CREATE OR REPLACE FUNCTION public.gerar_protocolo_denuncia()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  protocolo TEXT;
BEGIN
  protocolo := 'DEN' || TO_CHAR(now(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN protocolo;
END;
$function$;

-- 2. Função gerar_token_publico
CREATE OR REPLACE FUNCTION public.gerar_token_publico()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  token TEXT;
BEGIN
  token := encode(gen_random_bytes(32), 'hex');
  RETURN token;
END;
$function$;

-- 3. Função update_denuncias_updated_at
CREATE OR REPLACE FUNCTION public.update_denuncias_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 4. Função update_riscos_updated_at
CREATE OR REPLACE FUNCTION public.update_riscos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 5. Função get_empresa_by_slug
CREATE OR REPLACE FUNCTION public.get_empresa_by_slug(empresa_slug text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT id FROM public.empresas 
  WHERE slug = empresa_slug AND ativo = true
  LIMIT 1;
$function$;

-- 6. Função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- 7. Função generate_temp_password
CREATE OR REPLACE FUNCTION public.generate_temp_password()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$function$;

-- 8. Função handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Não criar perfil automaticamente se for criação administrativa
  IF NEW.raw_user_meta_data ->> 'admin_created' = 'true' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE 
      WHEN NEW.email = 'admin@governaii.com' THEN 'super_admin'::public.user_role
      ELSE 'user'::public.user_role
    END
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, just return
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error and continue with user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- 9. Função create_audit_log
CREATE OR REPLACE FUNCTION public.create_audit_log(p_table_name text, p_record_id uuid, p_action text, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_changed_fields text[] DEFAULT NULL::text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    empresa_id,
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_fields
  ) VALUES (
    auth.uid(),
    get_user_empresa_id(),
    p_table_name,
    p_record_id,
    p_action,
    p_old_values,
    p_new_values,
    p_changed_fields
  );
END;
$function$;

-- 10. Função audit_controles_changes
CREATE OR REPLACE FUNCTION public.audit_controles_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  changed_fields text[] := '{}';
  old_values jsonb;
  new_values jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_values = to_jsonb(NEW);
    PERFORM create_audit_log('controles', NEW.id, 'INSERT', NULL, new_values);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_values = to_jsonb(OLD);
    new_values = to_jsonb(NEW);
    
    -- Detectar campos alterados
    IF OLD.nome != NEW.nome THEN changed_fields = array_append(changed_fields, 'nome'); END IF;
    IF OLD.descricao != NEW.descricao THEN changed_fields = array_append(changed_fields, 'descricao'); END IF;
    IF OLD.status != NEW.status THEN changed_fields = array_append(changed_fields, 'status'); END IF;
    IF OLD.criticidade != NEW.criticidade THEN changed_fields = array_append(changed_fields, 'criticidade'); END IF;
    
    IF array_length(changed_fields, 1) > 0 THEN
      PERFORM create_audit_log('controles', NEW.id, 'UPDATE', old_values, new_values, changed_fields);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_values = to_jsonb(OLD);
    PERFORM create_audit_log('controles', OLD.id, 'DELETE', old_values, NULL);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;