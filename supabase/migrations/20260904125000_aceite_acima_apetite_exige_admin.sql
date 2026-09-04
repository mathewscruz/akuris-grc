/* Aceites acima do apetite exigem autoridade administrativa. */
CREATE OR REPLACE FUNCTION public.tg_risco_segregar_aprovacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_apetite smallint;
  v_role text;
BEGIN
  IF NEW.status_aprovacao = 'pendente_aprovacao'
     AND OLD.status_aprovacao IS DISTINCT FROM NEW.status_aprovacao
     AND NEW.aprovador_id = auth.uid() THEN
    RAISE EXCEPTION 'APROVACAO_PELO_PROPRIO_SOLICITANTE';
  END IF;

  IF NEW.status_aceite = 'pendente' AND OLD.status_aceite IS DISTINCT FROM NEW.status_aceite THEN
    IF NEW.aprovador_aceite = auth.uid() THEN
      RAISE EXCEPTION 'ACEITE_PELO_PROPRIO_SOLICITANTE';
    END IF;

    SELECT c.apetite_score INTO v_apetite
      FROM public.riscos_matrizes m
      JOIN public.riscos_matriz_configuracao c ON c.matriz_id = m.id
     WHERE m.empresa_id = NEW.empresa_id AND m.ativa
     LIMIT 1;

    IF v_apetite IS NOT NULL AND NEW.score_efetivo > v_apetite THEN
      SELECT role::text INTO v_role
        FROM public.profiles
       WHERE user_id = NEW.aprovador_aceite
         AND empresa_id = NEW.empresa_id
         AND ativo;
      IF v_role IS NULL OR v_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'ACEITE_ACIMA_APETITE_EXIGE_ADMIN';
      END IF;
    END IF;
  END IF;

  IF NEW.status_aceite = 'aprovado' AND OLD.status_aceite IS DISTINCT FROM NEW.status_aceite THEN
    NEW.status := 'monitorado';
  END IF;
  RETURN NEW;
END;
$$;
