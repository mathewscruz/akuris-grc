ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS baseline_inicio date,
  ADD COLUMN IF NOT EXISTS baseline_fim date;

CREATE OR REPLACE FUNCTION public.salvar_linha_base_projeto(_projeto_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_projeto(_projeto_id) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.projeto_tarefas
     SET baseline_inicio = COALESCE(data_inicio, prazo::date, data_fim),
         baseline_fim = COALESCE(data_fim, prazo::date, data_inicio)
   WHERE projeto_id = _projeto_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.salvar_linha_base_projeto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_linha_base_projeto(uuid) TO authenticated;