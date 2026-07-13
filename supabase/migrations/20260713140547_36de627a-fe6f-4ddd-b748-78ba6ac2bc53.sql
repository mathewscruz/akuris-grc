-- Fix mutable search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Revoke anon EXECUTE on internal SECURITY DEFINER helpers/triggers
REVOKE EXECUTE ON FUNCTION public.can_access_projeto(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_tarefa(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_projeto_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.projeto_pertence_empresa(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notifica_mencao_comentario() FROM anon;
REVOKE EXECUTE ON FUNCTION public.projeto_bootstrap() FROM anon;
REVOKE EXECUTE ON FUNCTION public.projeto_tarefa_check_conclusao() FROM anon;
REVOKE EXECUTE ON FUNCTION public.projeto_tarefa_notify_atribuicao() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalcula_tempo_gasto_tarefa() FROM anon;