REVOKE EXECUTE ON FUNCTION public.expirar_aceites_riscos() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.expirar_aceites_riscos() TO service_role;

DROP POLICY IF EXISTS "Users can view agents from their empresa" ON public.asset_agents;
DROP POLICY IF EXISTS "Admins can view agents from their empresa" ON public.asset_agents;
CREATE POLICY "Admins can view agents from their empresa"
ON public.asset_agents
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_empresa_id()
  AND public.is_admin_or_super_admin()
);

DROP POLICY IF EXISTS "Sistema pode inserir notificações" ON public.riscos_aprovacoes_notificacoes;
DROP POLICY IF EXISTS "Solicitante cria a própria notificação" ON public.riscos_aprovacoes_notificacoes;
CREATE POLICY "Solicitante cria a própria notificação"
ON public.riscos_aprovacoes_notificacoes
FOR INSERT
TO authenticated
WITH CHECK (
  solicitante_id = auth.uid()
  AND empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.riscos r
    WHERE r.id = riscos_aprovacoes_notificacoes.risco_id
      AND r.empresa_id = riscos_aprovacoes_notificacoes.empresa_id
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles ap
    WHERE ap.user_id = riscos_aprovacoes_notificacoes.aprovador_id
      AND ap.empresa_id = riscos_aprovacoes_notificacoes.empresa_id
  )
);

REVOKE EXECUTE ON FUNCTION public.marcar_notificacoes_lidas(text[]) FROM anon;