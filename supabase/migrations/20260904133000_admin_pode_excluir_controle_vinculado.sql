-- Excluir um controle não deve apagar o histórico da auditoria.
--
-- Antes desta migração, `auditoria_itens.controle_vinculado_id` tinha a ação
-- padrão RESTRICT/NO ACTION. Assim, mesmo um administrador com permissão de
-- exclusão recebia o erro 23503 sempre que o controle estivesse vinculado a
-- um item. O item, suas evidências e comentários agora permanecem no banco;
-- apenas o vínculo com o controle excluído passa a NULL.

ALTER TABLE public.auditoria_itens
  DROP CONSTRAINT IF EXISTS auditoria_itens_controle_vinculado_id_fkey;

ALTER TABLE public.auditoria_itens
  ADD CONSTRAINT auditoria_itens_controle_vinculado_id_fkey
  FOREIGN KEY (controle_vinculado_id)
  REFERENCES public.controles(id)
  ON DELETE SET NULL;

-- A policy permissiva já existente limita a operação à empresa do usuário.
-- Esta policy restritiva acrescenta a permissão funcional: administradores
-- só excluem quando receberam `Excluir` no módulo Controles Internos, enquanto
-- `usuario_tem_permissao_modulo` mantém o acesso integral do super_admin.
DROP POLICY IF EXISTS "Permissão controles delete" ON public.controles;
CREATE POLICY "Permissão controles delete"
  ON public.controles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.usuario_tem_permissao_modulo('controles', 'delete'));

COMMENT ON CONSTRAINT auditoria_itens_controle_vinculado_id_fkey
  ON public.auditoria_itens IS
  'Preserva o item e o histórico da auditoria ao excluir o controle vinculado.';
