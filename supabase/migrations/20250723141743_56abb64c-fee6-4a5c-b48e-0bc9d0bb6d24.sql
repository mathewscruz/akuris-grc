-- Corrigir funções sem search_path definido para segurança
-- Isso é crítico para prevenir privilege escalation attacks

-- 1. Atualizar função get_user_empresa_id
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- 2. Atualizar função is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$function$;

-- 3. Atualizar função is_admin_or_super_admin
CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$function$;

-- 4. Atualizar funções de verificação de empresa
CREATE OR REPLACE FUNCTION public.contrato_pertence_empresa(contrato_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.contratos 
    WHERE id = contrato_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;

CREATE OR REPLACE FUNCTION public.documento_pertence_empresa(documento_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.documentos 
    WHERE id = documento_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;

CREATE OR REPLACE FUNCTION public.controle_pertence_empresa(controle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.controles 
    WHERE id = controle_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;

CREATE OR REPLACE FUNCTION public.incidente_pertence_empresa(incidente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.incidentes 
    WHERE id = incidente_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;

CREATE OR REPLACE FUNCTION public.dados_pessoais_pertence_empresa(dados_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.dados_pessoais 
    WHERE id = dados_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;

CREATE OR REPLACE FUNCTION public.ropa_pertence_empresa(ropa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.ropa_registros 
    WHERE id = ropa_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;

CREATE OR REPLACE FUNCTION public.denuncia_pertence_empresa(denuncia_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.denuncias 
    WHERE id = denuncia_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;

CREATE OR REPLACE FUNCTION public.auditoria_pertence_empresa(auditoria_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.auditorias 
    WHERE id = auditoria_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;

CREATE OR REPLACE FUNCTION public.matriz_pertence_empresa(matriz_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.riscos_matrizes 
    WHERE id = matriz_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;

CREATE OR REPLACE FUNCTION public.risco_pertence_empresa(risco_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.riscos 
    WHERE id = risco_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;

CREATE OR REPLACE FUNCTION public.conta_privilegiada_pertence_empresa(conta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.contas_privilegiadas 
    WHERE id = conta_id AND empresa_id = public.get_user_empresa_id()
  );
$function$;