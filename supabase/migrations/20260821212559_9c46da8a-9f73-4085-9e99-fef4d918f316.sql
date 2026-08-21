-- 1. apply_permission_profile: authorization
CREATE OR REPLACE FUNCTION public.apply_permission_profile(_user_id uuid, _profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_empresa uuid;
  v_is_super boolean;
  v_target_empresa uuid;
  v_profile_empresa uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT public.is_super_admin() INTO v_is_super;

  IF NOT public.is_admin_or_super_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem aplicar perfis de permissão';
  END IF;

  v_caller_empresa := public.get_user_empresa_id();
  SELECT empresa_id INTO v_target_empresa FROM public.profiles WHERE user_id = _user_id;
  IF v_target_empresa IS NULL THEN
    RAISE EXCEPTION 'Utilizador inexistente';
  END IF;

  IF _profile_id IS NOT NULL THEN
    SELECT empresa_id INTO v_profile_empresa FROM public.permission_profiles WHERE id = _profile_id;
    IF v_profile_empresa IS NULL THEN
      RAISE EXCEPTION 'Perfil de permissão inexistente';
    END IF;
  END IF;

  IF NOT v_is_super THEN
    IF v_caller_empresa IS NULL
       OR v_target_empresa IS DISTINCT FROM v_caller_empresa
       OR (_profile_id IS NOT NULL AND v_profile_empresa IS DISTINCT FROM v_caller_empresa) THEN
      RAISE EXCEPTION 'Sem permissão para alterar permissões fora da sua empresa';
    END IF;
  END IF;

  DELETE FROM public.user_module_permissions WHERE user_id = _user_id;

  INSERT INTO public.user_module_permissions (user_id, module_id, can_access, can_create, can_read, can_update, can_delete, granted_by, granted_at)
  SELECT _user_id, ppm.module_id, ppm.can_access, ppm.can_create, ppm.can_read, ppm.can_update, ppm.can_delete, auth.uid(), now()
  FROM public.permission_profile_modules ppm
  WHERE ppm.profile_id = _profile_id;

  UPDATE public.profiles SET permission_profile_id = _profile_id WHERE user_id = _user_id;
END;
$function$;

-- 2. search_path fixo
ALTER FUNCTION public.update_riscos_updated_at() SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.gap_marcos_toca_updated_at() SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.ropa_chave_da_base_legal(text) SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.risco_escala_numero(text) SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.risco_severidade_da_faixa(jsonb, text) SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.severidade_canonica(text) SET search_path TO 'public', 'pg_temp';

-- 3. Vista SECURITY DEFINER -> função pública dedicada
DROP VIEW IF EXISTS public.denuncias_configuracoes_publicas;

CREATE OR REPLACE FUNCTION public.get_canal_config_publica(p_empresa_id uuid)
RETURNS TABLE(
  id uuid,
  texto_apresentacao text,
  politica_privacidade text,
  permitir_anonimas boolean,
  requerer_email boolean,
  nome_exibicao text,
  cor_destaque text,
  idioma_padrao text,
  orgao_externo_nome text,
  orgao_externo_url text,
  texto_retaliacao text,
  retencao_meses integer,
  permitir_reuniao boolean,
  prazo_acusacao_dias integer,
  prazo_retorno_dias integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT c.id, c.texto_apresentacao, c.politica_privacidade, c.permitir_anonimas,
         c.requerer_email, c.nome_exibicao, c.cor_destaque, c.idioma_padrao,
         c.orgao_externo_nome, c.orgao_externo_url, c.texto_retaliacao,
         c.retencao_meses, c.permitir_reuniao, c.prazo_acusacao_dias, c.prazo_retorno_dias
  FROM public.denuncias_configuracoes c
  WHERE c.empresa_id = p_empresa_id AND c.ativo IS NOT FALSE
  LIMIT 1;
$function$;

-- 4. Revogar execução anónima de funções SECURITY DEFINER internas
DO $$
DECLARE
  r record;
  publicas text[] := ARRAY[
    'get_canal_config_publica',
    'get_denuncia_config_publica',
    'get_denuncias_categorias_publicas',
    'get_empresa_by_slug',
    'get_empresa_publica_por_slug',
    'get_empresa_publica_por_token',
    'consult_denuncia_publica',
    'finalize_denuncia_attachment'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    IF r.proname = ANY(publicas) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    END IF;
  END LOOP;
END $$;

-- 5. Logs de campanha: apenas super-admins (service_role ignora RLS)
DROP POLICY IF EXISTS "Authenticated can insert logs for own empresa campaigns" ON public.email_campanha_logs;
CREATE POLICY "Super admins inserem logs de campanha"
ON public.email_campanha_logs FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin());

-- 6. Binários do agente: leitura só para administradores
DROP POLICY IF EXISTS "Authenticated users can read endpoint agent binaries" ON storage.objects;
CREATE POLICY "Admins can read endpoint agent binaries"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'endpoint-agent-binaries' AND public.is_admin());

-- 7. Anexos de risco: correspondência exacta pela pasta da empresa
DROP POLICY IF EXISTS "Users can view their empresa riscos anexos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their empresa riscos anexos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their empresa riscos anexos" ON storage.objects;

CREATE POLICY "Users can view their empresa riscos anexos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'riscos-anexos'
  AND public.get_user_empresa_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Users can update their empresa riscos anexos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'riscos-anexos'
  AND public.get_user_empresa_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
)
WITH CHECK (
  bucket_id = 'riscos-anexos'
  AND public.get_user_empresa_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "Users can delete their empresa riscos anexos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'riscos-anexos'
  AND public.get_user_empresa_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);