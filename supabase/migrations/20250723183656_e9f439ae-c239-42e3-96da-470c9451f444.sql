-- Corrigir RLS para permitir acesso anônimo aos dados da empresa durante assessments
-- Isso permite que usuários externos vejam nome e logo da empresa quando acessam via link_token

-- Política para permitir acesso anônimo aos dados básicos da empresa
-- Apenas para empresas que têm assessments ativos com link_token válido
CREATE POLICY "Public can view empresa data for active assessments"
ON public.empresas
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.empresa_id = empresas.id 
    AND a.link_token IS NOT NULL 
    AND a.status IN ('enviado', 'em_andamento')
  )
);