
-- Fundação para a fase 2 do MFA: função que responde se o usuário tem
-- uma sessão de MFA válida (last hop de 24h). Ainda NÃO é aplicada nas
-- políticas de acesso das tabelas de negócio — isso será feito em uma
-- migração dedicada com janela de manutenção.
CREATE OR REPLACE FUNCTION public.has_valid_mfa_session(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mfa_sessions
    WHERE user_id = _user_id
      AND expires_at > now()
  );
$$;

COMMENT ON FUNCTION public.has_valid_mfa_session(uuid) IS
  'Retorna true se o usuário tem uma sessão MFA válida (verificada nas últimas 24h). Uso previsto: complemento em RLS de tabelas sensíveis em uma segunda onda.';
