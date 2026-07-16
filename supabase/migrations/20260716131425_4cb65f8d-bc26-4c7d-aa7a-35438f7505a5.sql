UPDATE public.mfa_codes
   SET used = true
 WHERE used = false;

COMMENT ON COLUMN public.mfa_codes.code_hash IS
  'Hash SHA-256 hex do formato "<user_id>:<código de 6 dígitos>". Nunca armazenar o código em texto puro.';