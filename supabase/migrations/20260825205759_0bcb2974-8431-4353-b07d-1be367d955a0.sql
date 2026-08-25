REVOKE EXECUTE ON FUNCTION public.marcar_notificacoes_lidas(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_notificacoes_lidas(text[]) TO authenticated, service_role;