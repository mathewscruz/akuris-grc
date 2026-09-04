/*
  Autoria é histórico, não sessão de login.

  Um usuário pode deixar de existir em auth.users e continuar identificado em
  profiles. A FK antiga fazia qualquer UPDATE de um risco legado falhar, ainda
  que created_by não fosse alterado. A auditoria tinha a mesma incompatibilidade
  e já acumulava autores históricos ausentes de auth.users.
*/
ALTER TABLE public.riscos
  DROP CONSTRAINT IF EXISTS riscos_created_by_fkey;

ALTER TABLE public.riscos
  ADD CONSTRAINT riscos_created_by_profiles_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL
  NOT VALID;

ALTER TABLE public.riscos
  VALIDATE CONSTRAINT riscos_created_by_profiles_fkey;

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

-- Esta FK já existia como NOT VALID. Ela protege novos eventos sem apagar os
-- raros identificadores históricos cujo perfil também já não existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.audit_logs'::regclass
      AND conname = 'audit_logs_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL
      NOT VALID;
  END IF;
END;
$$;
