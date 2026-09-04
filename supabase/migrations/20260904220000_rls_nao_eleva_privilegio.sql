-- A tela de gestão de empresas já é exclusiva de super_admin; o banco precisa
-- impor o mesmo limite, pois RLS é a última fronteira contra chamadas diretas.
DROP POLICY IF EXISTS "Admins can insert empresas" ON public.empresas;

CREATE POLICY "Only super admins can insert empresas"
ON public.empresas
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

-- Políticas permissivas são combinadas com OR. As versões antigas abaixo
-- anulavam as políticas mais estritas e permitiam promover um framework da
-- própria empresa a template global. Conservamos apenas as regras que exigem
-- is_template=false para operações de utilizadores da empresa.
DROP POLICY IF EXISTS "Users can insert frameworks in their empresa"
  ON public.gap_analysis_frameworks;

DROP POLICY IF EXISTS "Users can update frameworks for their company"
  ON public.gap_analysis_frameworks;
