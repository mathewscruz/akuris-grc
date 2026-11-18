CREATE OR REPLACE FUNCTION public.setup_link_status(_token_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT CASE
    WHEN _token_hash IS NULL OR length(_token_hash) < 20 OR length(_token_hash) > 200 THEN false
    ELSE EXISTS (
      SELECT 1 FROM auth.users u
      WHERE (u.recovery_token = _token_hash AND u.recovery_sent_at > now() - interval '24 hours')
         OR (u.confirmation_token = _token_hash AND u.confirmation_sent_at > now() - interval '24 hours')
    ) OR EXISTS (
      SELECT 1 FROM auth.one_time_tokens t
      WHERE t.token_hash = _token_hash
        AND t.token_type IN ('recovery_token', 'confirmation_token')
        AND t.created_at > now() - interval '24 hours'
    )
  END
$$;
REVOKE ALL ON FUNCTION public.setup_link_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.setup_link_status(text) TO anon, authenticated;