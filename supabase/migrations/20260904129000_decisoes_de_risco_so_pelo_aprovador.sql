/* Somente o aprovador designado pode decidir; aprovação não pode pular a fila. */
-- Consolida a regra antiga nesta única função para evitar duas mensagens e
-- duas implementações diferentes sobre a mesma transição.
DROP TRIGGER IF EXISTS trg_enforce_risco_aprovacao ON public.riscos;

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

  IF NEW.status_aprovacao IN ('aprovado', 'rejeitado')
     AND OLD.status_aprovacao IS DISTINCT FROM NEW.status_aprovacao THEN
    IF OLD.status_aprovacao IS DISTINCT FROM 'pendente_aprovacao' THEN
      RAISE EXCEPTION 'APROVACAO_DEVE_ESTAR_PENDENTE';
    END IF;
    IF auth.uid() IS DISTINCT FROM OLD.aprovador_id THEN
      RAISE EXCEPTION 'APENAS_APROVADOR_DESIGNADO_DECIDE';
    END IF;
  END IF;

  IF NEW.status_aceite = 'pendente'
     AND OLD.status_aceite IS DISTINCT FROM NEW.status_aceite THEN
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

  IF NEW.status_aceite IN ('aprovado', 'rejeitado')
     AND OLD.status_aceite IS DISTINCT FROM NEW.status_aceite THEN
    IF OLD.status_aceite IS DISTINCT FROM 'pendente' THEN
      RAISE EXCEPTION 'ACEITE_DEVE_ESTAR_PENDENTE';
    END IF;
    IF auth.uid() IS DISTINCT FROM OLD.aprovador_aceite THEN
      RAISE EXCEPTION 'APENAS_APROVADOR_DO_ACEITE_DECIDE';
    END IF;
  END IF;

  IF NEW.aceito IS TRUE AND OLD.aceito IS DISTINCT FROM NEW.aceito
     AND NEW.status_aceite <> 'aprovado' THEN
    RAISE EXCEPTION 'ACEITE_FORMAL_SEM_APROVACAO';
  END IF;

  IF NEW.status_aceite = 'aprovado'
     AND OLD.status_aceite IS DISTINCT FROM NEW.status_aceite THEN
    NEW.status := 'monitorado';
  END IF;
  RETURN NEW;
END;
$$;
