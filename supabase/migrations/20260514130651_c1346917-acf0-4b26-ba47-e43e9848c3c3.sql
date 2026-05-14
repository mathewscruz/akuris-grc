-- 1) denuncias: restrict UPDATE to admins or assigned responsavel
DROP POLICY IF EXISTS "Users can update denuncias from their empresa" ON public.denuncias;
CREATE POLICY "Admins or responsavel can update denuncias"
ON public.denuncias
FOR UPDATE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (public.is_admin_or_super_admin() OR responsavel_id = auth.uid())
)
WITH CHECK (
  empresa_id = public.get_user_empresa_id()
  AND (public.is_admin_or_super_admin() OR responsavel_id = auth.uid())
);

-- 2) denuncias_anexos: restrict SELECT to admins or assigned responsavel
DROP POLICY IF EXISTS "Users can view anexos from their empresa" ON public.denuncias_anexos;
CREATE POLICY "Admins or responsavel can view denuncia anexos"
ON public.denuncias_anexos
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_anexos.denuncia_id
      AND d.empresa_id = public.get_user_empresa_id()
      AND d.responsavel_id = auth.uid()
  )
);

-- 3) denuncias_movimentacoes: restrict SELECT same as parent record
DROP POLICY IF EXISTS "Users can view movimentacoes from their empresa" ON public.denuncias_movimentacoes;
DROP POLICY IF EXISTS "View denuncia movements by token or auth" ON public.denuncias_movimentacoes;
CREATE POLICY "Admins or responsavel can view denuncia movimentacoes"
ON public.denuncias_movimentacoes
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_movimentacoes.denuncia_id
      AND d.empresa_id = public.get_user_empresa_id()
      AND d.responsavel_id = auth.uid()
  )
);

-- 4) denuncias_configuracoes: restrict full SELECT to admins; expose
--    public-facing fields via SECURITY DEFINER helper for non-admin flows.
DROP POLICY IF EXISTS "Authenticated can view denuncia config" ON public.denuncias_configuracoes;
CREATE POLICY "Admins can view denuncia config"
ON public.denuncias_configuracoes
FOR SELECT
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND public.is_admin_or_super_admin()
);

CREATE OR REPLACE FUNCTION public.get_denuncia_config_publica(p_empresa_id uuid)
RETURNS TABLE (
  empresa_id uuid,
  texto_apresentacao text,
  permitir_anonimas boolean,
  politica_privacidade text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.empresa_id,
    c.texto_apresentacao,
    c.permitir_anonimas,
    c.politica_privacidade
  FROM public.denuncias_configuracoes c
  WHERE c.empresa_id = p_empresa_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_denuncia_config_publica(uuid) TO anon, authenticated;