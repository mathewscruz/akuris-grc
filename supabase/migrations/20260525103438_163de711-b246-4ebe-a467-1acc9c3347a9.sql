-- 1. Remove overly broad delete policy on due-diligence-evidencias bucket
DROP POLICY IF EXISTS "Authenticated users can delete due diligence evidence" ON storage.objects;

-- 2. Restrict docgen_templates SELECT policy to authenticated role only
DROP POLICY IF EXISTS "Users can view templates from their empresa or system templates" ON public.docgen_templates;

CREATE POLICY "Users can view templates from their empresa or system templates"
ON public.docgen_templates
FOR SELECT
TO authenticated
USING ((empresa_id = get_user_empresa_id()) OR (is_system = true));