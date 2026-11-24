DROP POLICY IF EXISTS "Anyone can view plans" ON public.planos;
DROP POLICY IF EXISTS "Planos visiveis para autenticados" ON public.planos;
CREATE POLICY "Planos: plano da propria empresa ou super admin" ON public.planos
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR id IN (SELECT e.plano_id FROM public.empresas e WHERE e.id = public.get_user_empresa_id())
);
REVOKE SELECT ON public.planos FROM anon;