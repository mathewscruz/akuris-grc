-- Remover policies que permitiam ao próprio usuário inserir/atualizar mfa_sessions.
-- A criação/atualização deve ocorrer SOMENTE via Edge Function (service role),
-- evitando que um cliente comprometido falsifique uma sessão MFA válida.
DROP POLICY IF EXISTS "Users can insert own mfa sessions" ON public.mfa_sessions;
DROP POLICY IF EXISTS "Users can update own mfa sessions" ON public.mfa_sessions;

-- Mantemos apenas SELECT do próprio usuário (já existente). Recriamos por idempotência.
DROP POLICY IF EXISTS "Users can view own mfa sessions" ON public.mfa_sessions;
CREATE POLICY "Users can view own mfa sessions"
ON public.mfa_sessions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());