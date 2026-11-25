DO $$ DECLARE src text; BEGIN
  src := pg_get_functiondef('public.integracao_registrar_riscos(uuid,uuid,text,jsonb,text[])'::regprocedure);
  EXECUTE replace(src, '/riscos?tab=sugeridos', '/riscos?view=sugeridos');
END $$;